'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const hours = require('../lib/services/hours');
const { makeWorld, rejects } = require('./helpers');

test('hours range: lists each day of a custom range, refuses a reversed or over-long one', async () => {
	const w = makeWorld();
	const r = await hours.weeklyHours(w.ctx, { from: '2026-11-01', to: '2026-11-08' });
	assert.equal(r.days.length, 8);
	assert.equal(r.days[0], '2026-11-01');
	await rejects(hours.weeklyHours(w.ctx, { from: '2026-11-08', to: '2026-11-01' }), 400);
	await rejects(hours.weeklyHours(w.ctx, { from: '2026-01-01', to: '2026-12-01' }), 400);
});
