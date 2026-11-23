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

test("a person's task links and a page's crew are read in full, page by page", async () => {
	const { createRepos } = require('../lib/repos');
	const links = Array.from({ length: 650 }, (_, i) => ({ ROWID: String(i), person_id: '7', task_id: String(i) }));
	const asked = [];
	const db = {
		select: async (_t, { limit, offset, orderBy }) => {
			asked.push(orderBy);
			return links.slice(offset, offset + limit);
		},
	};
	const repos = createRepos(db);
	assert.equal((await repos.assignees.listForPerson('7')).length, 650, 'all 650, not the first 300');
	assert.equal((await repos.assignees.listForTasks(links.map((l) => l.task_id))).length, 650);
	assert.ok(asked.every((o) => o === 'ROWID ASC'), 'a unique order, so paging never skips or repeats a row');
});

test("a person's finished post-job checklists are read in full (hours not filled)", async () => {
	const { createRepos } = require('../lib/repos');
	const rows = Array.from({ length: 450 }, (_, i) => ({ ROWID: String(i) }));
	const repos = createRepos({ select: async (_t, { limit, offset }) => rows.slice(offset, offset + limit) });
	assert.equal((await repos.checklists.listDonePostForPerson('7')).length, 450);
});
