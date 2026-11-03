'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects, signSwmsFor } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const checklists = require('../lib/services/checklists');

const CREW = '105747000000900001';

const pre = {
	sections: [
		{ key: 'arrival', questions: [
			{ key: 'site_safe', type: 'yesno', required: true, raiseIssueOn: 'no' },
			{ key: 'hazard', type: 'text', required: true, showIf: { key: 'site_safe', equals: 'no' } },
		] },
	],
};
const post = { sections: [{ key: 'closure', questions: [{ key: 'tidy', type: 'yesno', required: true }] }] };

/** A world with an install task, the crew member assigned, and pre/post templates. */
async function setup() {
	const w = makeWorld();
	w.db.people[0].hourly_rate = 40;
	const { job } = await jobs.createJob(w.ctx, { name: 'Test job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install pylon', quoted_hours: 20 });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: CREW, role: 'lead' });
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });
	const tpl = (phase, def, key) => ({ template_key: key, task_type: 'install', phase, assignee_role: 'lead', version_no: 1, definition: JSON.stringify(def) });
	w.db.templates.push(tpl('pre', pre, 'install.pre.lead@1'), tpl('post', post, 'install.post.lead@1'));
	return { w, task, crew: w.as(['installer'], CREW) };
}

test('starting a checklist uses the right template and is safe to repeat', async () => {
	const { task, crew, w } = await setup();
	const a = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	assert.equal(a.checklist.templateKey, 'install.pre.lead@1');
	assert.equal(a.checklist.status, 'In Progress');
	assert.equal(a.next.key, 'site_safe');
	const b = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	assert.equal(b.checklist.id, a.checklist.id);
	assert.equal(w.db.checklists.length, 1);
});

test('only assigned people can start one, and a task without a template is 404', async () => {
	const { task, w } = await setup();
	await rejects(checklists.startChecklist(w.as(['installer'], '105747000000900003'), task.ROWID, { phase: 'pre' }), 404);
	// A manager who is not on the task cannot fill in someone else's checklist.
	await rejects(checklists.startChecklist(w.as(['project_manager'], '105747000000900002'), task.ROWID, { phase: 'pre' }), 403);
	w.db.templates.length = 0;
	await rejects(checklists.startChecklist(w.as(['installer'], CREW), task.ROWID, { phase: 'pre' }), 404);
});

test('answers are validated, merged, and hidden questions are dropped', async () => {
	const { task, crew } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });

	await rejects(checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'maybe' } }), 400);
	await rejects(checklists.saveAnswers(crew, checklist.id, { answers: { nope: 'x' } }), 400);

	let r = await checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'no' } });
	assert.equal(r.next.key, 'hazard');
	assert.deepEqual(r.progress.issues, ['site_safe']);

	r = await checklists.saveAnswers(crew, checklist.id, { answers: { hazard: 'Wet floor' } });
	assert.equal(r.progress.canComplete, true);

	r = await checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'yes' } });
	assert.equal('hazard' in r.answers, false, 'the follow-up answer is dropped once it no longer applies');
});

test('a checklist with required answers missing cannot be completed (409)', async () => {
	const { task, crew } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	const e = await rejects(checklists.completeChecklist(crew, checklist.id, {}), 409, 'checklist_incomplete');
	assert.deepEqual(e.details.missing, ['site_safe']);
});

test('completing a pre-job checklist needs no hours and publishes an event', async () => {
	const { task, crew, w } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	await checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'yes' } });
	await signSwmsFor(w, task, crew);
	const done = await checklists.completeChecklist(crew, checklist.id, {});
	assert.equal(done.checklist.status, 'Completed');
	assert.equal(done.timeEntry, null);
	assert.ok(w.published.some((p) => p.type === 'checklist.closed'));
	await rejects(checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'no' } }), 409);
});

test('post-job: shift times become a time entry, task hours and cost, approved by the manager', async () => {
	const { task, crew, w } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'post' });
	await checklists.saveAnswers(crew, checklist.id, { answers: { tidy: 'yes' } });

	await rejects(checklists.completeChecklist(crew, checklist.id, {}), 400); // shift details missing
	await rejects(checklists.completeChecklist(crew, checklist.id, { work_date: '2026-11-02', start: '03:00', end: '23:00' }), 400); // over 16 h

	// Monday 07:00-15:30 with a 30 min break = 8 h single.
	const done = await checklists.completeChecklist(crew, checklist.id, {
		work_date: '2026-11-02', start: '07:00', end: '15:30', break_minutes: 30, unbilled_hours: 1,
	});
	assert.equal(done.checklist.hours, 8);
	assert.equal(done.timeEntry.hours_single, 8);
	assert.equal('labour_cost' in done.timeEntry, false, 'crew do not see cost');
	assert.equal(w.db.time[0].labour_cost, 320);
	assert.equal(w.db.tasks[0].booked_hours, 8);
	assert.equal(w.db.tasks[0].labour_cost, 320);
	assert.equal(w.db.tasks[0].variance, 12);
	assert.equal(w.db.time[0].approved, 'false');

	await tasks.transitionTask(crew, task.ROWID, { to: 'In Progress' });
	await tasks.transitionTask(crew, task.ROWID, { to: 'Manager Review' });
	await tasks.transitionTask(w.as(['project_manager']), task.ROWID, { to: 'Completed' });
	assert.equal(w.db.time[0].approved, 'true');
});

test('listing: managers see everyone, crew only their own', async () => {
	const { task, crew, w } = await setup();
	await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	assert.equal((await checklists.listForTask(w.as(['project_manager']), task.ROWID)).items.length, 1);
	assert.equal((await checklists.listForTask(crew, task.ROWID)).items.length, 1);
});

test('another crew member cannot read or change my checklist (404)', async () => {
	const { task, crew, w } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	const other = w.as(['installer'], '105747000000900003');
	await rejects(checklists.getChecklist(other, checklist.id), 404);
	await rejects(checklists.saveAnswers(other, checklist.id, { answers: { site_safe: 'yes' } }), 404);
	// Managers may read it, but not fill it in.
	assert.ok(await checklists.getChecklist(w.as(['project_manager'], '105747000000900002'), checklist.id));
	await rejects(checklists.saveAnswers(w.as(['project_manager'], '105747000000900002'), checklist.id, { answers: { site_safe: 'yes' } }), 404);
});

test('a rejected task goes back to the crew; redoing it updates the hours instead of duplicating them', async () => {
	const { task, crew, w } = await setup();
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'post' });
	await checklists.saveAnswers(crew, checklist.id, { answers: { tidy: 'yes' } });
	const shift = (end) => ({ work_date: '2026-11-02', start: '07:00', end, break_minutes: 0 });
	await checklists.completeChecklist(crew, checklist.id, shift('15:00'));

	const pm = w.as(['project_manager'], '105747000000900002');
	await tasks.transitionTask(crew, task.ROWID, { to: 'In Progress' });
	await tasks.transitionTask(crew, task.ROWID, { to: 'Manager Review' });
	await tasks.transitionTask(pm, task.ROWID, { to: 'Rejected', comment: 'Missed a letter' });
	assert.equal(w.db.checklists[0].checklist_status, 'In Progress', 'checklist is open again');

	await checklists.completeChecklist(crew, checklist.id, shift('16:00'));
	assert.equal(w.db.time.length, 1, 'still one time entry');
	assert.equal(w.db.time[0].hours_single, 8);
	assert.equal(w.db.time[0].hours_x1_5, 1);
	assert.equal(w.db.tasks[0].booked_hours, 9);
});
