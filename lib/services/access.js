'use strict';

const { can } = require('../authz');
const { forbidden, notFound } = require('../errors');

/** Throw 403 unless the actor may perform `verb` on `resource`. Returns the grant. */
function requireGrant(actor, resource, verb) {
	const grant = can(actor.roles, resource, verb, actor.matrix);
	if (!grant.allowed) throw forbidden();
	return grant;
}

/** Ids of tasks assigned to the actor (empty when the actor has no person record). */
async function assignedTaskIds(ctx) {
	const person = ctx.actor.person;
	if (!person) return [];
	const links = await ctx.repos.assignees.listForPerson(person.ROWID);
	return links.map((l) => String(l.task_id));
}

/**
 * Check access to one task. Scope 'assigned' roles may only touch tasks assigned to them;
 * for anyone else the task looks like it does not exist (no information leak).
 * Returns { grant, isAssignee, assigneeLinks }.
 */
async function taskAccess(ctx, task, verb) {
	const grant = requireGrant(ctx.actor, 'tasks', verb);
	const person = ctx.actor.person;
	const links = await ctx.repos.assignees.listForTask(task.ROWID);
	const isAssignee = !!person && links.some((l) => String(l.person_id) === String(person.ROWID));
	if (grant.scope !== 'all' && !isAssignee) throw notFound('Task not found');
	return { grant, isAssignee, assigneeLinks: links };
}

module.exports = { requireGrant, assignedTaskIds, taskAccess };
