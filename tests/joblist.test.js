'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld } = require('./helpers');
const L = require('../lib/domain/jobList');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');

test('tab counts and tab membership follow the same rules as the tabs', () => {
	const list = [
		{ stage: 'Preparation', pm_id: '1', fab_manager_id: '9' },
		{ stage: 'In Progress', pm_id: '2', fab_manager_id: '1' },
		{ stage: 'On Hold', pm_id: '1' },
		{ stage: 'Completed', pm_id: '1' },
		{ stage: 'Completed - Closed', pm_id: '3' },
	];
	assert.deepEqual(L.tabCounts(list, '1'), { all: 5, all_open: 3, my_open: 2, my_jobs: 4, preparation: 1, ongoing: 2, completed: 2 });
	assert.deepEqual(L.tabCounts(list, null), { all: 5, all_open: 3, my_open: 0, my_jobs: 0, preparation: 1, ongoing: 2, completed: 2 }, 'no person record, nothing is "mine"');
});

test('hours add up and the warnings say what is wrong, at most two', () => {
	const t = (type, stage, finish, q, b) => ({ task_type: type, stage, required_finish: finish, quoted_hours: q, booked_hours: b });
	const mix = [t('fabrication', 'In Progress', '2026-10-01', 10, 14), t('install', 'Scheduled', '2026-10-02', 5, 0), t('design', 'Completed', '2026-09-01', 2, 2)];
	const h = L.hoursOf(mix);
	assert.deepEqual(h, { quoted: 17, booked: 16 });
	assert.deepEqual(L.risksOf(mix, { quoted: 15, booked: 20 }, '2026-11-02'), ['Hours 33% over quote', 'Fab behind schedule'], 'two at most, over-quote first');
	assert.deepEqual(L.risksOf(mix, h, '2026-11-02'), ['Fab behind schedule', 'Install behind schedule']);
	assert.deepEqual(L.risksOf([t('fabrication', 'Completed', '2026-10-01', 1, 1)], { quoted: 1, booked: 1 }, '2026-11-02'), [], 'finished work is never "behind"');
});

test('the jobs list carries names, hours, risk and tab counts, and filters work in one pass', async () => {
	const w = makeWorld();
	const me = String(w.ctx.actor.person.ROWID);
	const a = (await jobs.createJob(w.ctx, { name: 'Pylon Refresh', pm_id: me })).job;
	const b = (await jobs.createJob(w.ctx, { name: 'Harbour Wayfinding' })).job;
	await tasks.createTask(w.ctx, String(a.ROWID), { task_type: 'fabrication', name: 'Cut', kind: 'CNC', quoted_hours: 10, required_finish: '2026-10-01' });
	w.db.tasks[0].booked_hours = 14;
	w.db.jobs.find((j) => String(j.ROWID) === String(b.ROWID)).stage = 'In Progress';

	const all = await jobs.listJobs(w.ctx, {});
	assert.equal(all.total, 2);
	assert.deepEqual(all.counts, { all: 2, all_open: 2, my_open: 1, my_jobs: 1, preparation: 1, ongoing: 1, completed: 0 });
	const pylon = all.items.find((j) => j.name === 'Pylon Refresh');
	assert.equal(pylon.pm_name, 'Test User');
	assert.deepEqual([pylon.quoted_hours, pylon.booked_hours], [10, 14]);
	assert.deepEqual(pylon.risk, ['Hours 40% over quote', 'Fab behind schedule']);
	assert.deepEqual(all.items.find((j) => j.name === 'Harbour Wayfinding').risk, []);

	assert.deepEqual((await jobs.listJobs(w.ctx, { view: 'ongoing' })).items.map((j) => j.name), ['Harbour Wayfinding']);
	assert.deepEqual((await jobs.listJobs(w.ctx, { search: 'PYLON' })).items.map((j) => j.name), ['Pylon Refresh'], 'search ignores capitals');
	assert.equal((await jobs.listJobs(w.ctx, { search: 'zzz' })).items.length, 0);
	assert.equal((await jobs.listJobs(w.ctx, { limit: 1 })).items.length, 1);
	assert.equal((await jobs.listJobs(w.ctx, { limit: 1 })).total, 2, 'total is the full match, count is this page');
});

test('the task list can carry the job name, the crew and the SWMS status in three extra queries', async () => {
	const w = makeWorld();
	const me = String(w.ctx.actor.person.ROWID);
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon Refresh' })).job;
	const t = (await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'install', name: 'Fit', kind: 'VE Install' })).task;
	await tasks.addAssignee(w.ctx, String(t.ROWID), { person_id: me, role: 'lead' });
	const plain = await tasks.listTasks(w.ctx, { type: 'install' });
	assert.equal(plain.items[0].crew, undefined, 'only when asked for');
	const out = await tasks.listTasks(w.ctx, { type: 'install', detail: 'true' });
	const row = out.items[0];
	assert.equal(row.job_name, 'Pylon Refresh');
	assert.deepEqual(row.crew, [{ personId: me, name: 'Test User', role: 'lead' }]);
	assert.equal(row.swms_status, 'Created');
	assert.equal((await tasks.listTasks(w.ctx, { type: 'design', detail: 'true' })).items.length, 0);
});

test('trade figures: booked hours per trade, labour cost only when allowed', () => {
	const t = (type, b, c) => ({ task_type: type, booked_hours: b, labour_cost: c });
	const mix = [t('fabrication', 2.5, 100), t('fabrication', 1, 40), t('install', 4, 200), t('design', 9, 999)];
	assert.deepEqual(L.tradeFigures(mix, 'fabrication', false), { hours: 3.5 });
	assert.deepEqual(L.tradeFigures(mix, 'install', true), { hours: 4, cost: 200 });
	assert.deepEqual(L.tradeFigures([], 'install', true), { hours: 0, cost: 0 });
});

test('job form fields: a manager picks the starting stage; the system fields are administrator-only and live in flags and columns', async () => {
	const w = makeWorld();
	const pm = w.as(['project_manager']);
	const j = await jobs.createJob(pm, { name: 'Form job', stage: 'In Progress' });
	assert.equal(j.job.stage, 'In Progress');
	await assert.rejects(jobs.createJob(pm, { name: 'Nope', total_purchases: 5 }), { status: 403 });
	const admin = w.as(['admin']);
	const a = await jobs.createJob(admin, { name: 'Admin job', total_purchases: 120.5, stock_purchases: 20, closure_email_sent: true, close_triggered: true, profit_email_at: '2026-12-01T09:30', workdrive_url: 'https://example.test/f' });
	const row = w.db.jobs.find((r) => r.name === 'Admin job');
	assert.equal(row.total_purchases, 120.5);
	assert.equal(row.profit_email_at, '2026-12-01 09:30:00');
	assert.deepEqual(JSON.parse(row.flags), { closure_email_sent: true, close_triggered: true });
	const got = await jobs.getJob(admin, a.job.ROWID);
	assert.equal(got.job.closure_email_sent, true);
	assert.equal(got.job.close_triggered, true);
	assert.deepEqual(got.locations, []);
	const kept = await jobs.updateJob(admin, a.job.ROWID, { stage: 'On Hold', description: 'd', expected_finish: '2026-12-31', server_path: 'S:x' });
	assert.equal(kept.job.stage, 'Preparation', 'the stage is not editable after creation');
});
