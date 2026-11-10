'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inView, sortForList, TABS } = require('../lib/domain/jobList');

test('All open jobs leaves out Completed, Cancelled and On Hold (Creator rule)', () => {
	assert.ok(TABS.includes('all_open'));
	const stages = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];
	const shown = stages.filter((s) => inView({ stage: s }, 'all_open', null));
	assert.deepEqual(shown, ['Preparation', 'In Progress', 'Completed - Closed']);
});

test('the list is newest added first, then name, then stage', () => {
	const jobs = [
		{ name: 'B', stage: 'In Progress', CREATEDTIME: '2026-01-02T00:00:00' },
		{ name: 'A', stage: 'Preparation', CREATEDTIME: '2026-01-05T00:00:00' },
		{ name: 'A', stage: 'Completed', CREATEDTIME: '2026-01-05T00:00:00' },
	];
	assert.deepEqual(sortForList(jobs).map((j) => `${j.name}/${j.stage}`), ['A/Completed', 'A/Preparation', 'B/In Progress']);
	assert.equal(jobs[0].name, 'B', 'input is not reordered');
});
