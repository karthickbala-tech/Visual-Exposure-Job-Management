'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const { subtaskDraft, closeJobProblems, isCloseOnly, canCloseDirectly, parseFlags } = require('../lib/domain/taskRules');
const handlers = require('../lib/events/handlers');
const { render } = require('../lib/domain/notifications');

const ME = '105747000000900001';
async function setup(over = {}) {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh', ...over });
	return { w, jobId: String(job.ROWID) };
}
const mk = async (w, jobId, input) => String((await tasks.createTask(w.ctx, jobId, input)).task.ROWID);
const dbTask = (w, id) => w.db.tasks.find((t) => String(t.ROWID) === String(id));

test('rules: close-only kinds, subtask drafts and close-job problems', () => {
	assert.equal(isCloseOnly({ task_type: 'install', kind: 'External Install' }), true);
	assert.equal(isCloseOnly({ task_type: 'fabrication', kind: 'External Install' }), false);
	assert.equal(canCloseDirectly({ task_type: 'install', kind: 'Print Only', stage: 'In Progress' }), true);
	assert.equal(canCloseDirectly({ task_type: 'install', kind: 'Print Only', stage: 'Manager Review' }), false);
	assert.equal(subtaskDraft({ task_type: 'design', name: 'D' }, { name: 'D' }, {}).code, 'bad_request');
	assert.equal(subtaskDraft({ task_type: 'install', name: 'I' }, { name: 'I' }, { stage: 'Completed - Closed' }).code, 'job_closed');
	const d = subtaskDraft({ task_type: 'install', name: 'Sub', scheduled_date: '2026-11-10' }, { name: 'Root' }, {}).draft;
	assert.deepEqual([d.name, d.kind, d.scheduled_date], ['Root - Subtask', 'VE Subtask', '2026-11-10']);
	assert.equal(subtaskDraft({ task_type: 'fabrication', name: 'F', kind: 'CNC' }, { name: 'F' }, {}).draft.kind, 'CNC');
	assert.deepEqual(closeJobProblems({ stage: 'Completed - Closed' }, [{ stage: 'Completed' }]), ['This job is already closed.']);
	assert.deepEqual(closeJobProblems({ stage: 'In Progress' }, []), ['This job has no tasks yet.']);
	assert.match(closeJobProblems({ stage: 'In Progress' }, [{ stage: 'Completed' }, { stage: 'In Progress' }])[0], /1 task is not finished/);
	assert.deepEqual(closeJobProblems({ stage: 'Completed' }, [{ stage: 'Completed' }, { stage: 'Cancelled' }, { stage: 'Complete - Not Used' }]), []);
	assert.deepEqual(parseFlags('{"a":1}'), { a: 1 });
	assert.deepEqual(parseFlags('nonsense'), {});
	assert.deepEqual(parseFlags(null), {});
});

test('subtasks hang off the root parent, install subtasks have no SWMS, design tasks and closed jobs are refused', async () => {
	const { w, jobId } = await setup();
	const root = await mk(w, jobId, { task_type: 'install', name: 'Install pylon', kind: 'VE Install' });
	const swmsBefore = w.db.swms.length;
	const sub1 = (await tasks.createSubtask(w.ctx, root)).task;
	assert.equal(sub1.name, 'Install pylon - Subtask');
	assert.equal(sub1.kind, 'VE Subtask');
	assert.equal(String(sub1.parent_id), root);
	assert.equal(sub1.parent_or_sub, 'Sub');
	assert.equal(dbTask(w, root).parent_or_sub, 'Parent');
	assert.equal(w.db.swms.length, swmsBefore, 'a subtask has no SWMS of its own');

	const sub2 = (await tasks.createSubtask(w.ctx, String(sub1.ROWID))).task; // a subtask of a subtask
	assert.equal(String(sub2.parent_id), root, 'joins the same root parent');
	assert.equal(sub2.name, 'Install pylon - Subtask');

	const design = await mk(w, jobId, { task_type: 'design', name: 'Artwork' });
	await rejects(tasks.createSubtask(w.ctx, design), 400);
	await rejects(tasks.createSubtask(w.as(['viewer']), root), 403);
	w.db.jobs[0].stage = 'Completed - Closed';
	await rejects(tasks.createSubtask(w.ctx, root), 409, 'job_closed');
});

test('close-only tasks: a manager closes External Install and Print Only directly; crew cannot; other kinds still follow the flow', async () => {
	const { w, jobId } = await setup();
	const ext = await mk(w, jobId, { task_type: 'install', name: 'Supplier install', kind: 'External Install' });
	await tasks.addAssignee(w.ctx, ext, { person_id: ME, role: 'lead' });
	await rejects(tasks.transitionTask(w.as(['installer']), ext, { to: 'Completed' }), 403);
	const out = await tasks.transitionTask(w.ctx, ext, { to: 'Completed' });
	assert.equal(out.task.stage, 'Completed');
	assert.ok(dbTask(w, ext).completed_at);

	const normal = await mk(w, jobId, { task_type: 'install', name: 'Our install', kind: 'VE Install' });
	await rejects(tasks.transitionTask(w.ctx, normal, { to: 'Completed' }), 409, 'invalid_transition');
});

test('approval records the OH&S answer (default No) and the management-review flag', async () => {
	const { w, jobId } = await setup();
	const a = await mk(w, jobId, { task_type: 'install', name: 'A', kind: 'VE Install' });
	const b = await mk(w, jobId, { task_type: 'install', name: 'B', kind: 'VE Install' });
	dbTask(w, a).stage = 'Manager Review';
	dbTask(w, b).stage = 'Manager Review';
	await tasks.transitionTask(w.ctx, a, { to: 'Completed' });
	assert.equal(dbTask(w, a).ohs_flag, 'No');
	assert.equal(dbTask(w, a).management_review, undefined, 'unset unless asked');
	await tasks.transitionTask(w.ctx, b, { to: 'Completed', ohs: 'Yes', management_review: true });
	assert.equal(dbTask(w, b).ohs_flag, 'Yes');
	assert.equal(dbTask(w, b).management_review, 'Yes');
	await rejects(tasks.transitionTask(w.ctx, a, { to: 'Reopen', ohs: 'Maybe' }), 400);
});

test('closing a job: needs every task finished, closes once, tells the CRM, emails once, and is logged', async () => {
	const { w, jobId } = await setup({ crm_deal_id: '1482987000000548231' });
	const t = await mk(w, jobId, { task_type: 'install', name: 'Install', kind: 'External Install' });
	await rejects(jobs.closeJob(w.ctx, jobId), 409, 'cannot_close');
	await tasks.transitionTask(w.ctx, t, { to: 'Completed' });

	const done = await jobs.closeJob(w.ctx, jobId);
	assert.equal(done.job.stage, 'Completed - Closed');
	assert.equal(done.emailSent, true);
	assert.equal(w.published.filter((p) => p.type === 'job.closed').length, 1);
	assert.equal(w.db.jobs[0].stage, 'Completed - Closed');
	assert.ok(w.db.jobs[0].completed_date);
	assert.equal(parseFlags(w.db.jobs[0].flags).closure_email_sent, true);
	const crm = w.db.outbox.filter((o) => o.job_type === 'crm.update_deal');
	assert.equal(JSON.parse(crm.at(-1).payload).fields.Job_Stage, 'Completed - Closed');
	assert.ok(w.db.activity.some((a) => a.to_value === 'Completed - Closed'));

	await rejects(jobs.closeJob(w.ctx, jobId), 409, 'cannot_close'); // already closed
	// Reopen and close again: the guard flag means no second email.
	w.db.jobs[0].stage = 'Completed';
	const again = await jobs.closeJob(w.ctx, jobId);
	assert.equal(again.emailSent, false);
	assert.equal(w.published.filter((p) => p.type === 'job.closed').length, 1, 'still one closure event');
	await rejects(jobs.closeJob(w.as(['viewer']), jobId), 403);
	await rejects(jobs.closeJob(w.ctx, '105747000009999999'), 404);
});

test('the closure email goes to the job project manager and every project manager, in one message', async () => {
	const { w, jobId } = await setup();
	w.db.people.push({ ROWID: 'pm1', first_name: 'Rachel', email: 'rachel@example.test', roles: ['project_manager'], is_active: 'true' });
	w.db.people.push({ ROWID: 'pm2', first_name: 'Tom', email: 'tom@example.test', roles: ['project_manager'], is_active: 'true' });
	w.db.jobs[0].pm_id = 'pm1';
	w.db.jobs[0].completed_date = '2026-11-04';
	const sent = [];
	const ctx = { ...w.ctx, log: { info() {}, warn() {}, error() {} }, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	await handlers['job.closed']({ jobId }, ctx);
	assert.equal(sent.length, 1, 'one email, not one per person');
	assert.deepEqual(sent[0].to.sort(), ['rachel@example.test', 'tom@example.test']);
	assert.match(sent[0].subject, /Job closed: Pylon refresh/);
	assert.match(sent[0].html, /2026-11-04/);
	assert.equal(render('jobClosed', { job: { name: '<b>x</b>' } }).html.includes('<b>x</b>'), false, 'names are escaped');
});
