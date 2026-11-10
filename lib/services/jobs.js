'use strict';

const { JOB_STAGES } = require('../config');
const { projectRow, FINANCIAL_ROLES } = require('../authz');
const { AppError, notFound, forbidden, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { progressFor } = require('../domain/completion');
const { nextStages } = require('../domain/stages');
const { toDbDate, toDbDateTime, todayLocal } = require('../time');
const { kpisFor } = require('../domain/reports');
const { inView, tabCounts, hoursOf, risksOf, tradeFigures, sortForList } = require('../domain/jobList');
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
	server_path: z.string().trim().max(255).optional(), // where the job files are on the VE server (JOB-7)
	agreed_fab_finish: date.optional(),
	required_fab_finish: date.optional(),
	// Fields of the old Creator form. A new job may start in one of the early stages; the rest are administrator-only.
	stage: z.enum(JOB_STAGES).optional(),
	workdrive_url: z.string().trim().max(255).optional(),
	profit_email_at: z.string().regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/, 'Use YYYY-MM-DD HH:MM').optional(),
	closure_email_sent: z.boolean().optional(),
	close_triggered: z.boolean().optional(),
	total_purchases: z.number().min(0).max(100000000).optional(),
	stock_purchases: z.number().min(0).max(100000000).optional(),
});

// Admin-only (JOB-8): the CRM deal link and the created date, and the system fields of the form. The rollup fields (percentages) are never editable here.
const ADMIN_ONLY = ['crm_deal_id', 'created_date', 'workdrive_url', 'profit_email_at', 'closure_email_sent', 'close_triggered', 'total_purchases', 'stock_purchases'];
const updateInput = createInput.omit({ stage: true }).extend({ created_date: date }).partial(); // the stage is worked out from the tasks, so it is only chosen when a job is created

/** The two yes/no marks live in the job's flags text; everything else maps straight to a column. Returns the columns to save. */
function toColumns(input, job) {
	const { closure_email_sent: closure, close_triggered: triggered, profit_email_at: profit, ...rest } = input;
	const out = { ...rest };
	if (profit !== undefined) out.profit_email_at = profit.replace('T', ' ').length === 16 ? profit.replace('T', ' ') + ':00' : profit.replace('T', ' ');
	if (closure !== undefined || triggered !== undefined) {
		const flags = parseFlags(job ? job.flags : null);
		if (closure !== undefined) flags.closure_email_sent = closure;
		if (triggered !== undefined) flags.close_triggered = triggered;
		out.flags = JSON.stringify(flags);
	}
	return out;
}

const present = (actor, row) => projectRow(actor.roles, 'jobs', withBooleans(row, BOOL_COLUMNS));

/**
 * Jobs visible to the actor, newest first, each with what the list needs: the project and fab manager names, hours booked against
 * quoted, and a short risk line (JOB-2). Also the number of jobs in each tab. Three queries however many jobs there are (the jobs,
 * their tasks, the people); the tab, filters and search are applied here so one fetch serves every tab. 'assigned' roles see only
 * jobs that have a task assigned to them.
 */
async function listJobs(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'jobs', 'view');
	const query = parse(listQuery, rawQuery);
	const { jobs, tasks, people } = ctx.repos;

	let ids;
	if (grant.scope === 'assigned') {
		const taskIds = await assignedTaskIds(ctx);
		if (taskIds.length === 0) return { items: [], count: 0, counts: tabCounts([], null) };
		const rows = await tasks.list({ ids: taskIds, limit: 300 });
		ids = [...new Set(rows.map((t) => String(t.job_id)))];
		if (ids.length === 0) return { items: [], count: 0, counts: tabCounts([], null) };
	}
	const me = ctx.actor.person ? String(ctx.actor.person.ROWID) : null;
	const all = await jobs.list({ ids, limit: 300 });
	const counts = tabCounts(all, me);

	const needle = (query.search || '').toLowerCase();
	const wanted = all.filter(
		(j) =>
			inView(j, query.view || 'all', me) &&
			(!query.stage || j.stage === query.stage) &&
			(!query.pm_id || String(j.pm_id) === query.pm_id) &&
			(!query.fab_manager_id || String(j.fab_manager_id) === query.fab_manager_id) &&
			(!needle || String(j.name || '').toLowerCase().includes(needle) || String(j.crm_deal_id || '').toLowerCase().includes(needle)),
	);
	const ordered = sortForList(wanted);
	const page = ordered.slice(query.offset || 0, (query.offset || 0) + (query.limit || 300));
	if (page.length === 0) return { items: [], count: 0, counts };

	const [taskRows, peopleRows] = await Promise.all([
		tasks.list({ jobIds: page.map((j) => String(j.ROWID)), limit: 300 }),
		people.findByIds([...new Set(page.flatMap((j) => [j.pm_id, j.fab_manager_id]).filter(Boolean).map(String))]),
	]);
	const nameOf = new Map(peopleRows.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
	const today = todayLocal(ctx.now());
	const money = (ctx.actor.roles || []).some((r) => FINANCIAL_ROLES.includes(r));
	const items = page.map((r) => {
		const own = taskRows.filter((t) => String(t.job_id) === String(r.ROWID));
		const hours = hoursOf(own);
		const fabF = tradeFigures(own, 'fabrication', money);
		const instF = tradeFigures(own, 'install', money);
		const designF = tradeFigures(own, 'design', money);
		let closureSent = false;
		try {
			closureSent = !!JSON.parse(r.flags || '{}').closure_email_sent;
		} catch {
			closureSent = false;
		}
		return {
			...present(ctx.actor, r),
			pm_name: r.pm_id ? nameOf.get(String(r.pm_id)) || null : null,
			fab_manager_name: r.fab_manager_id ? nameOf.get(String(r.fab_manager_id)) || null : null,
			quoted_hours: hours.quoted,
			booked_hours: hours.booked,
			risk: risksOf(own, hours, today),
			fab_hours_booked: fabF.hours,
			install_hours_booked: instF.hours,
			design_hours_booked: designF.hours,
			closure_email_sent: closureSent,
			...(money ? { fab_labour_cost: fabF.cost, install_labour_cost: instF.cost, design_labour_cost: designF.cost } : {}),
		};
	});
	return { items, count: items.length, total: wanted.length, counts, truncated: all.length >= 300 };
}

/** Crew (by role), SWMS status and the sites of a job's tasks, in three queries however many tasks there are. */
async function taskDetails(ctx, taskRows) {
	const byTask = new Map();
	if (taskRows.length === 0) return { byTask, locations: [] };
	const ids = taskRows.map((t) => String(t.ROWID));
	const swmsIds = [...new Set(taskRows.map((t) => t.swms_id).filter(Boolean).map(String))];
	const siteIds = [...new Set(taskRows.map((t) => t.site_id).filter(Boolean).map(String))];
	const [links, swmsRows, siteRows] = await Promise.all([
		ctx.repos.assignees.listForTasks(ids),
		swmsIds.length ? ctx.repos.swms.listByIds(swmsIds) : [],
		siteIds.length ? ctx.repos.sites.findByIds(siteIds) : [],
	]);
	const people = links.length ? await ctx.repos.people.findByIds([...new Set(links.map((l) => String(l.person_id)))]) : [];
	const nameOf = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
	const swmsStatus = new Map(swmsRows.map((s) => [String(s.ROWID), s.swms_status]));
	for (const t of taskRows) {
		const crew = links.filter((l) => String(l.task_id) === String(t.ROWID)).map((l) => ({ personId: String(l.person_id), name: nameOf.get(String(l.person_id)) || null, role: l.assignee_role }));
		byTask.set(String(t.ROWID), {
			crew,
			team_leader: crew.filter((c) => c.role === 'lead').map((c) => c.name).filter(Boolean).join(', '),
			team_members: crew.filter((c) => c.role !== 'lead').map((c) => c.name).filter(Boolean).join(', '),
			swms_status: t.swms_id ? swmsStatus.get(String(t.swms_id)) || null : null,
		});
	}
	const locations = siteRows.map((s) => {
		const address = [s.street, s.suburb, s.state, s.post_code].filter(Boolean).join(', ');
		return {
			id: String(s.ROWID),
			name: s.name || '',
			street: s.street || '',
			city: s.suburb || '',
			address,
			mapUrl: s.maps_url || (address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(address) : ''),
			crmSiteId: s.crm_site_id || '',
			addedTime: s.CREATEDTIME || null,
		};
	});
	return { byTask, locations };
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

	// The crew and SWMS status of each task, and the places the job's tasks are at: three more queries for the whole page.
	const detail = await taskDetails(ctx, taskRows);
	for (const t of tasks) Object.assign(t, detail.byTask.get(String(t.ROWID)) || {});
	const flags = parseFlags(job.flags);

	// JOB-3: per discipline, how many tasks, how many open and overdue, and the percent done (from the tasks the caller may see).
	return {
		job: { ...present(ctx.actor, job), closure_email_sent: !!flags.closure_email_sent, close_triggered: !!flags.close_triggered },
		tasks,
		progress,
		locations: detail.locations,
		kpis: kpisFor(taskRows, todayLocal(ctx.now())),
	};
}

async function createJob(ctx, raw) {
	requireGrant(ctx.actor, 'jobs', 'create');
	const input = parse(createInput, raw);
	const now = ctx.now();
	const lockedOnCreate = ADMIN_ONLY.filter((k) => input[k] !== undefined && k !== 'crm_deal_id');
	if (lockedOnCreate.length && !ctx.actor.roles.includes('admin')) throw forbidden(`Only an administrator can set: ${lockedOnCreate.join(', ')}`);

	const row = await ctx.repos.jobs.insert({
		...toColumns(input, null),
		stage: input.stage || 'Preparation',
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
	if (!String(after.name || '').trim() || !after.expected_finish || !String(after.server_path || '').trim()) {
		throw badRequest('Please fill the mandatory fields: name, expected finish and file location on the VE server');
	}

	const columns = toColumns(input, job);
	if (Object.keys(columns).length > 0) await ctx.repos.jobs.update({ ROWID: job.ROWID, ...columns });
	return { job: present(ctx.actor, { ...job, ...columns }) };
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
