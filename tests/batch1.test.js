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

test('close-only tasks offer "Completed" to managers on the task and job pages (INS-6); not to crew, not to other kinds, not once closed', async () => {
	const { w, jobId } = await setup();
	const ext = await mk(w, jobId, { task_type: 'install', name: 'Supplier install', kind: 'External Install' });
	const ve = await mk(w, jobId, { task_type: 'install', name: 'Our install', kind: 'VE Install' });
	assert.ok((await tasks.getTask(w.ctx, ext)).nextStages.includes('Completed'), 'task page, manager');
	assert.equal((await tasks.getTask(w.ctx, ve)).nextStages.includes('Completed'), false, 'a VE Install still follows the flow');
	const onJob = (await jobs.getJob(w.ctx, jobId)).tasks.find((t) => String(t.ROWID) === ext);
	assert.ok(onJob.nextStages.includes('Completed'), 'job page, manager');

	await tasks.addAssignee(w.ctx, ext, { person_id: ME, role: 'lead' });
	assert.equal((await tasks.getTask(w.as(['installer']), ext)).nextStages.includes('Completed'), false, 'crew cannot close it');

	const done = await tasks.transitionTask(w.ctx, ext, { to: 'Completed' });
	assert.equal(done.nextStages.includes('Completed'), false, 'nothing to close once it is closed');
});

test('a task is scheduled with its date and team leader, and a design task is assigned with its designer (TSK-3, DES-1)', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'install', name: 'Install', kind: 'VE Install' });
	await rejects(tasks.transitionTask(w.ctx, t, { to: 'Scheduled' }), 409, 'not_ready');
	const msg = async (id) => (await tasks.transitionTask(w.ctx, id, { to: 'Scheduled' }).catch((e) => e)).message;
	assert.equal(await msg(t), 'Set the scheduled date and add a team leader before scheduling this task.');
	dbTask(w, t).scheduled_date = '2026-11-20';
	assert.equal(await msg(t), 'Add a team leader before scheduling this task.');
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'member' });
	assert.equal(await msg(t), 'Add a team leader before scheduling this task.', 'a crew member is not a team leader');
	await tasks.removeAssignee(w.ctx, t, ME);
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	assert.equal((await tasks.transitionTask(w.ctx, t, { to: 'Scheduled' })).task.stage, 'Scheduled');

	const fab = await mk(w, jobId, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' });
	await tasks.addAssignee(w.ctx, fab, { person_id: ME, role: 'lead' });
	assert.equal(await msg(fab), 'Set the scheduled date before scheduling this task.', 'fabrication follows the same rule');

	const ext = await mk(w, jobId, { task_type: 'install', name: 'Supplier', kind: 'External Install' });
	assert.equal(await msg(ext), 'Set the scheduled date before scheduling this task.', 'External Install needs no crew, only the date');
	dbTask(w, ext).scheduled_date = '2026-11-21';
	assert.equal((await tasks.transitionTask(w.ctx, ext, { to: 'Scheduled' })).task.stage, 'Scheduled');

	const d = await mk(w, jobId, { task_type: 'design', name: 'Artwork', kind: 'Artwork Sign Off' });
	await rejects(tasks.transitionTask(w.ctx, d, { to: 'Assigned' }), 409, 'not_ready');
	await tasks.addAssignee(w.ctx, d, { person_id: ME, role: 'other' });
	assert.equal((await tasks.transitionTask(w.ctx, d, { to: 'Assigned' })).task.stage, 'Assigned');
});

test('cancel, not used and reset take the crew off with their unfinished checklists; cancel also clears the date and quoted hours', async () => {
	const { w, jobId } = await setup();
	const CREW = '105747000000900002';
	w.db.people.push({ ROWID: CREW, first_name: 'Sam', last_name: 'Crew', email: 'sam@example.test', is_active: 'true', is_deleted: 'false' });
	const planned = async (name, extra = {}) => {
		const id = await mk(w, jobId, { task_type: 'fabrication', name, kind: 'CNC', quoted_hours: 12, scheduled_date: '2026-11-20', ...extra });
		await tasks.addAssignee(w.ctx, id, { person_id: ME, role: 'lead' });
		await tasks.addAssignee(w.ctx, id, { person_id: CREW, role: 'member' });
		await tasks.transitionTask(w.ctx, id, { to: 'Scheduled' });
		w.db.checklists.push({ ROWID: id + '01', task_id: id, assignee_id: ME, phase: 'pre', checklist_status: 'Completed' });
		w.db.checklists.push({ ROWID: id + '02', task_id: id, assignee_id: CREW, phase: 'pre', checklist_status: 'Not Completed' });
		return id;
	};
	const crewOn = (id) => w.db.links.filter((a) => String(a.task_id) === id).length;
	const lists = (id) => w.db.checklists.filter((c) => String(c.task_id) === id).map((c) => c.checklist_status);

	const cancelled = await planned('Cancel me');
	await tasks.transitionTask(w.ctx, cancelled, { to: 'Cancelled', comment: 'Client dropped it' });
	assert.equal(crewOn(cancelled), 0);
	assert.deepEqual(lists(cancelled), ['Completed'], 'the finished checklist stays, the unfinished one goes');
	assert.equal(dbTask(w, cancelled).lead_id, null);
	assert.equal(dbTask(w, cancelled).scheduled_date, null);
	assert.equal(dbTask(w, cancelled).quoted_hours, 0);

	const unused = await planned('Not needed');
	await tasks.transitionTask(w.ctx, unused, { to: 'Complete - Not Used', comment: 'Covered by the other sign' });
	assert.equal(crewOn(unused), 0);
	assert.deepEqual(lists(unused), ['Completed']);
	assert.equal(dbTask(w, unused).scheduled_date, '2026-11-20', 'not used keeps its date');
	assert.equal(dbTask(w, unused).quoted_hours, 12, 'and its quoted hours');

	const reset = await planned('Plan again');
	await tasks.transitionTask(w.ctx, reset, { to: 'Awaiting Scheduling', comment: 'Wrong crew' });
	assert.equal(crewOn(reset), 0);
	assert.equal(dbTask(w, reset).lead_id, null);
	assert.equal(dbTask(w, reset).stage, 'Awaiting Scheduling');

	const held = await planned('Hold me');
	await tasks.transitionTask(w.ctx, held, { to: 'On Hold', comment: 'Waiting for the client' });
	assert.equal(crewOn(held), 2, 'a hold keeps the crew');

	const d = await mk(w, jobId, { task_type: 'design', name: 'Artwork', kind: 'Artwork Sign Off' });
	await tasks.addAssignee(w.ctx, d, { person_id: ME, role: 'other' });
	await tasks.transitionTask(w.ctx, d, { to: 'Assigned' });
	assert.ok((await tasks.getTask(w.ctx, d)).nextStages.includes('To be Assigned'), 'a manager can unassign the designer');
	await tasks.transitionTask(w.ctx, d, { to: 'To be Assigned', comment: 'Designer on leave' });
	assert.equal(crewOn(d), 0);
});

test('hold, cancel, not used and reset need a reason, which is kept with the stage change (TSK-2)', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'fabrication', name: 'Cut', kind: 'CNC', scheduled_date: '2026-11-20' });
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	await tasks.transitionTask(w.ctx, t, { to: 'Scheduled' });
	for (const to of ['On Hold', 'Cancelled', 'Complete - Not Used']) await rejects(tasks.transitionTask(w.ctx, t, { to }), 400);
	await rejects(tasks.transitionTask(w.ctx, t, { to: 'Awaiting Scheduling' }), 400); // a reset
	await tasks.transitionTask(w.ctx, t, { to: 'On Hold', comment: 'Waiting for material' });
	assert.equal(w.db.activity.filter((a) => a.comment_text === 'Waiting for material').length, 1);
	await tasks.transitionTask(w.ctx, t, { to: 'Scheduled' });
	assert.equal(dbTask(w, t).stage, 'Scheduled', 'taking it off hold needs no reason');
});
