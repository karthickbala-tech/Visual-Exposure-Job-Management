'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATES } = require('../lib/seed/checklistTemplates');
const { validateDefinition } = require('../lib/domain/checklistProgress');

test('every seed template is valid, fits its column and has a unique key', () => {
	const keys = new Set();
	for (const t of TEMPLATES) {
		assert.deepEqual(validateDefinition(t.definition), [], t.template_key);
		assert.ok(JSON.stringify(t.definition).length < 9000, `${t.template_key} fits the 10,000 character column`);
		assert.ok(t.template_key.endsWith(`@${t.version_no}`), 'key carries its version');
		assert.ok(!keys.has(t.template_key), 'unique key');
		keys.add(t.template_key);
	}
});

test('every task type has a pre and a post template for leaders and members', () => {
	for (const type of ['design', 'fabrication', 'install']) {
	const have = new Set(TEMPLATES.filter((t) => t.task_type === type).map((t) => `${t.phase}.${t.assignee_role}`));
	assert.deepEqual([...have].sort(), ['post.lead', 'post.member', 'pre.lead', 'pre.member'], type);
	}
});

test('seeding adds only missing templates and can be repeated', async () => {
	const { makeWorld, rejects } = require('./helpers');
	const { seedChecklistTemplates } = require('../lib/services/admin');
	const w = makeWorld();
	w.db.templates.push({ template_key: TEMPLATES[0].template_key });
	const first = await seedChecklistTemplates(w.ctx);
	assert.equal(first.skipped.length, 1);
	assert.equal(first.added.length, TEMPLATES.length - 1);
	assert.equal((await seedChecklistTemplates(w.ctx)).added.length, 0);
	assert.equal(typeof w.db.templates[1].definition, 'string', 'stored as JSON text');
	await rejects(seedChecklistTemplates(w.as(['project_manager'])), 403);
});
