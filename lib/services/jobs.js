'use strict';

const { JOB_STAGES } = require('../config');
const { projectRow } = require('../authz');
const { notFound } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { progressFor } = require('../domain/completion');
const { nextStages } = require('../domain/stages');
const { toDbDate, toDbDateTime } = require('../time');
const { requireGrant, assignedTaskIds } = require('./access');

const BOOL_COLUMNS = ['is_deleted'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const rowId = schemas.rowId;

const listQuery = schemas.pagination.extend({ stage: z.enum(JOB_STAGES).optional() });

const createInput = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().max(9000).optional(),
	crm_deal_id: z.string().trim().min(1).max(50).optional(),
	quote_ref: z.string().max(255).optional(),
	pm_id: rowId.optional(),
	fab_manager_id: rowId.optional(),
	expected_finish: date.optional(),
	agreed_fab_finish: date.optional(),
	required_fab_finish: date.optional(),
});

const updateInput = createInput.omit({ crm_deal_id: true }).partial();

const present = (actor, row) => projectRow(actor.roles, 'jobs', withBooleans(row, BOOL_COLUMNS));

/** Jobs visible to the actor, newest first. 'assigned' roles see jobs that have a task assigned to them. */
async function listJobs(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'jobs', 'view');
	const query = parse(listQuery, rawQuery);
	const { jobs, tasks } = ctx.repos;

	let ids;
	if (grant.scope === 'assigned') {
		const taskIds = await assignedTaskIds(ctx);
		if (taskIds.length === 0) return { items: [], count: 0 };
		const rows = await tasks.list({ ids: taskIds, limit: 300 });
		ids = [...new Set(rows.map((t) => String(t.job_id)))];
		if (ids.length === 0) return { items: [], count: 0 };
	}

	const rows = await jobs.list({ stage: query.stage, ids, limit: query.limit, offset: query.offset });
	const items = rows.map((r) => present(ctx.actor, r));
	return { items, count: items.length };
}

/** One job with its tasks and progress. Assigned-scope roles see only their own tasks. */
async function getJob(ctx, id) {
	const grant = requireGrant(ctx.actor, 'jobs', 'view');
	parse(rowId, id);
	const job = await ctx.repos.jobs.findById(id);
	if (!job) throw notFound('Job not found');

	let taskRows = await ctx.repos.tasks.listByJob(id);
	const progress = progressFor(taskRows);

	// One query tells us which of these tasks the actor is assigned to.
	const mine = new Set(await assignedTaskIds(ctx));
	if (grant.scope === 'assigned') {
		taskRows = taskRows.filter((t) => mine.has(String(t.ROWID)));
		if (taskRows.length === 0) throw notFound('Job not found');
	}

	const tasks = taskRows.map((t) => ({
		...projectRow(ctx.actor.roles, 'tasks', withBooleans(t, BOOL_COLUMNS)),
		nextStages: nextStages(t.task_type, t.stage, {
			roles: ctx.actor.roles,
			isAssignee: mine.has(String(t.ROWID)),
		}),
	}));

	return { job: present(ctx.actor, job), tasks, progress };
}

async function createJob(ctx, raw) {
	requireGrant(ctx.actor, 'jobs', 'create');
	const input = parse(createInput, raw);
	const now = ctx.now();

	const row = await ctx.repos.jobs.insert({
		...input,
		stage: 'Preparation',
		created_date: toDbDate(now),
		percent_fab: 0,
		percent_install: 0,
		percent_job: 0,
	});

	await ctx.repos.activity.insert({
		entity_type: 'job',
		entity_id: row.ROWID,
		activity_type: 'created',
		actor_id: ctx.actor.person ? ctx.actor.person.ROWID : undefined,
		to_value: 'Preparation',
		logged_at: toDbDateTime(now),
	});
	await ctx.publish('job.created', { jobId: String(row.ROWID) });
	return { job: present(ctx.actor, row) };
}

async function updateJob(ctx, id, raw) {
	requireGrant(ctx.actor, 'jobs', 'edit');
	parse(rowId, id);
	const input = parse(updateInput, raw);
	const job = await ctx.repos.jobs.findById(id);
	if (!job) throw notFound('Job not found');

	if (Object.keys(input).length > 0) await ctx.repos.jobs.update({ ROWID: job.ROWID, ...input });
	return { job: present(ctx.actor, { ...job, ...input }) };
}

module.exports = { listJobs, getJob, createJob, updateJob };
