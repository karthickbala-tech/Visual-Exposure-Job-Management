'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { splitPayHours } = require('../lib/domain/payRules');
const { labourCost, effectiveHours, variance } = require('../lib/domain/labourCost');

// 2026-11-02 is a Monday, 2026-11-07 a Saturday, 2026-11-08 a Sunday.
const shift = (date, start, end, extra = {}) => splitPayHours({ date, start, end, ...extra });

test('weekday: a normal 8 h day is all single time', () => {
	assert.deepEqual(shift('2026-11-02', '07:00', '15:00'), { single: 8, x1_5: 0, x2: 0, total: 8 });
});

test('weekday: 8 h single, then 2 h x1.5, then double inside the window', () => {
	// 06:00-18:00 is 12 h inside the window: 8 + 2 + 2.
	assert.deepEqual(shift('2026-11-02', '06:00', '18:00'), { single: 8, x1_5: 2, x2: 2, total: 12 });
});

test('weekday: time outside 06:00-18:00 is double', () => {
	// 05:00-07:00: one hour before the window (x2), one inside (single).
	assert.deepEqual(shift('2026-11-02', '05:00', '07:00'), { single: 1, x1_5: 0, x2: 1, total: 2 });
	assert.deepEqual(shift('2026-11-02', '17:00', '20:00'), { single: 1, x1_5: 0, x2: 2, total: 3 });
});

test('saturday: first 2 h x1.5 then double', () => {
	assert.deepEqual(shift('2026-11-07', '07:00', '12:00'), { single: 0, x1_5: 2, x2: 3, total: 5 });
	assert.deepEqual(shift('2026-11-07', '07:00', '08:00'), { single: 0, x1_5: 1, x2: 0, total: 1 });
});

test('sunday and public holidays are double all day', () => {
	assert.deepEqual(shift('2026-11-08', '08:00', '12:00'), { single: 0, x1_5: 0, x2: 4, total: 4 });
	assert.deepEqual(shift('2026-11-02', '08:00', '12:00', { isPublicHoliday: true }), { single: 0, x1_5: 0, x2: 4, total: 4 });
});

test('breaks come off double first, then x1.5, then single', () => {
	// 06:00-18:00 = 8 / 2 / 2 hours. A 3 h break removes 2 h double and 1 h of x1.5.
	assert.deepEqual(shift('2026-11-02', '06:00', '18:00', { breakMinutes: 180 }), { single: 8, x1_5: 1, x2: 0, total: 9 });
	// A normal 30 min break on an 8 h single day.
	assert.deepEqual(shift('2026-11-02', '07:00', '15:00', { breakMinutes: 30 }), { single: 7.5, x1_5: 0, x2: 0, total: 7.5 });
});

test('minutes are exact, with no float drift', () => {
	const r = shift('2026-11-02', '07:10', '07:40');
	assert.equal(r.total, 0.5);
});

test('bad input is refused', () => {
	assert.throws(() => shift('2026-11-02', '9:00', '15:00'), RangeError);
	assert.throws(() => shift('2026-11-02', '15:00', '09:00'), RangeError);
	assert.throws(() => shift('2026-11-02', '09:00', '10:00', { breakMinutes: 90 }), RangeError);
	assert.throws(() => shift('2026-11-02', '09:00', '10:00', { breakMinutes: -5 }), RangeError);
});

test('labour cost is hours x rate, bad numbers cost nothing', () => {
	assert.equal(labourCost(7.5, 40), 300);
	assert.equal(labourCost(0.1 + 0.2, 10), 3);
	assert.equal(labourCost('x', 40), 0);
	assert.equal(labourCost(-1, 40), 0);
});

test('effective hours and variance use the multipliers', () => {
	const pay = { single: 8, x1_5: 2, x2: 2 };
	assert.equal(effectiveHours(pay), 15);
	assert.equal(variance(20, pay), 5);
	assert.equal(variance(10, pay), -5);
});
