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

test('install has a pre and a post template for leaders and members', () => {
	const have = new Set(TEMPLATES.map((t) => `${t.phase}.${t.assignee_role}`));
	assert.deepEqual([...have].sort(), ['post.lead', 'post.member', 'pre.lead', 'pre.member']);
});
