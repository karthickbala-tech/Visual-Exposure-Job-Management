'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runOnce, onceKey, stable, WINDOW_MS } = require('../lib/idempotency');
const { createCache } = require('../lib/cache');

/** A Catalyst-like cache segment: put fails when the key exists. Counts gets and puts. */
function fakeApp() {
	const store = new Map();
	const counts = { get: 0, put: 0 };
	const seg = {
		put: async (k, v) => {
			counts.put++;
			if (store.has(k)) throw new Error('exists');
			store.set(k, v);
		},
		update: async (k, v) => {
			counts.put++;
			store.set(k, v);
		},
		getValue: async (k) => {
			counts.get++;
			return store.get(k) || null;
		},
		delete: async (k) => store.delete(k),
	};
	return { app: { cache: () => ({ segment: () => seg }) }, store, counts };
}

const ctxAt = (cache, ms, person = '1') => ({ cache, actor: { person: { ROWID: person } }, now: () => new Date(ms) });

test('idempotency: the same create from the same person within two minutes runs once and answers the same', async () => {
	const { app, counts } = fakeApp();
	const cache = createCache(app, 'kpi');
	let made = 0;
	const create = async () => ({ issue: { ROWID: String(++made) } });
	const t0 = 1_000_000;
	const a = await runOnce(ctxAt(cache, t0), '/issues', { subject: 'Bracket', department: 'Install' }, create);
	assert.equal(counts.get, 0, 'the first create costs no cache get');
	const b = await runOnce(ctxAt(cache, t0 + 5000), '/issues', { department: 'Install', subject: 'Bracket' }, create);
	assert.equal(made, 1);
	assert.deepEqual(b, a, 'the repeat gets the first answer');
	// someone else, other fields, or after the window: a new record
	await runOnce(ctxAt(cache, t0 + 6000, '2'), '/issues', { subject: 'Bracket', department: 'Install' }, create);
	await runOnce(ctxAt(cache, t0 + 7000), '/issues', { subject: 'Bolt', department: 'Install' }, create);
	await runOnce(ctxAt(cache, t0 + WINDOW_MS + 1000), '/issues', { subject: 'Bracket', department: 'Install' }, create);
	assert.equal(made, 4);
});

test('idempotency: a copy still running is told to wait; a failed create can be tried again', async () => {
	const { app } = fakeApp();
	const cache = createCache(app, 'kpi');
	let release;
	const slow = runOnce(ctxAt(cache, 0), '/jobs', { name: 'J' }, () => new Promise((r) => (release = r)));
	await new Promise((r) => setImmediate(r));
	await assert.rejects(runOnce(ctxAt(cache, 1000), '/jobs', { name: 'J' }, async () => ({})), (e) => e.status === 409 && e.code === 'in_progress');
	release({ job: { ROWID: '9' } });
	await slow;

	let tries = 0;
	const failing = async () => {
		tries++;
		throw Object.assign(new Error('bad'), { status: 400 });
	};
	await assert.rejects(runOnce(ctxAt(cache, 0), '/people', { first_name: 'A' }, failing));
	await assert.rejects(runOnce(ctxAt(cache, 1000), '/people', { first_name: 'A' }, failing));
	assert.equal(tries, 2);
});

test('idempotency: without a usable cache the create just runs; keys ignore field order', async () => {
	let made = 0;
	await runOnce({ actor: {} }, '/jobs', {}, async () => made++);
	await runOnce({ actor: {}, cache: { claim: async () => null, set: async () => {}, clear: async () => {} } }, '/jobs', {}, async () => made++);
	await runOnce({ actor: {}, cache: { claim: async () => null, set: async () => {}, clear: async () => {} } }, '/jobs', {}, async () => made++);
	assert.equal(made, 3);
	assert.equal(stable({ b: 1, a: [2, { d: 1, c: 2 }] }), stable({ a: [2, { c: 2, d: 1 }], b: 1 }));
	assert.ok(onceKey({ person: { ROWID: '1' } }, '/jobs', {}).length <= 50);
});
