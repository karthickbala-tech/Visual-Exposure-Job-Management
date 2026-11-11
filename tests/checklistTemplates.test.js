'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATES } = require('../lib/seed/checklistTemplates');
const { validateDefinition, activeQuestions } = require('../lib/domain/checklistProgress');

const find = (key) => TEMPLATES.find((t) => t.template_key === key);
const keysOf = (t, answers = {}) => activeQuestions(t.definition, answers).map((q) => q.key);

test('every template is valid and keys are unique', () => {
	const keys = TEMPLATES.map((t) => t.template_key);
	assert.equal(new Set(keys).size, keys.length);
	for (const t of TEMPLATES) assert.deepEqual(validateDefinition(t.definition), [], t.template_key);
});

test('version 2 splits the questions between team leader and team member (docs/DS_CHECKLIST_RULES.md)', () => {
	const lead = keysOf(find('install.pre.lead@2'));
	const member = keysOf(find('install.pre.member@2'));
	assert.ok(lead.includes('subcontractors') && lead.includes('access_equipment'), 'only the leader is asked about subcontractors and access equipment');
	assert.ok(!member.includes('subcontractors') && member.includes('checked_in'));
	assert.ok(keysOf(find('install.post.lead@2')).includes('briefing_rating'), 'the leader rates the briefing');
	assert.ok(!keysOf(find('install.post.member@2')).includes('briefing_rating'), 'a member does not');
	assert.ok(keysOf(find('fabrication.pre.lead@2')).includes('quality_clear') && !keysOf(find('fabrication.pre.member@2')).includes('quality_clear'));
});

test('WHS and OH&S details are only asked after a yes', () => {
	const t = find('install.post.lead@2');
	assert.ok(!keysOf(t, { whs_issues: 'no' }).includes('whs_details'));
	assert.ok(keysOf(t, { whs_issues: 'yes' }).includes('whs_details'));
});

test('version 3: a Yes to the management review raises an issue on install post-job checklists only', () => {
	const { progressOf } = require('../lib/domain/checklistProgress');
	for (const role of ['lead', 'member']) {
		const t = find(`install.post.${role}@3`);
		assert.equal(t.version_no, 3);
		const answers = { whs_issues: 'no', area_cleaned: 'yes', management_review: 'yes' };
		assert.deepEqual(progressOf(t.definition, answers).issues, ['management_review']);
		assert.deepEqual(progressOf(t.definition, { ...answers, management_review: 'no' }).issues, []);
	}
	assert.equal(find('fabrication.post.lead@2').definition.sections[0].questions.find((q) => q.key === 'management_review').raiseIssueOn, undefined);
});
