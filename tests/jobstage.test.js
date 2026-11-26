'use strict';

// Changing a job's stage by hand (Creator's Jobs form, docs/WORKFLOWS.md section 2): hold, resume, cancel, reopen.

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const { jobStageMoves } = require('../lib/domain/rollup');
const { parseFlags } = require('../lib/domain/taskRules');

async function setup(jobExtra = {}) {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh', crm_deal_id: '1482987000000548231', ...jobExtra });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install pylon', quoted_hours: 4, scheduled_date: '2026-11-03' });
	return { w, jobId: job.ROWID, taskId: task.ROWID };
}
const dbJob = (w) => w.db.jobs[0];
const dbTask = (w, id) => w.db.tasks.find((t) => String(t.ROWID) === String(id));
const lastDeal = (w) => JSON.parse(w.db.outbox.filter((o) => o.job_type === 'crm.update_deal').at(-1).payload).fields;

test('the moves offered for each job stage', () => {
	const names = (s, o) => jobStageMoves(s, o).map((m) => m.action);
	assert.deepEqual(names('Preparation'), ['hold', 'cancel']);
	assert.deepEqual(names('In Progress'), ['hold', 'cancel']);
	assert.deepEqual(names('On Hold'), ['resume', 'cancel']);
	assert.deepEqual(names('Completed'), [], 'Completed comes from the tasks; Close job is its own button');
	assert.deepEqual(names('Cancelled'), [], 'only an administrator reopens');
	assert.deepEqual(names('Cancelled', { isAdmin: true }), ['reopen']);
	assert.deepEqual(names('Completed - Closed', { isAdmin: true }), ['reopen']);
	const cancel = jobStageMoves('In Progress', { openTasks: 2 }).find((m) => m.action === 'cancel');
	assert.equal(cancel.allowed, false);
	assert.match(cancel.reason, /2 open tasks/);
});

test('hold and resume: the job keeps On Hold through task changes, and resuming works the stage out from the tasks', async () => {
	const { w, jobId, taskId } = await setup();
	const held = await jobs.changeJobStage(w.ctx, jobId, { action: 'hold' });
	assert.equal(held.job.stage, 'On Hold');
	assert.equal(lastDeal(w).Job_Stage, 'On Hold');
	assert.equal(lastDeal(w).related_Job_check, undefined, 'the related-job tick is for Completed and Cancelled only');
	assert.ok(w.db.activity.some((a) => a.entity_type === 'job' && a.from_value === 'Preparation' && a.to_value === 'On Hold'));

	w.db.tasks[0].lead_id = '105747000000900001';
	await tasks.transitionTask(w.ctx, taskId, { to: 'Scheduled' });
	assert.equal(dbJob(w).stage, 'On Hold', 'the rollup never overrides a manual hold');

	const resumed = await jobs.changeJobStage(w.ctx, jobId, { action: 'resume' });
	assert.equal(resumed.job.stage, 'In Progress', 'a scheduled task means the job is under way');
	await rejects(jobs.changeJobStage(w.ctx, jobId, { action: 'resume' }), 409, 'bad_stage_move');
});

test('cancel: refused while a task is open (Creator), then sets Cancelled and ticks the CRM deal', async () => {
	const { w, jobId, taskId } = await setup();
	await rejects(jobs.changeJobStage(w.ctx, jobId, { action: 'cancel' }), 409, 'tasks_open');
	dbTask(w, taskId).stage = 'Cancelled';
	dbJob(w).stage = 'In Progress';
	const done = await jobs.changeJobStage(w.ctx, jobId, { action: 'cancel' });
	assert.equal(done.job.stage, 'Cancelled');
	assert.deepEqual(lastDeal(w), { Job_Stage: 'Cancelled', related_Job_check: true });
});

test('reopen: administrator only; the closure email may go again after a reopen (Creator resets the flag)', async () => {
	const { w, jobId, taskId } = await setup();
	await tasks.transitionTask(w.ctx, taskId, { to: 'Complete - Not Used', comment: 'Client dropped it' });
	assert.equal(dbJob(w).stage, 'Completed');
	assert.equal(lastDeal(w).related_Job_check, true, 'the rollup to Completed ticks the deal too');
	const closed = await jobs.closeJob(w.ctx, jobId);
	assert.equal(closed.emailSent, true);

	await rejects(jobs.changeJobStage(w.as(['project_manager']), jobId, { action: 'reopen' }), 403);
	const reopened = await jobs.changeJobStage(w.ctx, jobId, { action: 'reopen' });
	assert.equal(reopened.job.stage, 'Completed', 'every task is finished, so it lands on Completed, ready to close again');
	assert.equal(parseFlags(dbJob(w).flags).closure_email_sent, true, 'Completed keeps the flag');

	// A job reopened to work that is still open loses the flag, so its next closure emails again.
	dbJob(w).stage = 'Completed - Closed';
	dbTask(w, taskId).stage = 'Scheduled';
	const again = await jobs.changeJobStage(w.ctx, jobId, { action: 'reopen' });
	assert.equal(again.job.stage, 'In Progress');
	assert.equal(parseFlags(dbJob(w).flags).closure_email_sent, false);
});

test('the rollup resets the closure flag when a finished job goes back to In Progress', async () => {
	const { w, jobId, taskId } = await setup();
	await tasks.transitionTask(w.ctx, taskId, { to: 'Complete - Not Used', comment: 'Client dropped it' });
	dbJob(w).flags = JSON.stringify({ closure_email_sent: true });
	await tasks.createTask(w.ctx, jobId, { task_type: 'install', name: 'Second visit', scheduled_date: '2026-11-10' });
	w.db.tasks[1].lead_id = '105747000000900001';
	await tasks.transitionTask(w.ctx, w.db.tasks[1].ROWID, { to: 'Scheduled' });
	assert.equal(dbJob(w).stage, 'In Progress');
	assert.equal(parseFlags(dbJob(w).flags).closure_email_sent, false);
});

test('who may move a job stage, and what the job page offers', async () => {
	const { w, jobId } = await setup();
	await rejects(jobs.changeJobStage(w.as(['viewer']), jobId, { action: 'hold' }), 403);
	await rejects(jobs.changeJobStage(w.ctx, jobId, { action: 'archive' }), 400);
	await rejects(jobs.changeJobStage(w.ctx, '105747000009999999', { action: 'hold' }), 404);
	const page = await jobs.getJob(w.ctx, jobId);
	assert.deepEqual(page.stageMoves.map((m) => m.action), ['hold', 'cancel']);
	const viewer = await jobs.getJob(w.as(['viewer']), jobId);
	assert.deepEqual(viewer.stageMoves, [], 'no buttons for a role that cannot edit jobs');
	const pm = await jobs.changeJobStage(w.as(['project_manager']), jobId, { action: 'hold' });
	assert.equal(pm.job.stage, 'On Hold');
});
