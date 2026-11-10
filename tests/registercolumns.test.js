'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRepos, registerIn, registerOut } = require('../lib/repos');

test('register items: the short names the code uses are translated to the real column names and back', async () => {
	assert.deepEqual(registerIn({ kind: 'equipment', type: 'Drill', status: 'In service', data: '{}', name: 'X' }), { item_kind: 'equipment', item_type: 'Drill', item_status: 'In service', item_data: '{}', name: 'X' });
	assert.deepEqual(registerIn([{ status: 'Off hire' }]), [{ item_status: 'Off hire' }]);
	const out = registerOut({ ROWID: '1', item_kind: 'chemical', item_status: 'In use', item_type: null, item_data: '{"a":1}' });
	assert.equal(out.kind, 'chemical');
	assert.equal(out.status, 'In use');
	assert.equal(out.data, '{"a":1}');

	// the repo must ask the database for the real column in its WHERE and write the real columns
	const seen = [];
	const db = {
		select: async (_t, o) => { seen.push(o.where); return [{ ROWID: '1', item_kind: 'equipment', item_status: 'In service', code: 'T-1' }]; },
		insert: async (_t, row) => { seen.push(Object.keys(row).sort().join(',')); return [{ ROWID: '2', ...row }]; },
		update: async (_t, row) => { seen.push(Object.keys(row).sort().join(',')); return row; },
		selectOne: async () => null,
	};
	const repos = createRepos(db);
	const rows = await repos.registerItems.list({ kind: 'equipment' });
	assert.match(seen[0], /item_kind = 'equipment'/);
	assert.equal(rows[0].kind, 'equipment');
	const made = await repos.registerItems.insert({ kind: 'equipment', name: 'N', status: 'In service' });
	assert.equal(seen[1], 'item_kind,item_status,name');
	assert.equal(made.status, 'In service');
	await repos.registerItems.update({ ROWID: '2', status: 'Off hire' });
	assert.equal(seen[2], 'ROWID,item_status');
});
