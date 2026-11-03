'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const d = require('../lib/domain/outbox');
const { enqueue, drainOutbox } = require('../lib/services/outbox');
const { authenticate, dealWon } = require('../lib/services/crmWebhook');
const { createHandlers } = require('../lib/integrations/handlers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const { run } = require('../lib/jobs/registry');

test('retry schedule: growing delays, then parked as Failed', () => {
	const now = new Date('2026-11-02T00:00:00Z');
	assert.equal(d.afterFailure(1, now).nextRunAt.toISOString(), '2026-11-02T00:01:00.000Z');
	assert.equal(d.afterFailure(2, now).nextRunAt.toISOString(), '2026-11-02T00:05:00.000Z');
	assert.equal(d.afterFailure(5, now).nextRunAt.toISOString(), '2026-11-02T06:00:00.000Z');
	assert.deepEqual(d.afterFailure(d.MAX_ATTEMPTS, now), { status: 'Failed', nextRunAt: null });
	assert.equal(d.afterFailure(1, now).status, 'Pending');
});

test('stored errors are bounded and never carry secrets', () => {
	const e = d.safeError(new Error('Request failed: refresh_token=1000.abcdef0123456789abcdef0123456789 client_secret: "s3cr3t" ' + 'x'.repeat(5000)));
	assert.ok(e.length <= 2000);
	assert.ok(!e.includes('abcdef0123456789'));
	assert.ok(!e.includes('s3cr3t'));
	assert.match(e, /\[hidden\]/);
});

test('idempotency keys are safe and fit the column; token check is exact', () => {
	assert.equal(d.idempotencyKey('crm.job_stage', 12, 'In Progress'), 'crm.job_stage:12:In_Progress');
	assert.ok(d.idempotencyKey('a'.repeat(300)).length <= 100);
	assert.equal(d.tokenMatches('s3', 's3'), true);
	assert.equal(d.tokenMatches('s3', 's4'), false);
	assert.equal(d.tokenMatches('', ''), false);
	assert.equal(d.tokenMatches('s3', undefined), false);
});

function drainCtx(w, at = '2026-11-02T01:00:00Z') {
	return { repos: w.ctx.repos, log: { info() {}, warn() {}, error() {} }, now: () => new Date(at) };
}

test('queuing the same work twice does nothing the second time, and never throws', async () => {
	const w = makeWorld();
	const item = { jobType: 'crm.update_deal', entityType: 'job', entityId: '1', payload: { dealId: 'D1' }, key: ['k', 1] };
	assert.equal((await enqueue(w.ctx, item)).queued, true);
	assert.equal((await enqueue(w.ctx, item)).queued, false);
	assert.equal(w.db.outbox.length, 1);
	assert.equal(w.db.outbox[0].job_status, 'Pending');

	const broken = { ...w.ctx, repos: { outbox: { findByKey: async () => { throw new Error('db down'); } } } };
	assert.deepEqual(await enqueue(broken, item), { queued: false, error: true });
});

test('draining: success is Done; failures retry later; the last failure parks the row', async () => {
	const w = makeWorld();
	await enqueue(w.ctx, { jobType: 'crm.update_deal', entityType: 'job', entityId: '1', payload: { dealId: 'D1', fields: {} }, key: 'a' });
	const ctx = drainCtx(w);
	let calls = 0;
	const handlers = { 'crm.update_deal': async () => { calls++; throw new Error('CRM 500'); } };

	// First run needs the row to be due: make it so.
	w.db.outbox[0].next_run_at = '2026-11-02 00:00:00';
	assert.deepEqual(await drainOutbox(ctx, handlers), { checked: 1, done: 0, retried: 1, failed: 0, waiting: 0, unknown: 0 });
	assert.equal(w.db.outbox[0].attempts, 1);
	assert.equal(w.db.outbox[0].next_run_at, '2026-11-02 01:01:00');
	assert.match(w.db.outbox[0].last_error, /CRM 500/);

	assert.equal((await drainOutbox(ctx, handlers)).checked, 0, 'not due again yet');

	// Succeeds on the next due run.
	ctx.now = () => new Date('2026-11-02T01:05:00Z');
	const ok = await drainOutbox(ctx, { 'crm.update_deal': async () => {} });
	assert.equal(ok.done, 1);
	assert.equal(w.db.outbox[0].job_status, 'Done');
	assert.equal(w.db.outbox[0].last_error, null);
});

test('draining: after the last attempt the row is Failed and left alone', async () => {
	const w = makeWorld();
	await enqueue(w.ctx, { jobType: 'crm.update_deal', entityType: 'job', entityId: '1', payload: {}, key: 'b' });
	w.db.outbox[0].attempts = d.MAX_ATTEMPTS - 1;
	w.db.outbox[0].next_run_at = '2026-11-02 00:00:00';
	const r = await drainOutbox(drainCtx(w), { 'crm.update_deal': async () => { throw new Error('nope'); } });
	assert.equal(r.failed, 1);
	assert.equal(w.db.outbox[0].job_status, 'Failed');
	assert.equal((await drainOutbox(drainCtx(w), { 'crm.update_deal': async () => {} })).checked, 0);
});

test('draining: an integration that is not set up waits without using up attempts', async () => {
	const w = makeWorld();
	await enqueue(w.ctx, { jobType: 'crm.update_deal', entityType: 'job', entityId: '1', payload: { dealId: 'D1', fields: {} }, key: 'c' });
	w.db.outbox[0].next_run_at = '2026-11-02 00:00:00';
	const r = await drainOutbox(drainCtx(w), createHandlers({}));
	assert.deepEqual(r, { checked: 1, done: 0, retried: 0, failed: 0, waiting: 1, unknown: 0 });
	assert.equal(w.db.outbox[0].job_status, 'Pending');
	assert.equal(Number(w.db.outbox[0].attempts), 0);
	assert.equal(w.db.outbox[0].next_run_at, '2026-11-02 02:00:00');

	// Once a client exists the same row is delivered.
	w.db.outbox[0].next_run_at = '2026-11-02 00:00:00';
	const sent = [];
	const r2 = await drainOutbox(drainCtx(w), createHandlers({ crm: { updateDeal: async (id, fields) => sent.push([id, fields]) } }));
	assert.equal(r2.done, 1);
	assert.deepEqual(sent, [['D1', {}]]);
});

test('draining: unknown work types are left queued; the job runner wires it up', async () => {
	const w = makeWorld();
	await enqueue(w.ctx, { jobType: 'mdm.sync', entityType: 'person', entityId: '1', payload: {}, key: 'd' });
	w.db.outbox[0].next_run_at = '2026-11-02 00:00:00';
	const out = await run('drain-outbox', {}, { ...drainCtx(w) });
	assert.deepEqual(out, { ran: true });
	assert.equal(w.db.outbox[0].job_status, 'Pending');
});

test('a job moving stage queues exactly one CRM update, only when it came from a deal', async () => {
	const w = makeWorld();
	const make = async (name, extra) => {
		const { job } = await jobs.createJob(w.ctx, { name, ...extra });
		const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: name + ' install' });
		await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'lead' });
		return { job, task };
	};
	const fromDeal = await make('From CRM', { crm_deal_id: 'D42' });
	const manual = await make('Manual job', {});
	const crmRows = () => w.db.outbox.filter((o) => o.job_type === 'crm.update_deal');
	assert.equal(crmRows().length, 0, 'creating tasks does not change the stage');

	for (const { task } of [fromDeal, manual]) {
		await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });
		await tasks.transitionTask(w.ctx, task.ROWID, { to: 'In Progress' });
	}
	assert.equal(w.db.jobs.find((j) => j.name === 'From CRM').stage, 'In Progress');

	assert.equal(crmRows().length, 1, 'one update, and none for the job without a deal');
	const row = crmRows()[0];
	assert.equal(row.job_type, 'crm.update_deal');
	assert.equal(String(row.entity_id), String(fromDeal.job.ROWID));
	assert.deepEqual(JSON.parse(row.payload), { dealId: 'D42', fields: { Job_Stage: 'In Progress' } });
	assert.equal(row.job_status, 'Pending');
});

// ---- the webhook ----

test('webhook: off until a secret is set, and only the right token gets in', () => {
	assert.throws(() => authenticate(undefined, { 'x-webhook-token': 'x' }), (e) => e.status === 503);
	assert.throws(() => authenticate('s3', {}), (e) => e.status === 401);
	assert.throws(() => authenticate('s3', { 'x-webhook-token': 'nope' }), (e) => e.status === 401);
	assert.doesNotThrow(() => authenticate('s3', { 'x-webhook-token': 's3' }));
});

test('webhook: a won deal becomes one job; receiving it twice returns the same job', async () => {
	const w = makeWorld();
	w.db.people.push({ ROWID: '105747000000900007', email: 'owner@x.com', first_name: 'Owen' });
	const ctx = w.as(['admin'], null);
	const deal = { deal_id: 'D100', deal_name: 'Northgate pylon', owner_email: 'Owner@x.com', expected_finish: '2026-12-01' };

	const a = await dealWon(ctx, deal);
	assert.equal(a.created, true);
	assert.equal(w.db.jobs[0].name, 'Northgate pylon');
	assert.equal(w.db.jobs[0].crm_deal_id, 'D100');
	assert.equal(w.db.jobs[0].stage, 'Preparation');
	assert.equal(String(w.db.jobs[0].pm_id), '105747000000900007', 'owner becomes project manager');

	const b = await dealWon(ctx, deal);
	assert.deepEqual(b, { created: false, jobId: a.jobId });
	assert.equal(w.db.jobs.length, 1);
});

test('webhook: bad payloads are refused, and an unknown owner just leaves the manager empty', async () => {
	const w = makeWorld();
	const ctx = w.as(['admin'], null);
	await rejects(dealWon(ctx, { deal_name: 'No id' }), 400);
	await rejects(dealWon(ctx, { deal_id: 'D1', deal_name: 'x', owner_email: 'not-an-email' }), 400);
	const r = await dealWon(ctx, { deal_id: 'D2', deal_name: 'Stranger deal', owner_email: 'nobody@x.com' });
	assert.equal(r.created, true);
	assert.equal(w.db.jobs[0].pm_id, undefined);
});

test('webhook: a closing date in another format is ignored, a datetime keeps its date, the deal still arrives', () => {
	const { dealInput } = require('../lib/services/crmWebhook');
	assert.equal(dealInput.parse({ deal_id: '1', deal_name: 'A', expected_finish: '06/11/2026' }).expected_finish, undefined);
	assert.equal(dealInput.parse({ deal_id: '1', deal_name: 'A', expected_finish: '2026-11-06T10:00:00+05:30' }).expected_finish, '2026-11-06');
	assert.equal(dealInput.parse({ deal_id: '1', deal_name: 'A', expected_finish: '2026-11-06' }).expected_finish, '2026-11-06');
	assert.equal(dealInput.parse({ deal_id: '1', deal_name: 'A' }).expected_finish, undefined);
});

test('webhook secret: the header wins, a body parameter works, and the secret never reaches the deal data', () => {
	const { extractToken, authenticate } = require('../lib/services/crmWebhook');
	let r = extractToken({ 'x-webhook-token': 'H' }, { 'x-webhook-token': 'B', deal_id: '1' });
	assert.equal(r.token, 'H');
	assert.deepEqual(r.body, { deal_id: '1' });
	r = extractToken({}, { 'x-webhook-token': 'B', deal_id: '1', deal_name: 'A' });
	assert.equal(r.token, 'B');
	assert.deepEqual(r.body, { deal_id: '1', deal_name: 'A' });
	assert.equal(extractToken({}, { token: 'T' }).token, 'T');
	assert.equal(extractToken({}, {}).token, undefined);
	assert.equal(extractToken({}, undefined).token, undefined);
	assert.doesNotThrow(() => authenticate('S', { 'x-webhook-token': extractToken({}, { 'x-webhook-token': 'S' }).token }));
	assert.throws(() => authenticate('S', { 'x-webhook-token': extractToken({}, {}).token }), (e) => e.status === 401);
});
