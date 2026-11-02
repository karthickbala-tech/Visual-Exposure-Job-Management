'use strict';

const { forbidden } = require('../errors');
const { TEMPLATES } = require('../seed/checklistTemplates');

/**
 * Insert any seed checklist template that is not there yet. Safe to run many times:
 * existing templates are never changed (a new wording is a new version, not an edit).
 * Admin only. Used to set up a fresh Catalyst project (for example the AU production one).
 */
async function seedChecklistTemplates(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can load templates');
	const added = [];
	const skipped = [];
	for (const t of TEMPLATES) {
		if (await ctx.repos.templates.findByKey(t.template_key)) {
			skipped.push(t.template_key);
			continue;
		}
		await ctx.repos.templates.insert({ ...t, definition: JSON.stringify(t.definition), is_active: 'true' });
		added.push(t.template_key);
	}
	return { added, skipped };
}

module.exports = { seedChecklistTemplates };
