'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const people = require('../lib/services/people');
const dt = require('../lib/services/dataTransfer');
const X = require('../lib/domain/exportCsv');

test('csv cells: quotes, commas and line breaks are escaped; formulas are defused', () => {
	assert.equal(X.cell('plain'), 'plain');
	assert.equal(X.cell('a,b'), '"a,b"');
	assert.equal(X.cell('say "hi"'), '"say ""hi"""');
	assert.equal(X.cell('two\nlines'), '"two\nlines"');
	assert.equal(X.cell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`);
	assert.equal(X.cell('+61 3 9311 5722'), "'+61 3 9311 5722");
	assert.equal(X.cell(null), '');
	assert.equal(X.cell(0), '0');
});

test('export: only the listed columns leave, as CSV (with a download name) or JSON; admin only; bad kind is 400', async () => {
	const w = makeWorld();
	await jobs.createJob(w.ctx, { name: 'Pylon, big', description: 'secret notes' });
	await people.createPerson(w.ctx, { first_name: 'Sam', email: 'sam@example.test', hourly_rate: 95 });

	const csv = await dt.exportEntity(w.ctx, 'jobs', {});
	assert.equal(csv.raw.contentType, 'text/csv; charset=utf-8');
	assert.equal(csv.raw.filename, 'jobs.csv');
	assert.equal(csv.raw.download, true);
	const text = csv.raw.buffer.toString('utf8');
	assert.match(text, /ROWID,name,stage/);
	assert.match(text, /"Pylon, big"/);
	assert.ok(!text.includes('secret notes'), 'description is not an exported column');

	const json = await dt.exportEntity(w.ctx, 'people', { format: 'json' });
	assert.ok(json.items.length >= 1);
	assert.ok(json.items.every((p) => !('hourly_rate' in p)), 'pay rates never leave');
	await rejects(dt.exportEntity(w.ctx, 'secrets', {}), 400);
	await rejects(dt.exportEntity(w.ctx, 'jobs', { format: 'xml' }), 400);
	await rejects(dt.exportEntity(w.as(['project_manager'], null), 'jobs', {}), 403);
});

test('import people: good rows are added, bad and duplicate rows are skipped with a reason, nothing else is touched', async () => {
	const w = makeWorld();
	await people.createPerson(w.ctx, { first_name: 'Existing', email: 'have@example.test' });
	const out = await dt.importPeople(w.ctx, {
		rows: [
			{ first_name: 'Ann', email: 'ann@example.test', roles: ['installer'] },
			{ first_name: 'Dup', email: 'HAVE@example.test' },
			{ first_name: '' },
			{ first_name: 'Bob', roles: ['wizard'] },
			{ first_name: 'Ann Again', email: 'ann@example.test' },
			{ first_name: 'Cy' },
		],
	});
	assert.equal(out.created, 2, 'Ann and Cy');
	assert.deepEqual(out.skipped.map((s) => s.row), [2, 3, 4, 5]);
	assert.match(out.skipped[0].reason, /already exists/);
	assert.match(out.skipped[1].reason, /first_name/);
	assert.ok(w.db.people.some((p) => p.first_name === 'Ann' && JSON.parse(p.roles).includes('installer')));
	await rejects(dt.importPeople(w.ctx, { rows: [] }), 400);
	await rejects(dt.importPeople(w.ctx, { rows: Array.from({ length: 51 }, () => ({ first_name: 'x' })) }), 400);
	await rejects(dt.importPeople(w.as(['project_manager'], null), { rows: [{ first_name: 'x' }] }), 403);
});

test('import companies: same name in any capitals is skipped, kinds are checked', async () => {
	const w = makeWorld();
	const out = await dt.importCompanies(w.ctx, { rows: [{ name: 'Crane Co', kind: 'supplier' }, { name: 'crane co' }, { name: 'Odd', kind: 'martian' }, { name: 'Paint Pty' }] });
	assert.equal(out.created, 2);
	assert.deepEqual(out.skipped.map((s) => s.row), [2, 3]);
	assert.deepEqual(w.db.companies.map((c) => c.name).sort(), ['Crane Co', 'Paint Pty']);
});
