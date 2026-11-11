'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const { permissionsFor } = require('../lib/authz');

let n = 7000000000;
const id = () => String(++n);

/** A job with the given tasks, written straight into the fake database. */
function seedJob(w, name, tasks = []) {
	const job = { ROWID: id(), name, stage: 'In Progress', is_deleted: 'false' };
	w.db.jobs.push(job);
	for (const t of tasks) w.db.tasks.push({ ROWID: id(), job_id: job.ROWID, is_deleted: 'false', booked_hours: 0, ...t });
	return job;
}

test('the administrator soft-deletes several jobs and their finished tasks in one go', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const a = seedJob(w, 'Alpha', [{ stage: 'Completed' }, { stage: 'Cancelled' }]);
	const b = seedJob(w, 'Beta');
	const keep = seedJob(w, 'Keep', [{ stage: 'In Progress' }]);

	const out = await jobs.deleteJobs(w.ctx, { ids: [a.ROWID, b.ROWID] });

	assert.deepEqual(out.deleted.sort(), [a.ROWID, b.ROWID].sort());
	assert.equal(w.db.jobs.find((j) => j.ROWID === a.ROWID).is_deleted, 'true');
	assert.equal(w.db.jobs.find((j) => j.ROWID === b.ROWID).is_deleted, 'true');
	assert.equal(w.db.jobs.find((j) => j.ROWID === keep.ROWID).is_deleted, 'false', 'other jobs are untouched');
	assert.deepEqual(w.db.tasks.filter((t) => t.job_id === a.ROWID).map((t) => t.is_deleted), ['true', 'true'], 'its finished tasks go with it');
	assert.equal(w.db.tasks.find((t) => t.job_id === keep.ROWID).is_deleted, 'false');
	assert.equal(w.db.activity.filter((x) => x.activity_type === 'deleted').length, 2, 'one history row per job');
});

test('a batch is two reads and two writes however many jobs, not a request per job', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const list = [seedJob(w, 'One', [{ stage: 'Completed' }]), seedJob(w, 'Two', [{ stage: 'Completed' }]), seedJob(w, 'Three', [{ stage: 'Completed' }])];
	const calls = { jobsList: 0, tasksList: 0, jobsUpdate: 0, tasksUpdate: 0, activity: 0 };
	const r = w.ctx.repos;
	const wrap = (obj, key, counter) => { const f = obj[key]; obj[key] = async (...a) => { calls[counter]++; return f(...a); }; };
	wrap(r.jobs, 'list', 'jobsList');
	wrap(r.tasks, 'list', 'tasksList');
	wrap(r.jobs, 'update', 'jobsUpdate');
	wrap(r.tasks, 'update', 'tasksUpdate');
	wrap(r.activity, 'insertMany', 'activity');

	await jobs.deleteJobs(w.ctx, { ids: list.map((j) => j.ROWID) });

	assert.deepEqual(calls, { jobsList: 1, tasksList: 1, jobsUpdate: 1, tasksUpdate: 1, activity: 1 });
});

test('only people with the delete permission can delete jobs (403)', async () => {
	for (const role of ['project_manager', 'fab_manager', 'install_coordinator', 'installer', 'viewer']) {
		const w = makeWorld({ roles: [role] });
		const j = seedJob(w, 'Mine');
		await rejects(jobs.deleteJobs(w.ctx, { ids: [j.ROWID] }), 403);
		assert.equal(w.db.jobs[0].is_deleted, 'false');
	}
});

test('a job with booked hours cannot be deleted, and nothing is changed (409)', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const ok = seedJob(w, 'Fine', [{ stage: 'Completed' }]);
	const hours = seedJob(w, 'Has hours', [{ stage: 'Completed', booked_hours: 3.5 }]);
	const err = await rejects(jobs.deleteJobs(w.ctx, { ids: [ok.ROWID, hours.ROWID] }), 409, 'cannot_delete');
	assert.match(err.message, /Has hours has booked hours/);
	assert.ok(w.db.jobs.every((j) => j.is_deleted === 'false'), 'the whole batch is refused, not just one job');
	assert.equal(w.db.activity.length, 0);
});

test('a job with an unfinished task cannot be deleted (409)', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const open = seedJob(w, 'Still open', [{ stage: 'Completed' }, { stage: 'In Progress' }, { stage: 'Scheduled' }]);
	const err = await rejects(jobs.deleteJobs(w.ctx, { ids: [open.ROWID] }), 409, 'cannot_delete');
	assert.match(err.message, /Still open has 2 unfinished tasks/);
});

test('an unknown job is a 404 and nothing is deleted', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const real = seedJob(w, 'Real');
	await rejects(jobs.deleteJobs(w.ctx, { ids: [real.ROWID, '7999999999'] }), 404);
	assert.equal(w.db.jobs[0].is_deleted, 'false');
});

test('the ids are checked: at least one, no more than 50, and well formed (400)', async () => {
	const w = makeWorld({ roles: ['admin'] });
	await rejects(jobs.deleteJobs(w.ctx, { ids: [] }), 400);
	await rejects(jobs.deleteJobs(w.ctx, { ids: ['abc'] }), 400);
	await rejects(jobs.deleteJobs(w.ctx, { ids: Array.from({ length: 51 }, id) }), 400);
	await rejects(jobs.deleteJobs(w.ctx, {}), 400);
});

test('the same id sent twice is deleted once', async () => {
	const w = makeWorld({ roles: ['admin'] });
	const j = seedJob(w, 'Twice');
	const out = await jobs.deleteJobs(w.ctx, { ids: [j.ROWID, j.ROWID] });
	assert.deepEqual(out.deleted, [j.ROWID]);
	assert.equal(w.db.activity.length, 1);
});

test('the permission flag the screens use: only the administrator can delete jobs by default', () => {
	assert.equal(permissionsFor(['admin']).deleteJob, true);
	assert.equal(permissionsFor(['project_manager']).deleteJob, false);
	assert.equal(permissionsFor(['project_manager']).editJob, true);
});
