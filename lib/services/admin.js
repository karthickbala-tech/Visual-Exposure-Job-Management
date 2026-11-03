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
	// One query to see what exists and one insert for what is missing, not a query and an insert per template.
	const have = new Set(await ctx.repos.templates.existingKeys(TEMPLATES.map((t) => t.template_key)));
	const missing = TEMPLATES.filter((t) => !have.has(t.template_key));
	await ctx.repos.templates.insertMany(missing.map((t) => ({ ...t, definition: JSON.stringify(t.definition), is_active: 'true' })));
	return { added: missing.map((t) => t.template_key), skipped: TEMPLATES.filter((t) => have.has(t.template_key)).map((t) => t.template_key) };
}

module.exports = { seedChecklistTemplates };
