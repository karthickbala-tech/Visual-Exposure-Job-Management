'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const dashboard = require('../lib/services/dashboard');
const settings = require('../lib/services/settings');
const { validateMatrix, effectiveMatrix } = require('../lib/domain/matrix');
const { todayLocal } = require('../lib/time');

const CREW = '105747000000900001';

/** A simple in-memory stand-in for lib/cache.js. */
function fakeCache() {
	const store = new Map();
	const calls = { get: 0, set: 0 };
	return {
		store,
		calls,
		get: async (k) => (calls.get++, store.has(k) ? store.get(k) : null),
		set: async (k, v) => (calls.set++, store.set(k, v)),
		clear: async (k) => store.delete(k),
	};
}

test('"today" is the date in Melbourne, not in UTC', () => {
	// 23:30 UTC on 1 Nov is already 10:30 on 2 Nov in Melbourne (daylight saving, UTC+11).
	assert.equal(todayLocal(new Date('2026-11-01T23:30:00Z')), '2026-11-02');
	assert.equal(todayLocal(new Date('2026-11-01T23:30:00Z'), 'UTC'), '2026-11-01');
});

async function seed(w) {
	const { job } = await jobs.createJob(w.ctx, { name: 'Job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Cut', required_finish: '2026-10-30', scheduled_date: '2026-11-04' });
	await tasks.createTask(w.ctx, job.ROWID, { task_type: 'design', name: 'Design', scheduled_date: '2026-11-20' });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: CREW, role: 'lead' });
	return task;
}

test('managers get company figures; crew only get their own work', async () => {
	const w = makeWorld();
	await seed(w);
	w.db.issues.push({ ROWID: '105747000001999001', issue_status: 'To Be discussed' }, { ROWID: '105747000001999002', issue_status: 'Completed' });

	const pm = await dashboard.getDashboard(w.as(['project_manager'], '105747000000900002'));
	assert.equal(pm.scope, 'all');
	assert.deepEqual(pm.jobsByStage, { Preparation: 1 });
	assert.equal(pm.overdueTasks, 1);
	assert.equal(pm.openIssues, 1);
	assert.equal(pm.myTasks.length, 0, 'the manager is not assigned anything');

	const crew = await dashboard.getDashboard(w.as(['fab_worker'], CREW));
	assert.equal(crew.scope, 'mine');
	assert.equal('jobsByStage' in crew, false, 'crew never see company-wide counts');
	assert.equal(crew.myTasks.length, 1);
	assert.equal(crew.myTasks[0].name, 'Cut');
});

test('company figures come from the cache for a minute; a new day misses it', async () => {
	require('../lib/caches').clearAll();
	const w = makeWorld();
	await seed(w);
	const cache = fakeCache();
	const ctx = { ...w.as(['project_manager'], '105747000000900002'), cache };

	await dashboard.getDashboard(ctx);
	assert.equal(cache.calls.set, 1);
	await dashboard.getDashboard(ctx);
	assert.equal(cache.calls.set, 1, 'second call reused the cached figures');

	cache.store.set('dashboard.global', { ...cache.store.get('dashboard.global'), today: '2020-01-01' });
	require('../lib/caches').clearAll(); // a cold instance: only the shared cache is left to ask
	await dashboard.getDashboard(ctx);
	assert.equal(cache.calls.set, 2, 'figures from another day are not reused');
});

test('calendar: scoped to what the caller may see, range limited', async () => {
	const w = makeWorld();
	await seed(w);
	const pm = w.as(['project_manager'], '105747000000900002');
	const all = await dashboard.getCalendar(pm, { from: '2026-11-01', to: '2026-11-30' });
	assert.deepEqual(all.items.map((i) => i.name), ['Cut', 'Design']);
	const week = await dashboard.getCalendar(pm, { from: '2026-11-01', to: '2026-11-07' });
	assert.deepEqual(week.items.map((i) => i.name), ['Cut']);

	const crew = await dashboard.getCalendar(w.as(['fab_worker'], CREW), { from: '2026-11-01', to: '2026-11-30' });
	assert.deepEqual(crew.items.map((i) => i.name), ['Cut']);
	assert.deepEqual((await dashboard.getCalendar(w.as(['fab_worker'], '105747000000900003'), { from: '2026-11-01', to: '2026-11-30' })).items, []);

	await rejects(dashboard.getCalendar(pm, { from: '2026-11-10', to: '2026-11-01' }), 400);
	await rejects(dashboard.getCalendar(pm, { from: '2026-01-01', to: '2026-12-31' }), 400);
	await rejects(dashboard.getCalendar(pm, { from: 'tomorrow', to: '2026-12-31' }), 400);
});

test('matrix rules: unknown roles, bad verbs and any reduction of admin are refused', () => {
	assert.deepEqual(validateMatrix({ viewer: { jobs: { verbs: ['view'], scope: 'all' } } }), []);
	assert.match(validateMatrix({ boss: {} }).join('|'), /Unknown role/);
	assert.match(validateMatrix({ viewer: { jobs: { verbs: ['fly'], scope: 'all' } } }).join('|'), /verbs/);
	assert.match(validateMatrix({ viewer: { jobs: { verbs: ['view'], scope: 'everyone' } } }).join('|'), /scope/);
	assert.match(validateMatrix({ viewer: { cats: { verbs: ['view'], scope: 'all' } } }).join('|'), /unknown resource/);
	assert.match(validateMatrix({ admin: { '*': { verbs: ['view'], scope: 'all' } } }).join('|'), /admin role must keep/);
	assert.ok(validateMatrix([]).length && validateMatrix(null).length);
	assert.equal(effectiveMatrix({ viewer: {} }).viewer && Object.keys(effectiveMatrix({ viewer: {} }).viewer).length, 0);
	assert.ok(effectiveMatrix().project_manager.jobs, 'roles not overridden keep their defaults');
});

test('only an admin can read or change the matrix; a change takes effect, is versioned and clears the cache', async () => {
	const w = makeWorld();
	await rejects(settings.setAuthz(w.as(['project_manager']), { matrix: {} }), 403);
	await rejects(settings.getAuthz(w.as(['project_manager'])), 403);
	await rejects(settings.setAuthz(w.ctx, { matrix: { admin: { '*': { verbs: ['view'], scope: 'all' } } } }), 400);

	const configCache = fakeCache();
	const ctx = { ...w.ctx, configCache };
	configCache.store.set('authz.matrix', { override: null });
	const r = await settings.setAuthz(ctx, { matrix: { viewer: { jobs: { verbs: ['view', 'create'], scope: 'all' } } } });
	assert.equal(r.version, 1);
	assert.equal(configCache.store.has('authz.matrix'), false, 'cached copy dropped');
	assert.equal((await settings.setAuthz(ctx, { matrix: {} })).version, 2);

	// A custom matrix really changes what a role may do.
	await settings.setAuthz(ctx, { matrix: { viewer: { jobs: { verbs: ['view', 'create'], scope: 'all' } } } });
	const matrix = await settings.loadMatrix({ repos: w.ctx.repos });
	const viewer = { ...w.as(['viewer']), actor: { ...w.as(['viewer']).actor, matrix } };
	assert.ok((await jobs.createJob(viewer, { name: 'Made by viewer' })).job.ROWID);
	await rejects(jobs.createJob(w.as(['viewer']), { name: 'Default viewer cannot' }), 403);
});

test('loading the matrix: defaults when unset, damaged values never lock anyone out, cache avoids queries', async () => {
	require('../lib/caches').clearAll();
	const w = makeWorld();
	assert.equal(await settings.loadMatrix({ repos: w.ctx.repos }), undefined);

	w.db.settings.push({ ROWID: '105747000001999777', setting_key: 'authz.matrix', setting_value: '{not json' });
	assert.equal(await settings.loadMatrix({ repos: w.ctx.repos }), undefined);

	w.db.settings[0].setting_value = JSON.stringify({ viewer: { jobs: { verbs: ['view'], scope: 'all' } } });
	const cache = fakeCache();
	let queries = 0;
	const repos = { settings: { findByKey: async (k) => (queries++, w.ctx.repos.settings.findByKey(k)) } };
	const m1 = await settings.loadMatrix({ repos, cache });
	const m2 = await settings.loadMatrix({ repos, cache });
	assert.deepEqual(m1.viewer, m2.viewer);
	assert.equal(queries, 1, 'second load came from the cache');
});
