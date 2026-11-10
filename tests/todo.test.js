'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const { todoItems } = require('../lib/domain/todo');
const dashboard = require('../lib/services/dashboard');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const issues = require('../lib/services/issues');

test('the to-do list is empty when nothing needs a person', () => {
	assert.deepEqual(todoItems({ today: '2026-11-10' }), []);
});

test('the to-do list names up to 3 items per kind, folds the rest, and puts the urgent first', () => {
	const t = (n, type = 'fabrication') => ({ ROWID: String(n), name: 'Task ' + n, task_type: type });
	const out = todoItems({
		today: '2026-11-10',
		swms: [{ swms_status: 'Created' }, { swms_status: 'PM Signed' }],
		reviewTasks: [t(1), t(2), t(3), t(4), t(5)],
		scheduleTasks: [t(6, 'install')],
		issues: [
			{ ROWID: '9', subject: 'Wet floor', issue_priority: 'High', issue_status: 'To Be discussed', department: 'Install' },
			{ ROWID: '10', subject: 'Minor', issue_priority: 'Low', issue_status: 'To Be discussed' },
			{ ROWID: '11', subject: 'Closed one', issue_priority: 'High', issue_status: 'Completed' },
		],
		compliance: [{ expiry_date: '2026-11-01' }, { expiry_date: '2026-11-10' }, { expiry_date: '2026-12-01' }],
		overdueTasks: 2,
	});
	const ids = out.map((i) => i.id);
	assert.equal(out.filter((i) => i.id.startsWith('review-')).length, 4, '3 named plus one "more" line');
	assert.ok(ids.includes('review-more') && out.find((i) => i.id === 'review-more').title.startsWith('2 more'));
	assert.ok(!ids.includes('issue-10') && !ids.includes('issue-11'), 'only open high priority issues');
	assert.equal(out.find((i) => i.id === 'expired').title, '1 compliance item has expired');
	assert.equal(out.find((i) => i.id === 'soon').title, '2 compliance items expire within 30 days');
	assert.equal(out.find((i) => i.id === 'swms').detail, '1 not signed yet, 1 signed by the project manager only');
	const tones = out.map((i) => i.tone);
	assert.deepEqual(tones, [...tones].sort((a, b) => ({ danger: 0, warn: 1, info: 2 }[a] - { danger: 0, warn: 1, info: 2 }[b])), 'danger, then warn, then info');
	assert.equal(out[out.length - 1].id, 'schedule-6');
});

test('getTodo gathers the live data for a manager and refuses crew', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'Pylon' })).job.ROWID);
	const t = (await tasks.createTask(w.ctx, job, { task_type: 'install', name: 'Fit', kind: 'VE Install' })).task;
	await issues.createIssue(w.ctx, { subject: 'Ladder broken', department: 'Install', issue_priority: 'High' });
	const out = await dashboard.getTodo(w.ctx);
	assert.ok(out.total >= 3);
	assert.ok(out.items.some((i) => i.id === 'swms'), 'the new install task has an unsigned SWMS');
	assert.ok(out.items.some((i) => i.id === 'schedule-' + t.ROWID));
	assert.ok(out.items.some((i) => i.title.includes('Ladder broken')));
	await rejects(dashboard.getTodo(w.as(['installer'], '105747000000900003')), 403);
});
