'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');

async function jobWithTask(world, type = 'install', extra = {}) {
	const { job } = await jobs.createJob(world.ctx, { name: 'Pylon refresh' });
	const { task } = await tasks.createTask(world.ctx, job.ROWID, { task_type: type, name: 'Install pylon', quoted_hours: 10, ...extra });
	return { job, task };
}

// ---------- jobs ----------

test('a project manager can create a job; it starts in Preparation and is logged and published', async () => {
	const w = makeWorld({ roles: ['project_manager'] });
	const { job } = await jobs.createJob(w.ctx, { name: ' Harbourline wayfinding ', crm_deal_id: 'D1' });
	assert.equal(job.stage, 'Preparation');
	assert.equal(job.name, 'Harbourline wayfinding', 'name is trimmed');
	assert.equal(job.created_date, '2026-11-02');
	assert.equal(w.db.activity.length, 1);
	assert.deepEqual(w.published.map((e) => e.type), ['job.created']);
});

test('roles without create access cannot create jobs (403)', async () => {
	for (const role of ['installer', 'fab_worker', 'viewer', 'contractor']) {
		const w = makeWorld({ roles: [role] });
		await rejects(jobs.createJob(w.ctx, { name: 'x' }), 403);
	}
});

test('job input is validated (400 with details)', async () => {
	const w = makeWorld();
	const err = await rejects(jobs.createJob(w.ctx, { name: '' }), 400);
	assert.ok(Array.isArray(err.details));
	await rejects(jobs.createJob(w.ctx, { name: 'ok', expected_finish: '02/11/2026' }), 400);
	await rejects(jobs.createJob(w.ctx, { name: 'ok', pm_id: 'abc' }), 400);
});

test('managers list all jobs; crew list only jobs with a task assigned to them', async () => {
	const admin = makeWorld();
	const { job: j1 } = await jobs.createJob(admin.ctx, { name: 'Job 1' });
	await jobs.createJob(admin.ctx, { name: 'Job 2' });
	const { task } = await tasks.createTask(admin.ctx, j1.ROWID, { task_type: 'install', name: 'T' });
	await tasks.addAssignee(admin.ctx, task.ROWID, { person_id: '105747000000900001', role: 'member' });

	assert.equal((await jobs.listJobs(admin.ctx)).count, 2);
	const crew = admin.as(['installer'], '105747000000900001');
	const mine = await jobs.listJobs(crew);
	assert.equal(mine.count, 1);
	assert.equal(mine.items[0].name, 'Job 1');

	const stranger = admin.as(['installer'], '105747000000900003');
	assert.equal((await jobs.listJobs(stranger)).count, 0);
});

test('costs are hidden from non-admin managers in job responses', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const { job } = await jobs.createJob(w.ctx, { name: 'J' });
	w.db.jobs[0].fab_cost = 500;
	assert.equal((await jobs.getJob(w.ctx, job.ROWID)).job.fab_cost, 500);
	assert.equal('fab_cost' in (await jobs.getJob(w.as(['project_manager']), job.ROWID)).job, false);
});

test('getJob returns tasks and progress; unknown ids are 404; crew without a task get 404', async () => {
	const w = makeWorld();
	const { job } = await jobWithTask(w);
	const res = await jobs.getJob(w.ctx, job.ROWID);
	assert.equal(res.tasks.length, 1);
	assert.equal(res.progress.job, 0);
	await rejects(jobs.getJob(w.ctx, '123456789012'), 404);
	await rejects(jobs.getJob(w.as(['installer'], '105747000000900003'), job.ROWID), 404);
});

test('getJob tells each task which stage moves the caller may make', async () => {
	const w = makeWorld();
	const { job, task } = await jobWithTask(w);
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'lead' });
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });

	const asManager = (await jobs.getJob(w.as(['project_manager']), job.ROWID)).tasks[0];
	assert.ok(asManager.nextStages.includes('In Progress'));

	const asCrew = (await jobs.getJob(w.as(['installer'], '105747000000900001'), job.ROWID)).tasks[0];
	assert.deepEqual(asCrew.nextStages, ['In Progress']);
});

// ---------- tasks ----------

test('new tasks start in the right stage for their type and bring the job to life', async () => {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'J' });
	const d = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'design', name: 'Artwork' });
	const f = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Letters' });
	assert.equal(d.task.stage, 'To be Assigned');
	assert.equal(f.task.stage, 'Awaiting Scheduling');
	assert.equal(f.job.stage, 'Preparation', 'nothing started yet');
});

test('a closed job refuses new tasks and stage changes (409)', async () => {
	const w = makeWorld();
	const { job, task } = await jobWithTask(w);
	w.db.jobs[0].stage = 'Completed - Closed';
	await rejects(tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'More' }), 409, 'job_closed');
	await rejects(tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' }), 409, 'job_closed');
});

test('transition: valid move is saved, logged, published, and the job is recalculated', async () => {
	const w = makeWorld();
	const { job, task } = await jobWithTask(w);
	const res = await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });
	assert.equal(res.task.stage, 'Scheduled');
	assert.equal(res.job.stage, 'In Progress', 'job moves to In Progress when work is scheduled');
	assert.equal(w.db.tasks[0].stage, 'Scheduled');
	assert.equal(w.db.jobs[0].stage, 'In Progress');
	const last = w.db.activity.filter((a) => a.activity_type === 'stage_change' && a.entity_type === 'task').pop();
	assert.deepEqual([last.from_value, last.to_value], ['Awaiting Scheduling', 'Scheduled']);
	assert.ok(w.published.some((e) => e.type === 'task.stage_changed' && e.payload.to === 'Scheduled'));
	assert.deepEqual(res.nextStages.sort(), ['Awaiting Scheduling', 'Cancelled', 'Complete - Not Used', 'In Progress', 'On Hold']);
	assert.equal(job.ROWID, w.db.jobs[0].ROWID);
});

test('transition: impossible moves are 409, unknown stages 400', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	await rejects(tasks.transitionTask(w.ctx, task.ROWID, { to: 'Completed' }), 409, 'invalid_transition');
	await rejects(tasks.transitionTask(w.ctx, task.ROWID, { to: 'Banana' }), 400);
});

test('transition: reject and reopen need a comment', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	for (const to of ['Scheduled', 'In Progress', 'Manager Review']) await tasks.transitionTask(w.ctx, task.ROWID, { to });
	await rejects(tasks.transitionTask(w.ctx, task.ROWID, { to: 'Rejected' }), 400);
	const res = await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Rejected', comment: 'Wrong colour' });
	assert.equal(res.task.stage, 'Rejected');
	assert.equal(w.db.activity.filter((a) => a.comment_text === 'Wrong colour').length, 1);
});

test('crew: assigned installer can start and submit, but not approve; unassigned crew get 404', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'lead' });
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });

	const crew = w.as(['installer'], '105747000000900001');
	await tasks.transitionTask(crew, task.ROWID, { to: 'In Progress' });
	// INS-3: submitting waits for the crew's closure step
	await rejects(tasks.transitionTask(crew, task.ROWID, { to: 'Manager Review' }), 409, 'closure_open');
	w.db.checklists.push({ ROWID: '105747000000990001', task_id: task.ROWID, assignee_id: '105747000000900001', phase: 'post', checklist_status: 'Completed' });
	await tasks.transitionTask(crew, task.ROWID, { to: 'Manager Review' });
	await rejects(tasks.transitionTask(crew, task.ROWID, { to: 'Completed' }), 403);

	await rejects(tasks.transitionTask(w.as(['installer'], '105747000000900003'), task.ROWID, { to: 'In Progress' }), 404);
	const done = await tasks.transitionTask(w.as(['project_manager']), task.ROWID, { to: 'Completed' });
	assert.equal(done.task.stage, 'Completed');
	assert.ok(done.task.completed_at, 'completion time stamped');
	assert.equal(done.job.stage, 'Completed', 'last open task done, so the job completes');
	assert.equal(w.db.jobs[0].completed_date, '2026-11-02');
});

test('completing one of two tasks moves progress by quoted hours', async () => {
	const w = makeWorld();
	const { job, task } = await jobWithTask(w, 'install', { quoted_hours: 30 });
	await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Fab', quoted_hours: 70 });
	for (const to of ['Scheduled', 'In Progress', 'Manager Review', 'Completed']) {
		await tasks.transitionTask(w.ctx, task.ROWID, { to });
	}
	assert.equal(w.db.jobs[0].percent_install, 100);
	assert.equal(w.db.jobs[0].percent_fab, 0);
	assert.equal(w.db.jobs[0].percent_job, 30);
	assert.equal(w.db.jobs[0].stage, 'In Progress');
});

test('reopening a completed task reopens the finished job', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	for (const to of ['Scheduled', 'In Progress', 'Manager Review', 'Completed']) await tasks.transitionTask(w.ctx, task.ROWID, { to });
	assert.equal(w.db.jobs[0].stage, 'Completed');
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Reopen', comment: 'Client found a fault' });
	assert.equal(w.db.jobs[0].stage, 'In Progress');
});

test('assignees: only managers assign; duplicates and a second lead are refused; the lead is mirrored on the task', async () => {
	const w = makeWorld();
	w.db.people.push({ ROWID: '105747000000900002', first_name: 'Sam', last_name: 'Crew' });
	const { task } = await jobWithTask(w);

	await rejects(tasks.addAssignee(w.as(['installer'], '105747000000900001'), task.ROWID, { person_id: '105747000000900002', role: 'member' }), 404);
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'lead' });
	assert.equal(w.db.tasks[0].lead_id, '105747000000900001');
	await rejects(tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'member' }), 409, 'already_assigned');
	await rejects(tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900002', role: 'lead' }), 409, 'lead_exists');
	await rejects(tasks.addAssignee(w.ctx, task.ROWID, { person_id: '555555555555', role: 'member' }), 404);

	const detail = await tasks.getTask(w.ctx, task.ROWID);
	assert.deepEqual(detail.assignees.map((a) => a.name), ['Test User']);

	await tasks.removeAssignee(w.ctx, task.ROWID, '105747000000900001');
	assert.equal(w.db.tasks[0].lead_id, null);
	assert.equal(w.db.links.length, 0);
	await rejects(tasks.removeAssignee(w.ctx, task.ROWID, '105747000000900001'), 404);
});

test('crew can edit notes on their task but nothing else', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'member' });
	const crew = w.as(['installer'], '105747000000900001');
	await tasks.updateTask(crew, task.ROWID, { notes: 'Gate code 1234' });
	assert.equal(w.db.tasks[0].notes, 'Gate code 1234');
	await rejects(tasks.updateTask(crew, task.ROWID, { quoted_hours: 99 }), 403);
});

test('task lists are scoped for crew and filterable for managers', async () => {
	const w = makeWorld();
	const { job } = await jobWithTask(w, 'install');
	await tasks.createTask(w.ctx, job.ROWID, { task_type: 'design', name: 'Art' });
	assert.equal((await tasks.listTasks(w.ctx)).count, 2);
	assert.equal((await tasks.listTasks(w.ctx, { type: 'design' })).count, 1);
	assert.equal((await tasks.listTasks(w.as(['installer'], '105747000000900003'))).count, 0);
	await rejects(tasks.listTasks(w.ctx, { type: 'painting' }), 400);
});

test('the real context swallows a failed event publish and logs a warning', async () => {
	const { makeContext } = require('../lib/context');
	const warnings = [];
	const log = { info() {}, error() {}, warn: (m, c) => warnings.push([m, c]) };
	const actor = {
		roles: ['admin'],
		person: null,
		db: {},
		app: { jobScheduling: () => { throw new Error('queue down'); } },
	};
	const ctx = makeContext(actor, log);
	await ctx.publish('job.created', { jobId: '1' }); // must not throw
	assert.equal(warnings.length, 1);
	assert.equal(warnings[0][0], 'event publish failed');
	assert.match(warnings[0][1].error, /queue down/);
});

test('task history lists the stage moves with who, from, to and the reason', async () => {
	const w = makeWorld();
	const { task } = await jobWithTask(w);
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });
	const h = await tasks.taskHistory(w.ctx, task.ROWID);
	assert.equal(h.count, 1);
	assert.equal(h.items[0].to, 'Scheduled');
	assert.equal(h.items[0].from, task.stage);
});
