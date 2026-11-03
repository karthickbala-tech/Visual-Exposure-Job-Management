'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const r = require('../lib/domain/reminders');

test('date maths is in whole days, across month and year ends', () => {
	assert.equal(r.daysUntil('2026-12-01', '2026-11-02'), 29);
	assert.equal(r.daysUntil('2026-11-01', '2026-11-02'), -1);
	assert.equal(r.addDays('2026-12-31', 1), '2027-01-01');
	assert.equal(r.addDays('2026-03-01', -1), '2026-02-28');
});

test('offsets are cleaned and fall back to the defaults', () => {
	assert.deepEqual(r.normaliseOffsets([7, 30, 7, -1, 2.5, 'x', 14]), [30, 14, 7]);
	assert.deepEqual(r.normaliseOffsets('[10, 90]'), [90, 10]);
	assert.deepEqual(r.normaliseOffsets('not json'), [30, 14, 7, 0]);
	assert.deepEqual(r.normaliseOffsets([]), [30, 14, 7, 0]);
	assert.deepEqual(r.normaliseOffsets(null), [30, 14, 7, 0]);
});

test('status: valid, expiring inside the widest window, expired, or never expires', () => {
	const t = '2026-11-02';
	assert.equal(r.complianceStatus({ expiryDate: '2027-06-01' }, t), 'Valid');
	assert.equal(r.complianceStatus({ expiryDate: '2026-12-02' }, t), 'Expiring'); // 30 days out
	assert.equal(r.complianceStatus({ expiryDate: '2026-12-03' }, t), 'Valid'); // 31 days out
	assert.equal(r.complianceStatus({ expiryDate: '2026-11-02' }, t), 'Expiring'); // expires today is still valid today
	assert.equal(r.complianceStatus({ expiryDate: '2026-11-01' }, t), 'Expired');
	assert.equal(r.complianceStatus({ expiryDate: '2026-01-01', requiresExpiry: false }, t), 'No expiry');
	assert.equal(r.complianceStatus({ expiryDate: null }, t), 'No expiry');
});

test('each offset fires once, in order, as the days go by', () => {
	const item = { expiryDate: '2026-12-02', offsets: [30, 14, 7, 0] };
	assert.equal(r.dueOffset({ ...item, lastSent: null }, '2026-11-01'), null, '31 days out: nothing yet');
	assert.equal(r.dueOffset({ ...item, lastSent: null }, '2026-11-02'), 30);
	assert.equal(r.dueOffset({ ...item, lastSent: 30 }, '2026-11-02'), null, 'already sent today');
	assert.equal(r.dueOffset({ ...item, lastSent: 30 }, '2026-11-18'), 14);
	assert.equal(r.dueOffset({ ...item, lastSent: 14 }, '2026-11-25'), 7);
	assert.equal(r.dueOffset({ ...item, lastSent: 7 }, '2026-12-02'), 0);
	assert.equal(r.dueOffset({ ...item, lastSent: 0 }, '2026-12-02'), null, 'all offsets used');
	assert.equal(r.dueOffset({ ...item, lastSent: 0 }, '2026-12-03'), null);
});

test('after missed days only the most urgent offset fires, not a burst', () => {
	const item = { expiryDate: '2026-12-02', offsets: [30, 14, 7, 0], lastSent: null };
	assert.equal(r.dueOffset(item, '2026-11-27'), 7, 'job was off for weeks: one reminder, the urgent one');
	assert.equal(r.dueOffset({ ...item, lastSent: 7 }, '2026-11-27'), null, 'the older ones are skipped for good');
});

test('nothing is sent for an expired item or one with no date', () => {
	assert.equal(r.dueOffset({ expiryDate: '2026-10-01', offsets: [30], lastSent: null }, '2026-11-02'), null);
	assert.equal(r.dueOffset({ expiryDate: null, offsets: [30] }, '2026-11-02'), null);
});

test('next reminder date follows what has been sent', () => {
	const item = { expiryDate: '2026-12-02', offsets: [30, 14, 7, 0] };
	assert.equal(r.nextReminderDate({ ...item, lastSent: null }), '2026-11-02');
	assert.equal(r.nextReminderDate({ ...item, lastSent: 30 }), '2026-11-18');
	assert.equal(r.nextReminderDate({ ...item, lastSent: 7 }), '2026-12-02');
	assert.equal(r.nextReminderDate({ ...item, lastSent: 0 }), null);
	assert.equal(r.nextReminderDate({ expiryDate: null, offsets: [30] }), null);
});
