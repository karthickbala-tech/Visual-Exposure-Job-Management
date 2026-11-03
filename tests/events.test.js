'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { publishEvent, MAX_PAYLOAD_CHARS } = require('../lib/publish');
const jobs = require('../lib/jobs/registry');
const events = require('../lib/events/registry');
const { createDb, assertFits, TEXT_MAX } = require('../lib/db');

const silentLog = { info() {}, warn() {}, error() {} };

function fakeApp(captured) {
	return {
		jobScheduling: () => ({
			job: () => ({ submitJob: async (req) => (captured.push(req), { job_id: '1', job_status: 'PENDING' }) }),
		}),
	};
}

test('publishEvent submits an immediate job to the jobs function', async () => {
	const sent = [];
	await publishEvent(fakeApp(sent), 'task.created', { taskId: '123' });
	assert.equal(sent.length, 1);
	const req = sent[0];
	assert.equal(req.target_type, 'Function');
	assert.equal(req.target_name, 'jobs');
	assert.equal(req.params.job, 'dispatch-event');
	assert.equal(req.params.type, 'task.created');
	assert.deepEqual(JSON.parse(req.params.payload), { taskId: '123' });
	assert.match(req.job_name, /^[A-Za-z0-9_]{1,20}$/);
	assert.ok(req.job_config.number_of_retries >= 1, 'retries enabled');
});

test('publishEvent rejects unknown types and oversized payloads', async () => {
	await assert.rejects(publishEvent(fakeApp([]), 'nope', {}), /Unknown event type/);
	await assert.rejects(
		publishEvent(fakeApp([]), 'task.created', { blob: 'x'.repeat(MAX_PAYLOAD_CHARS) }),
		/ids, not data/
	);
});

test('dispatch-event job routes to the event dispatcher and tolerates missing handlers', async () => {
	const res = await jobs.run('dispatch-event', { type: 'task.created', payload: '{"taskId":"1"}' }, { log: silentLog });
	assert.deepEqual(res, { ran: true });

	let seen;
	events.handlers['task.assigned'] = async (payload) => (seen = payload);
	await jobs.run('dispatch-event', { type: 'task.assigned', payload: '{"taskId":"9"}' }, { log: silentLog });
	assert.deepEqual(seen, { taskId: '9' });
	delete events.handlers['task.assigned'];
});

test('dispatch survives a malformed payload and an unknown type', async () => {
	assert.deepEqual(await jobs.run('dispatch-event', { type: 'task.created', payload: '{oops' }, { log: silentLog }), { ran: true });
	const out = await events.dispatch('not.real', {}, { log: silentLog });
	assert.equal(out.handled, false);
});

test('unknown job names are ignored, not thrown', async () => {
	assert.deepEqual(await jobs.run('nope', {}, { log: silentLog }), { ran: false, reason: 'unknown_job' });
	assert.deepEqual(await jobs.run('mdm-sync', {}, { log: silentLog }), { ran: false, reason: 'no_handler' });
});

test('values over the 10,000 character column limit are rejected before saving', async () => {
	assert.doesNotThrow(() => assertFits([{ a: 'x'.repeat(TEXT_MAX) }], 'job'));
	assert.throws(() => assertFits([{ answers: 'x'.repeat(TEXT_MAX + 1) }], 'checklist'), /checklist\.answers is 10001/);

	const app = { datastore: () => ({ table: () => ({ insertRows: async () => 'saved' }) }) };
	const db = createDb(app);
	await assert.rejects(db.insert('checklist', { answers: 'y'.repeat(TEXT_MAX + 1) }), (e) => e.status === 413);
});
