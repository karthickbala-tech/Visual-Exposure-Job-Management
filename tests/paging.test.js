'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchAll } = require('../lib/paging');

const source = (n) => {
	const rows = Array.from({ length: n }, (_, i) => ({ ROWID: String(i) }));
	const calls = [];
	const fetchPage = async ({ limit, offset }) => {
		calls.push(offset);
		return rows.slice(offset, offset + limit);
	};
	return { fetchPage, calls };
};

test('fetchAll reads page by page until a short page, one fetch for a small list', async () => {
	const small = source(12);
	assert.deepEqual((await fetchAll(small.fetchPage)).rows.length, 12);
	assert.deepEqual(small.calls, [0], 'a list under 300 rows is one fetch');

	const big = source(650);
	const r = await fetchAll(big.fetchPage);
	assert.equal(r.rows.length, 650);
	assert.equal(r.truncated, false);
	assert.deepEqual(big.calls, [0, 300, 600]);
});

test('fetchAll stops at the ceiling and says so', async () => {
	const huge = source(1000);
	const r = await fetchAll(huge.fetchPage, { maxPages: 2 });
	assert.equal(r.rows.length, 600);
	assert.equal(r.truncated, true);
});
