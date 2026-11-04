'use strict';

const { JOB_STAGES } = require('../config');
const { projectRow } = require('../authz');
const { AppError, notFound, forbidden, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { progressFor } = require('../domain/completion');
const { nextStages } = require('../domain/stages');
const { toDbDate, toDbDateTime, todayLocal } = require('../time');
const { jobView, kpisFor } = require('../domain/reports');
const { requireGrant, assignedTaskIds } = require('./access');
const { enqueue } = require('./outbox');
const { closeJobProblems, parseFlags } = require('../domain/taskRules');

const BOOL_COLUMNS = ['is_deleted'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const rowId = schemas.rowId;

const listQuery = schemas.pagination.extend({
	stage: z.enum(JOB_STAGES).optional(),
	// The tabs of the jobs list (JOB-2): all, my open, my jobs, preparation, ongoing, completed.
	view: z.enum(['all', 'my_open', 'my_jobs', 'preparation', 'ongoing', 'completed']).optional(),
	pm_id: rowId.optional(),
	fab_manager_id: rowId.optional(),
	search: z.string().trim().min(1).max(100).regex(/^[^'%\\]+$/, 'Use letters, numbers and spaces').optional(),
});

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

// Admin-only (JOB-8): the CRM deal link and the created date. The rollup fields (percentages, stage) are never editable here.
const ADMIN_ONLY = ['crm_deal_id', 'created_date'];
const updateInput = createInput.extend({ created_date: date }).partial();

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

	const view = jobView(query.view);
	const me = ctx.actor.person ? String(ctx.actor.person.ROWID) : null;
	if (view.mine && !me) return { items: [], count: 0 }; // "my" jobs need a person record
	const rows = await jobs.list({
		stage: query.stage,
		stages: view.stages,
		excludeStages: view.excludeStages,
		pmId: query.pm_id || (view.mine === 'pm' ? me : undefined),
		fabManagerId: query.fab_manager_id,
		mineId: view.mine === 'pm_or_fab' ? me : undefined,
		search: query.search,
		ids,
		limit: query.limit,
		offset: query.offset,
	});
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

	// JOB-3: per discipline, how many tasks, how many open and overdue, and the percent done (from the tasks the caller may see).
	return { job: present(ctx.actor, job), tasks, progress, kpis: kpisFor(taskRows, todayLocal(ctx.now())) };
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
	// Queue the WorkDrive folder; it waits harmlessly until WorkDrive is connected.
	await enqueue(ctx, { jobType: 'workdrive.create_job_folder', entityType: 'job', entityId: row.ROWID, payload: { jobId: String(row.ROWID), jobName: row.name }, key: ['workdrive-folder', String(row.ROWID)] });
	return { job: present(ctx.actor, row) };
}

async function updateJob(ctx, id, raw) {
	requireGrant(ctx.actor, 'jobs', 'edit');
	parse(rowId, id);
	const input = parse(updateInput, raw);
	const job = await ctx.repos.jobs.findById(id);
	if (!job) throw notFound('Job not found');

	const locked = ADMIN_ONLY.filter((k) => input[k] !== undefined);
	if (locked.length && !ctx.actor.roles.includes('admin')) throw forbidden(`Only an administrator can change: ${locked.join(', ')}`);
	// JOB-7: a job that is edited keeps its name and expected finish ("Please fill the mandatory fields").
	const after = { ...job, ...input };
	if (!String(after.name || '').trim() || !after.expected_finish) throw badRequest('Please fill the mandatory fields: name and expected finish');

	if (Object.keys(input).length > 0) await ctx.repos.jobs.update({ ROWID: job.ROWID, ...input });
	return { job: present(ctx.actor, { ...job, ...input }) };
}

/**
 * Close a finished job (FSD JOB-5): every task must be finished. The stage becomes "Completed - Closed", the CRM deal is told,
 * and the closure email goes out ONCE (a flag on the job guards it, so closing, reopening and closing again never emails twice).
 */
async function closeJob(ctx, id) {
	requireGrant(ctx.actor, 'jobs', 'edit');
	parse(rowId, id);
	const job = await ctx.repos.jobs.findById(id);
	if (!job) throw notFound('Job not found');
	const problems = closeJobProblems(job, await ctx.repos.tasks.listByJob(job.ROWID));
	if (problems.length) throw new AppError(409, 'cannot_close', problems.join(' '));

	const now = ctx.now();
	const flags = parseFlags(job.flags);
	const firstClosure = !flags.closure_email_sent;
	const patch = { stage: 'Completed - Closed', flags: JSON.stringify({ ...flags, closure_email_sent: true }) };
	if (!job.completed_date) patch.completed_date = toDbDate(now);
	await ctx.repos.jobs.update({ ROWID: job.ROWID, ...patch });

	await ctx.repos.activity.insert({
		entity_type: 'job',
		entity_id: job.ROWID,
		activity_type: 'stage_change',
		actor_id: ctx.actor.person ? ctx.actor.person.ROWID : undefined,
		from_value: job.stage,
		to_value: 'Completed - Closed',
		logged_at: toDbDateTime(now),
	});
	if (job.crm_deal_id) {
		await enqueue(ctx, {
			jobType: 'crm.update_deal',
			entityType: 'job',
			entityId: job.ROWID,
			payload: { dealId: job.crm_deal_id, fields: { Job_Stage: 'Completed - Closed' } },
			key: ['crm.job_stage', job.ROWID, 'Completed_-_Closed', toDbDateTime(now)],
		});
	}
	if (firstClosure) await ctx.publish('job.closed', { jobId: String(job.ROWID) });
	return { job: present(ctx.actor, { ...job, ...patch }), emailSent: firstClosure };
}

module.exports = { listJobs, getJob, createJob, updateJob, closeJob };
