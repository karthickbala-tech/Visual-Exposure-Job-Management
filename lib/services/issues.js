'use strict';

const { projectRow } = require('../authz');
const { AppError, notFound, forbidden } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { STATUSES, PRIORITIES, DEPARTMENTS, OPEN_STATUSES, canMove, nextStatuses, isClosed, departmentFor, diffIssue, boardCounts, updateProblems, isOverdue, REVIEW_OPTIONS } = require('../domain/issues');
const { toDbDateTime, todayLocal } = require('../time');
const { addDays } = require('../domain/reminders');
const { requireGrant } = require('./access');

const rowId = schemas.rowId;

const createInput = z.object({
	subject: z.string().trim().min(1).max(255),
	description: z.string().max(9000).optional(),
	task_id: rowId.optional(),
	site_id: rowId.optional(),
	issue_priority: z.enum(PRIORITIES).default('Normal'),
	department: z.enum(DEPARTMENTS).optional(), // sent to a board by hand; otherwise it follows the task type
	billboard_site: z.string().trim().max(150).optional(),
	billboard_face: z.string().trim().max(50).optional(),
	review_needed: z.enum(REVIEW_OPTIONS).optional(),
});
const updateInput = z
	.object({
		issue_status: z.enum(STATUSES),
		issue_priority: z.enum(PRIORITIES),
		assigned_to_id: rowId.nullable(),
		owner_id: rowId.nullable(),
		department: z.enum(DEPARTMENTS),
		description: z.string().max(9000),
		next_step: z.string().trim().max(9000),
		work_completed: z.string().trim().max(9000),
		due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
		billboard_site: z.string().trim().max(150),
		billboard_face: z.string().trim().max(50),
		review_needed: z.enum(REVIEW_OPTIONS),
	})
	.partial();
const listQuery = schemas.pagination.extend({
	status: z.enum(STATUSES).optional(),
	task_id: rowId.optional(),
	department: z.enum(DEPARTMENTS).optional(),
	// All Open, My Open (assigned to me or owned by me) and My Reported: the board filters of FSD ISS-3.
	view: z.enum(['open', 'mine', 'reported', 'assigned', 'high', 'overdue']).optional(),
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

	const department = input.department || departmentFor(task && task.task_type);
	if (department === 'Civic Billboards' && (!input.billboard_site || !input.billboard_face)) {
		throw new AppError(400, 'validation_failed', 'Civic Billboards issues need the billboard site and face.');
	}
	const row = await ctx.repos.issues.insert({
		subject: input.subject,
		description: input.description,
		task_id: task ? task.ROWID : undefined,
		site_id: input.site_id || (task && task.site_id) || undefined,
		crm_deal_id: task ? task.crm_deal_id : undefined,
		department,
		issue_status: 'Open',
		issue_priority: input.issue_priority,
		source_kind: source,
		billboard_site: input.billboard_site || undefined,
		billboard_face: input.billboard_face || undefined,
		review_needed: input.review_needed || undefined,
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
	const wanted = [...new Set(subjects.map((s) => s.slice(0, 255)))];
	if (wanted.length === 0) return raised;
	// One query for what is already open on this task, instead of one query per flagged question.
	const open = await ctx.repos.issues.list({ taskId: String(task.ROWID), limit: 300 });
	const already = new Set(open.filter((i) => i.source_kind === 'checklist' && ['Open', 'In Progress'].includes(i.issue_status)).map((i) => i.subject));
	for (const subject of wanted) {
		if (already.has(subject)) continue;
		const { issue } = await insertIssue(ctx, { task_id: String(task.ROWID), subject }, 'checklist');
		raised.push(issue.ROWID);
	}
	return raised;
}

async function listIssues(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'issues', 'view');
	const q = parse(listQuery, rawQuery);
	const own = grant.scope === 'own' || grant.scope === 'assigned';
	if (own && !actorId(ctx)) return { items: [], count: 0 };
	if ((q.view === 'mine' || q.view === 'reported') && !actorId(ctx)) return { items: [], count: 0 };
	const openOnly = ['open', 'mine', 'assigned', 'high', 'overdue'].includes(q.view);
	let rows = await ctx.repos.issues.list({
		status: q.status,
		statuses: openOnly ? OPEN_STATUSES : undefined,
		department: q.department,
		involvedId: q.view === 'mine' ? actorId(ctx) : undefined,
		taskId: q.task_id,
		reportedBy: own || q.view === 'reported' ? actorId(ctx) : undefined,
		limit: q.limit,
		offset: q.offset,
	});
	const today = todayLocal(ctx.now());
	if (q.view === 'assigned') rows = rows.filter((r) => String(r.assigned_to_id || '') === actorId(ctx));
	if (q.view === 'high') rows = rows.filter((r) => ['High', 'Urgent'].includes(r.issue_priority));
	if (q.view === 'overdue') rows = rows.filter((r) => isOverdue(r, today));
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

	// Only what really changes is saved, logged and emailed (ISS-2): old and new values, field by field.
	const changes = diffIssue(row, input);
	if (changes.length === 0) return { issue: present(ctx.actor, row), nextStatuses: nextStatuses(row.issue_status) };
	const patch = Object.fromEntries(changes.map((c) => [c.field, input[c.field]]));
	if (patch.issue_status) {
		if (!canMove(row.issue_status, patch.issue_status)) {
			throw new AppError(409, 'invalid_transition', `An issue cannot move from ${row.issue_status} to ${patch.issue_status}`);
		}
		patch.completed_at = isClosed(patch.issue_status) ? toDbDateTime(ctx.now()) : null;
	}
	const problems = updateProblems({ ...row, ...patch }, patch);
	if (problems.length) throw new AppError(400, 'validation_failed', problems.join(' '));

	await ctx.repos.issues.update({ ROWID: row.ROWID, ...patch });
	const next = { ...row, ...patch };
	await log(ctx, row.ROWID, 'updated', {
		from_value: row.issue_status,
		to_value: next.issue_status,
		payload: JSON.stringify(changes).slice(0, 9000),
	});
	await ctx.publish('issue.changed', { issueId: String(row.ROWID), status: next.issue_status, changes, actorId: actorId(ctx) });
	return { issue: present(ctx.actor, next), nextStatuses: nextStatuses(next.issue_status) };
}

/** Every update of one issue, newest first, with what changed (old and new values). */
async function issueHistory(ctx, id) {
	const grant = requireGrant(ctx.actor, 'issues', 'view');
	const row = await loadIssue(ctx, id, grant);
	const rows = await ctx.repos.activity.listByEntity({ entityType: 'issue', entityId: row.ROWID, activityType: 'updated', limit: 100 });
	const items = rows.map((r) => {
		let changes = [];
		try {
			changes = r.payload ? JSON.parse(r.payload) : [];
		} catch {
			changes = [];
		}
		return { at: r.logged_at || null, byPersonId: r.actor_id ? String(r.actor_id) : null, changes: Array.isArray(changes) ? changes : [] };
	});
	return { items, count: items.length };
}

/** The department boards: open, in-progress, resolved and closed counts for each. Managers only. */
async function issueBoard(ctx) {
	const grant = requireGrant(ctx.actor, 'issues', 'view');
	if (grant.scope !== 'all') throw forbidden('Only managers can see the boards');
	const rows = await ctx.repos.issues.list({ limit: 300 });
	return { departments: DEPARTMENTS, counts: boardCounts(rows), truncated: rows.length >= 300 };
}

/**
 * ISS-4: open a follow-up deal in the CRM for an issue (for example a Management or Civic Billboards matter). Once only:
 * asking again returns the deal already made. Needs the Zoho settings.
 */
async function createDealFromIssue(ctx, id) {
	const grant = requireGrant(ctx.actor, 'issues', 'edit');
	if (grant.scope !== 'all') throw forbidden('Only managers can create a CRM deal');
	const row = await loadIssue(ctx, id, grant);
	const existing = await ctx.repos.activity.listByEntity({ entityType: 'issue', entityId: row.ROWID, activityType: 'crm_deal', limit: 1 });
	if (existing[0]) return { created: false, dealId: String(existing[0].to_value) };
	if (!ctx.zoho || !ctx.zoho.crm) throw new AppError(503, 'not_configured', 'Zoho CRM is not connected (see Admin, Integrations).');

	const description = [row.description, `Raised from issue ${row.ROWID} (${row.department || 'Management'}) in Visual Exposure Projects.`].filter(Boolean).join('\n\n');
	const dealId = await ctx.zoho.crm.createDeal({
		Deal_Name: `Issue: ${row.subject}`.slice(0, 200),
		Stage: 'Qualification',
		Closing_Date: addDays(todayLocal(ctx.now()), 30),
		Description: description.slice(0, 30000),
	});
	await log(ctx, row.ROWID, 'crm_deal', { to_value: String(dealId) });
	return { created: true, dealId: String(dealId) };
}

module.exports = { createIssue, raiseFromChecklist, listIssues, getIssue, updateIssue, issueHistory, issueBoard, createDealFromIssue };
