'use strict';

const { projectRow } = require('../authz');
const { AppError, notFound, forbidden } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { STATUSES, PRIORITIES, canMove, nextStatuses, isClosed, departmentFor } = require('../domain/issues');
const { toDbDateTime } = require('../time');
const { requireGrant } = require('./access');

const rowId = schemas.rowId;

const createInput = z.object({
	subject: z.string().trim().min(1).max(255),
	description: z.string().max(9000).optional(),
	task_id: rowId.optional(),
	site_id: rowId.optional(),
	issue_priority: z.enum(PRIORITIES).default('Normal'),
});
const updateInput = z
	.object({
		issue_status: z.enum(STATUSES),
		issue_priority: z.enum(PRIORITIES),
		assigned_to_id: rowId.nullable(),
		owner_id: rowId.nullable(),
		department: z.string().trim().max(50),
		description: z.string().max(9000),
	})
	.partial();
const listQuery = schemas.pagination.extend({
	status: z.enum(STATUSES).optional(),
	task_id: rowId.optional(),
});

const actorId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : undefined);
const present = (actor, row) => ({ ...projectRow(actor.roles, 'issues', withBooleans(row, ['is_deleted'])) });

function log(ctx, id, type, extra = {}) {
	return ctx.repos.activity.insert({
		entity_type: 'issue',
		entity_id: id,
		activity_type: type,
		actor_id: actorId(ctx),
		logged_at: toDbDateTime(ctx.now()),
		...extra,
	});
}

/** Insert an issue. Used by the manual form (after a permission check) and by flagged checklist answers (no check: raising is part of finishing the checklist). */
async function insertIssue(ctx, raw, source) {
	const input = parse(createInput, raw);

	let task = null;
	if (input.task_id) {
		task = await ctx.repos.tasks.findById(input.task_id);
		if (!task) throw notFound('Task not found');
	}

	const row = await ctx.repos.issues.insert({
		subject: input.subject,
		description: input.description,
		task_id: task ? task.ROWID : undefined,
		site_id: input.site_id || (task && task.site_id) || undefined,
		crm_deal_id: task ? task.crm_deal_id : undefined,
		department: departmentFor(task && task.task_type),
		issue_status: 'Open',
		issue_priority: input.issue_priority,
		source_kind: source,
		reported_by_id: actorId(ctx),
	});
	await log(ctx, row.ROWID, 'created', { to_value: 'Open' });
	await ctx.publish('issue.changed', { issueId: String(row.ROWID), status: 'Open', created: true });
	return { issue: present(ctx.actor, row) };
}

async function createIssue(ctx, raw) {
	requireGrant(ctx.actor, 'issues', 'create');
	return insertIssue(ctx, raw, 'manual');
}

/** Raise one issue per flagged checklist answer, skipping ones already open for that task. */
async function raiseFromChecklist(ctx, task, subjects) {
	const raised = [];
	for (const subject of subjects) {
		const existing = await ctx.repos.issues.findOpenBySubject(task.ROWID, subject);
		if (existing) continue;
		const { issue } = await insertIssue(ctx, { task_id: String(task.ROWID), subject: subject.slice(0, 255) }, 'checklist');
		raised.push(issue.ROWID);
	}
	return raised;
}

async function listIssues(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'issues', 'view');
	const q = parse(listQuery, rawQuery);
	const own = grant.scope === 'own' || grant.scope === 'assigned';
	if (own && !actorId(ctx)) return { items: [], count: 0 };
	const rows = await ctx.repos.issues.list({
		status: q.status,
		taskId: q.task_id,
		reportedBy: own ? actorId(ctx) : undefined,
		limit: q.limit,
		offset: q.offset,
	});
	return { items: rows.map((r) => ({ ...present(ctx.actor, r), nextStatuses: nextStatuses(r.issue_status) })), count: rows.length };
}

async function loadIssue(ctx, id, grant) {
	parse(rowId, id);
	const row = await ctx.repos.issues.findById(id);
	const own = grant.scope === 'own' || grant.scope === 'assigned';
	if (!row || (own && String(row.reported_by_id) !== actorId(ctx))) throw notFound('Issue not found');
	return row;
}

async function getIssue(ctx, id) {
	const grant = requireGrant(ctx.actor, 'issues', 'view');
	const row = await loadIssue(ctx, id, grant);
	return { issue: present(ctx.actor, row), nextStatuses: nextStatuses(row.issue_status) };
}

async function updateIssue(ctx, id, raw) {
	const grant = requireGrant(ctx.actor, 'issues', 'edit');
	if (grant.scope !== 'all') throw forbidden('Only managers can change issues');
	const row = await loadIssue(ctx, id, grant);
	const input = parse(updateInput, raw);

	const patch = { ...input };
	if (input.issue_status && input.issue_status !== row.issue_status) {
		if (!canMove(row.issue_status, input.issue_status)) {
			throw new AppError(409, 'invalid_transition', `An issue cannot move from ${row.issue_status} to ${input.issue_status}`);
		}
		patch.completed_at = isClosed(input.issue_status) ? toDbDateTime(ctx.now()) : null;
	}
	if (Object.keys(patch).length === 0) return { issue: present(ctx.actor, row), nextStatuses: nextStatuses(row.issue_status) };

	await ctx.repos.issues.update({ ROWID: row.ROWID, ...patch });
	const next = { ...row, ...patch };
	await log(ctx, row.ROWID, 'updated', {
		from_value: row.issue_status,
		to_value: next.issue_status,
		payload: JSON.stringify(Object.keys(input)),
	});
	await ctx.publish('issue.changed', { issueId: String(row.ROWID), status: next.issue_status });
	return { issue: present(ctx.actor, next), nextStatuses: nextStatuses(next.issue_status) };
}

module.exports = { createIssue, raiseFromChecklist, listIssues, getIssue, updateIssue };
