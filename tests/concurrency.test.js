'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const { sameValue, changedFields } = require('../lib/domain/concurrency');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');

test('concurrency: values that mean the same are the same', () => {
	assert.ok(sameValue(null, ''));
	assert.ok(sameValue(undefined, '  '));
	assert.ok(sameValue('5.00', 5));
	assert.ok(sameValue('2026-12-01', '2026-12-01 00:00:00'));
	assert.ok(sameValue(true, 'true'));
	assert.ok(!sameValue('2026-12-01', '2026-12-02'));
	assert.ok(!sameValue('', 'x'));
	assert.ok(!sameValue('Fit', 'Fit sign'));
});

test('concurrency: only the fields the form is changing are compared; spec keys one by one', () => {
	const row = { name: 'Fit', quoted_hours: '4', spec: JSON.stringify({ material: 'ACM', width: 1200 }) };
	assert.deepEqual(changedFields(row, { name: 'Fit', quoted_hours: 4 }), []);
	assert.deepEqual(changedFields(row, { name: 'Old', spec: { material: 'ACM', width: 900 } }), ['name', 'spec.width']);
	assert.deepEqual(changedFields(row, { name: 'Old' }, ['name']), []);
});

test('concurrency: a task edit is refused when someone else changed the same field, and allowed otherwise', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	const id = String((await tasks.createTask(w.ctx, job, { task_type: 'install', name: 'Fit', kind: 'VE Install' })).task.ROWID);

	// Two managers open the task; the first renames it.
	await tasks.updateTask(w.ctx, id, { name: 'Fit sign', expected: { name: 'Fit' } });
	// The second still sees "Fit": their rename is refused, nothing is saved.
	const err = await rejects(tasks.updateTask(w.ctx, id, { name: 'Fit panel', expected: { name: 'Fit' } }), 409);
	assert.equal(err.code, 'changed_elsewhere');
	assert.deepEqual(err.details.fields, ['name']);
	assert.equal(w.db.tasks.find((t) => String(t.ROWID) === id).name, 'Fit sign');
	// A field nobody else touched still saves, and the server touching the row (booked hours) does not block it.
	w.db.tasks.find((t) => String(t.ROWID) === id).booked_hours = '3';
	assert.ok((await tasks.updateTask(w.ctx, id, { description: 'Front', expected: { description: '' } })).task);
	// Without `expected` (older clients) the edit is saved as before.
	assert.ok((await tasks.updateTask(w.ctx, id, { name: 'Fit panel' })).task);
});

test('concurrency: a job edit is refused when someone else changed the same field', async () => {
	const w = makeWorld();
	const id = String((await jobs.createJob(w.ctx, { name: 'J', expected_finish: '2026-12-01', server_path: 'S:\\Jobs\\J' })).job.ROWID);
	await jobs.updateJob(w.ctx, id, { expected_finish: '2026-12-05', expected: { expected_finish: '2026-12-01' } });
	await rejects(jobs.updateJob(w.ctx, id, { expected_finish: '2026-12-09', expected: { expected_finish: '2026-12-01' } }), 409);
	// The yes/no marks live in the flags text and are not compared.
	assert.ok((await jobs.updateJob(w.ctx, id, { closure_email_sent: true, expected: { closure_email_sent: false, expected_finish: '2026-12-05' } })).job);
});

test('a fab spec edit changes only the fields sent; an empty one is removed', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	const id = String((await tasks.createTask(w.ctx, job, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' })).task.ROWID);
	const row = () => JSON.parse(w.db.tasks.find((t) => String(t.ROWID) === id).spec);
	const keys = Object.keys(require('../lib/domain/fab').SPEC_FIELDS.CNC);
	const [a, b] = keys;
	const val = (k, n) => (require('../lib/domain/fab').SPEC_FIELDS.CNC[k] === 'number' ? n : 'v' + n);
	await tasks.updateTask(w.ctx, id, { spec: { [a]: val(a, 1), [b]: val(b, 2) } });
	await tasks.updateTask(w.ctx, id, { spec: { [b]: val(b, 3) } });
	assert.deepEqual(row(), { [a]: val(a, 1), [b]: val(b, 3) });
	await tasks.updateTask(w.ctx, id, { spec: { [a]: null } });
	assert.deepEqual(row(), { [b]: val(b, 3) });
});
