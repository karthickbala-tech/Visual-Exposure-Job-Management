'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { esc, ident, toBool, withBooleans, unwrap, inList, createDb, NOT_DELETED } = require('../lib/db');
const { withRetry } = require('../lib/retry');
const { createRouter, normalizePath, parseQuery } = require('../lib/http');
const { parse, schemas, z } = require('../lib/validate');
const { AppError } = require('../lib/errors');
const { mapCatalystRole } = require('../lib/identity');

test('esc doubles single quotes and backslashes (no injection)', () => {
	assert.equal(esc("O'Brien"), "O''Brien");
	assert.equal(esc("x' OR '1'='1"), "x'' OR ''1''=''1");
	assert.equal(esc('a\\b'), 'a\\\\b');
});

test('ident only allows plain identifiers', () => {
	assert.equal(ident('person'), 'person');
	assert.throws(() => ident('person; DROP TABLE x'));
	assert.throws(() => ident('a-b'));
	assert.throws(() => ident(''));
});

test('booleans come back as strings and are converted', () => {
	assert.equal(toBool('true'), true);
	assert.equal(toBool('false'), false);
	assert.equal(toBool(undefined), false);
	assert.deepEqual(withBooleans({ a: 'false', b: 'true', c: 'x' }, ['a', 'b']), { a: false, b: true, c: 'x' });
});

test('unwrap pulls rows out of ZCQL table wrappers', () => {
	assert.deepEqual(unwrap([{ job: { name: 'a' } }, { job: { name: 'b' } }, {}], 'job'), [{ name: 'a' }, { name: 'b' }]);
	assert.deepEqual(unwrap(null, 'job'), []);
});

test('inList builds a safe, de-duplicated list or null', () => {
	assert.equal(inList([]), null);
	assert.equal(inList(['1', '1', '2']), "('1', '2')");
	assert.equal(inList(["1'); DROP"]), "('1''); DROP')");
});

test('select builds SQL with a hard cap of 300 rows', async () => {
	const seen = [];
	const app = { zcql: () => ({ executeZCQLQuery: async (sql) => (seen.push(sql), [{ job: { name: 'x' } }]) }) };
	const db = createDb(app);
	const rows = await db.select('job', { where: NOT_DELETED, orderBy: 'CREATEDTIME DESC', limit: 9999, offset: 5 });
	assert.deepEqual(rows, [{ name: 'x' }]);
	assert.equal(seen[0], "SELECT * FROM job WHERE is_deleted = 'false' ORDER BY CREATEDTIME DESC LIMIT 5, 300");
});

test('insert defaults is_deleted to false on soft-delete tables only', async () => {
	const inserted = {};
	const app = {
		datastore: () => ({ table: (t) => ({ insertRows: async (rows) => (inserted[t] = rows) }) }),
	};
	const db = createDb(app);
	await db.insert('job', { name: 'J' });
	await db.insert('activity', { entity_type: 'job' });
	assert.equal(inserted.job[0].is_deleted, 'false');
	assert.equal('is_deleted' in inserted.activity[0], false);
});

test('withRetry retries with exponential backoff then succeeds', async () => {
	const waits = [];
	let calls = 0;
	const result = await withRetry(
		async () => {
			calls++;
			if (calls < 3) throw new Error('boom');
			return 'ok';
		},
		{ retries: 4, baseMs: 100, wait: async (ms) => waits.push(ms) }
	);
	assert.equal(result, 'ok');
	assert.deepEqual(waits, [100, 200]);
});

test('withRetry gives up after the last attempt and respects shouldRetry', async () => {
	let calls = 0;
	await assert.rejects(
		withRetry(async () => (calls++, Promise.reject(new Error('x'))), { retries: 3, wait: async () => {} }),
		/x/
	);
	assert.equal(calls, 3);

	calls = 0;
	await assert.rejects(
		withRetry(async () => (calls++, Promise.reject(new Error('400'))), {
			retries: 5,
			shouldRetry: () => false,
			wait: async () => {},
		}),
		/400/
	);
	assert.equal(calls, 1);
});

test('router matches methods, params and trailing slashes', () => {
	const r = createRouter();
	const h = () => {};
	r.add('GET', '/jobs/:id', h);
	r.add('GET', '/jobs', h);
	assert.equal(r.match('GET', '/jobs').params.id, undefined);
	assert.equal(r.match('GET', '/jobs/123/').params.id, '123');
	assert.equal(r.match('POST', '/jobs'), null);
	assert.equal(r.has('/jobs'), true);
	assert.equal(r.has('/nope'), false);
});

test('normalizePath strips the mount prefix and query string', () => {
	assert.equal(normalizePath('/server/api/jobs?x=1'), '/jobs');
	assert.equal(normalizePath('/api/health'), '/health');
	assert.equal(normalizePath('/server/api'), '/');
	assert.deepEqual(parseQuery('/jobs?stage=Completed&limit=5'), { stage: 'Completed', limit: '5' });
});

test('validation returns a 400 AppError with field details', () => {
	const schema = z.object({ n: z.number() });
	assert.deepEqual(parse(schema, { n: 1 }), { n: 1 });
	try {
		parse(schema, { n: 'x' });
		assert.fail('should throw');
	} catch (e) {
		assert.ok(e instanceof AppError);
		assert.equal(e.status, 400);
		assert.equal(e.details[0].path, 'n');
	}
});

test('pagination schema applies defaults and caps', () => {
	assert.deepEqual(parse(schemas.pagination, {}), { limit: 50, offset: 0 });
	assert.throws(() => parse(schemas.pagination, { limit: '1000' }));
});

test('Catalyst roles map to ours; unknown roles map to null', () => {
	assert.equal(mapCatalystRole('App Administrator'), 'admin');
	assert.equal(mapCatalystRole('project_manager'), 'project_manager');
	assert.equal(mapCatalystRole('App User'), null);
	assert.equal(mapCatalystRole(undefined), null);
});
