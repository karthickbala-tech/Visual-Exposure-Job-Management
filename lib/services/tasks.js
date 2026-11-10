'use strict';

const { TASK_TYPES } = require('../config');
const { projectRow } = require('../authz');
const { AppError, forbidden, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { stagesFor, initialStage, isTerminal, isManager, checkTransition, nextStages, TERMINAL } = require('../domain/stages');
const { taskBoard: buildBoard } = require('../domain/reports');
const { canCloseDirectly, subtaskDraft } = require('../domain/taskRules');
const { FAB_KINDS, normaliseFabSpec, normaliseRepeat, nextRepeatDate, shouldRepeat, groupAndSort } = require('../domain/fab');
const { readSettings } = require('./appSettings');
const { touchChecked } = require('./registers');
const { todayLocal } = require('../time');
const { jobStageFor } = require('../domain/rollup');
const { progressFor } = require('../domain/completion');
const { toDbDate, toDbDateTime } = require('../time');
const { requireGrant, assignedTaskIds, taskAccess } = require('./access');
const swmsService = require('./swms');
const { enqueue } = require('./outbox');
const { needsSwms } = require('../domain/swms');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const hours = z.number().min(0).max(100000);

const createInput = z.object({
	task_type: z.enum(TASK_TYPES),
	name: z.string().trim().min(1).max(200),
	kind: z.string().trim().max(50).optional(),
	description: z.string().max(9000).optional(),
	quoted_hours: hours.optional(),
	proposed_hours: hours.optional(),
	scheduled_date: date.optional(),
	required_finish: date.optional(),
	site_id: rowId.optional(),
	sign_group_id: rowId.optional(),
	// DS Cost Type: whether the task counts as a Parent cost or a Fab cost, for the job totals (docs/DS_COMPARISON.md, section 17).
	cost_type: z.enum(['Fab', 'Parent']).nullable().optional(),
	// A workshop task can repeat: every N days, weeks or months after it is completed (FAB-3).
	repeat: z.object({ every: z.number(), unit: z.enum(['days', 'weeks', 'months']) }).nullable().optional(),
});

const updateInput = createInput
	.omit({ task_type: true })
	.extend({ notes: z.string().max(9000).optional(), hired_equipment: z.array(rowId).max(50).optional(), spec: z.record(z.string(), z.any()).optional() })
	.partial();
const FIELD_CREW_MAY_EDIT = ['notes'];

const assigneeInput = z.object({ person_id: rowId, role: z.enum(['lead', 'member', 'other']) });
const transitionInput = z.object({
	to: z.string().min(1).max(40),
	comment: z.string().trim().max(2000).optional(),
	// Recorded when a manager approves (FSD INS-5): the OH&S question defaults to No, plus an optional management-review flag.
	ohs: z.enum(['Yes', 'No']).optional(),
	management_review: z.boolean().optional(),
});
const listQuery = schemas.pagination.extend({
	job_id: rowId.optional(),
	type: z.enum(TASK_TYPES).optional(),
	stage: z.string().max(40).optional(),
	order: z.enum(['grouped']).optional(), // parents with their subtasks, then by stage and date (FAB-2)
	kind: z.string().max(50).optional(), // for example CNC, Workshop, VE Install
	assignee: z.union([z.literal('me'), rowId]).optional(), // tasks of one person ("me" for the caller)
	open: z.enum(['true']).optional(), // only tasks that are not finished
	overdue: z.enum(['true']).optional(), // only open tasks whose required finish date has passed
	from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(), // scheduled from this date
	to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(), // ... to this date
	detail: z.enum(['true']).optional(), // add the job name, the crew and the SWMS status to each task (for the work screens)
});

/** Transitions that must carry an explanation. */
const NEEDS_COMMENT = ['Rejected', 'Reopen'];
const REWORK_STAGES = ['Rejected', 'Reopen'];

const present = (actor, row) => projectRow(actor.roles, 'tasks', withBooleans(row, ['is_deleted']));
const actorId = (ctx) => (ctx.actor.person ? ctx.actor.person.ROWID : undefined);

function logActivity(ctx, entityType, entityId, type, extra = {}) {
	return ctx.repos.activity.insert({
		entity_type: entityType,
		entity_id: entityId,
		activity_type: type,
		actor_id: actorId(ctx),
		logged_at: toDbDateTime(ctx.now()),
		...extra,
	});
}

async function loadTask(ctx, id) {
	parse(rowId, id);
	const task = await ctx.repos.tasks.findById(id);
	if (!task) throw notFound('Task not found');
	return task;
}

/**
 * Recompute a job's stage and progress from its tasks (one query, one update).
 * Runs inside the request so the screen shows the result immediately.
 */
async function recalcJob(ctx, jobId) {
	const job = await ctx.repos.jobs.findById(jobId);
	if (!job) return null;
	const tasks = await ctx.repos.tasks.listByJob(jobId);

	const stage = jobStageFor(job.stage, tasks.map((t) => t.stage));
	const progress = progressFor(tasks);

	const changed =
		stage !== job.stage ||
		Number(job.percent_fab) !== progress.fab ||
		Number(job.percent_install) !== progress.install ||
		Number(job.percent_job) !== progress.job;

	if (changed) {
		const patch = {
			ROWID: job.ROWID,
			stage,
			percent_fab: progress.fab,
			percent_install: progress.install,
			percent_job: progress.job,
		};
		if (stage === 'Completed' && job.stage !== 'Completed') patch.completed_date = toDbDate(ctx.now());
		await ctx.repos.jobs.update(patch);
		if (stage !== job.stage) {
			await logActivity(ctx, 'job', job.ROWID, 'stage_change', { from_value: job.stage, to_value: stage });
			// Mirror the stage onto the CRM deal (WORKFLOWS section 12). Queued, so a CRM outage never blocks the user.
			if (job.crm_deal_id) {
				await enqueue(ctx, {
					jobType: 'crm.update_deal',
					entityType: 'job',
					entityId: job.ROWID,
					payload: { dealId: job.crm_deal_id, fields: { Job_Stage: stage } },
					key: ['crm.job_stage', job.ROWID, stage, toDbDateTime(ctx.now())],
				});
			}
		}
	}
	return { stage, progress };
}

async function createTask(ctx, jobId, raw) {
	requireGrant(ctx.actor, 'tasks', 'create');
	parse(rowId, jobId);
	const input = parse(createInput, raw);

	const job = await ctx.repos.jobs.findById(jobId);
	if (!job) throw notFound('Job not found');
	if (job.stage === 'Completed - Closed') {
		throw new AppError(409, 'job_closed', 'This job is closed; tasks cannot be added');
	}
	return insertTask(ctx, job, ...checkKindAndRepeat(input));
}

/**
 * Fabrication tasks must use a known type (CCV, CNC, ...). Only workshop tasks repeat. Returns [input, extra] for insertTask,
 * with the repeat rule stored as JSON.
 */
function checkKindAndRepeat(input) {
	const { repeat, ...rest } = input;
	if (rest.task_type === 'fabrication' && rest.kind && !FAB_KINDS.includes(rest.kind)) {
		throw badRequest(`Unknown fabrication type "${rest.kind}". Use one of: ${FAB_KINDS.join(', ')}`);
	}
	if (!repeat) return [rest, {}];
	if (!(rest.task_type === 'fabrication' && rest.kind === 'Workshop')) throw badRequest('Only workshop tasks can repeat.');
	try {
		return [rest, { repeat_rule: JSON.stringify(normaliseRepeat(repeat)) }];
	} catch (err) {
		throw badRequest(err.message);
	}
}

/** Create the row, its SWMS when it needs one, the log entry and the job rollup. `extra` carries parent links for subtasks. */
async function insertTask(ctx, job, input, extra = {}) {
	const stage = initialStage(input.task_type);
	const row = await ctx.repos.tasks.insert({
		...input,
		...extra,
		job_id: job.ROWID,
		stage,
		quoted_hours: input.quoted_hours ?? 0,
		pm_id: job.pm_id || actorId(ctx),
		fab_manager_id: job.fab_manager_id || undefined,
	});

	if (needsSwms(input.task_type, input.kind)) {
		const swms = await swmsService.createForTask(ctx, row, job);
		row.swms_id = swms.ROWID;
	}
	await logActivity(ctx, 'task', row.ROWID, 'created', { to_value: stage });
	const rollup = await recalcJob(ctx, job.ROWID);
	await ctx.publish('task.created', { taskId: String(row.ROWID), jobId: String(job.ROWID) });
	return { task: present(ctx.actor, row), job: rollup };
}

/**
 * FAB-5: a workshop task goes under the workshop job chosen in Admin settings, never a hard-coded id.
 * Fails clearly when no workshop job is set.
 */
async function createWorkshopTask(ctx, raw) {
	requireGrant(ctx.actor, 'tasks', 'create');
	const input = parse(createInput.omit({ task_type: true, kind: true, site_id: true, sign_group_id: true }), raw);
	const settings = await readSettings(ctx.repos);
	if (!settings.workshop_job_id) throw new AppError(409, 'workshop_job_not_set', 'Choose the workshop job in Admin settings first.');
	const job = await ctx.repos.jobs.findById(settings.workshop_job_id);
	if (!job) throw new AppError(409, 'workshop_job_not_set', 'The workshop job no longer exists; choose another in Admin settings.');
	if (job.stage === 'Completed - Closed') throw new AppError(409, 'job_closed', 'The workshop job is closed; choose another in Admin settings.');
	return insertTask(ctx, job, ...checkKindAndRepeat({ ...input, task_type: 'fabrication', kind: 'Workshop' }));
}

/**
 * Things that follow a task being completed: a repeating workshop task creates the next one (once), and a finished maintenance
 * task counts as the equipment check (its next due date moves forward).
 */
async function afterCompleted(ctx, task) {
	if (task.task_type !== 'fabrication') return;
	let repeat = null;
	try {
		repeat = task.repeat_rule ? JSON.parse(task.repeat_rule) : null;
	} catch {
		repeat = null;
	}
	if (shouldRepeat(task, repeat)) {
		const job = await ctx.repos.jobs.findById(task.job_id);
		if (job && job.stage !== 'Completed - Closed') {
			const base = task.scheduled_date ? String(task.scheduled_date).slice(0, 10) : todayLocal(ctx.now());
			await insertTask(
				ctx,
				job,
				{ task_type: 'fabrication', kind: 'Workshop', name: task.name, quoted_hours: Number(task.quoted_hours) || 0, scheduled_date: nextRepeatDate(base, repeat) },
				{ repeat_rule: JSON.stringify({ every: repeat.every, unit: repeat.unit }) }
			);
			await ctx.repos.tasks.update({ ROWID: task.ROWID, repeat_rule: JSON.stringify({ ...repeat, spawned: true }) });
		}
	}
	if (task.kind === 'Maintenance') {
		let spec = {};
		try {
			spec = task.spec ? JSON.parse(task.spec) : {};
		} catch {
			spec = {};
		}
		if (spec.equipment_id) await touchChecked(ctx, spec.equipment_id);
	}
}

/**
 * Add a subtask under a task's ROOT parent (a subtask of a subtask joins the same parent). Install subtasks have no SWMS of
 * their own. Refused for design tasks and for a closed job.
 */
async function createSubtask(ctx, id) {
	requireGrant(ctx.actor, 'tasks', 'create');
	const task = await loadTask(ctx, id);
	const job = await ctx.repos.jobs.findById(task.job_id);
	const rootId = task.parent_id ? String(task.parent_id) : String(task.ROWID);
	const root = rootId === String(task.ROWID) ? task : (await ctx.repos.tasks.findById(rootId)) || task;
	const d = subtaskDraft(task, root, job);
	if (d.error) throw d.code === 'job_closed' ? new AppError(409, 'job_closed', d.error) : badRequest(d.error);

	const created = await insertTask(ctx, job, d.draft, { parent_id: root.ROWID, parent_or_sub: 'Sub' });
	if (!root.parent_or_sub) await ctx.repos.tasks.update({ ROWID: root.ROWID, parent_or_sub: 'Parent' });
	return created;
}

async function listTasks(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	const q = parse(listQuery, rawQuery);

	let ids;
	if (grant.scope !== 'all') {
		ids = await assignedTaskIds(ctx);
		if (ids.length === 0) return { items: [], count: 0 };
	}
	if (q.assignee) {
		const me = actorId(ctx);
		const person = q.assignee === 'me' ? me : q.assignee;
		if (q.assignee !== 'me' && grant.scope !== 'all' && person !== me) throw forbidden('You can only list your own tasks');
		if (!person) return { items: [], count: 0 };
		const mine = (await ctx.repos.assignees.listForPerson(person)).map((l) => String(l.task_id));
		ids = ids ? ids.filter((i) => mine.includes(String(i))) : mine;
		if (ids.length === 0) return { items: [], count: 0 };
	}
	const today = todayLocal(ctx.now());
	const rows = await ctx.repos.tasks.list({
		jobId: q.job_id,
		type: q.type,
		stage: q.stage,
		kind: q.kind,
		excludeStages: q.open === 'true' || q.overdue === 'true' ? TERMINAL : undefined,
		requiredBefore: q.overdue === 'true' ? today : undefined,
		from: q.from,
		to: q.to,
		ids,
		limit: q.detail ? Math.min(q.limit || DETAIL_LIMIT, DETAIL_LIMIT) : q.limit,
		offset: q.offset,
	});
	const ordered = q.order === 'grouped' ? groupAndSort(rows) : rows;
	const items = ordered.map((r) => present(ctx.actor, r));
	return { items: q.detail ? await withDetail(ctx, items) : items, count: rows.length };
}

const DETAIL_LIMIT = 120; // keeps the crew query inside the 300-row limit of one read

/** Job name, crew (id, name, role) and SWMS status for each task: three more queries for the whole list, not three per task. */
async function withDetail(ctx, items) {
	if (items.length === 0) return items;
	const ids = items.map((t) => String(t.ROWID));
	const jobIds = [...new Set(items.map((t) => String(t.job_id)))];
	const swmsIds = [...new Set(items.map((t) => t.swms_id).filter(Boolean).map(String))];
	const [jobRows, links, swmsRows] = await Promise.all([ctx.repos.jobs.list({ ids: jobIds, limit: 300 }), ctx.repos.assignees.listForTasks(ids), ctx.repos.swms.listByIds(swmsIds)]);
	const people = links.length ? await ctx.repos.people.findByIds([...new Set(links.map((l) => String(l.person_id)))]) : [];
	const nameOf = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
	const jobName = new Map(jobRows.map((j) => [String(j.ROWID), j.name]));
	const swmsStatus = new Map(swmsRows.map((s) => [String(s.ROWID), s.swms_status]));
	return items.map((t) => ({
		...t,
		job_name: jobName.get(String(t.job_id)) || null,
		swms_status: t.swms_id ? swmsStatus.get(String(t.swms_id)) || null : null,
		crew: links.filter((l) => String(l.task_id) === String(t.ROWID)).map((l) => ({ personId: String(l.person_id), name: nameOf.get(String(l.person_id)) || null, role: l.assignee_role })),
	}));
}

/**
 * A kanban board of one task type: a column per stage, each card flagged when its required finish date has passed (DES-3).
 * Crew see only their own tasks on it.
 */
async function taskBoard(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	const q = parse(z.object({ type: z.enum(TASK_TYPES) }), rawQuery);
	let ids;
	if (grant.scope !== 'all') {
		ids = await assignedTaskIds(ctx);
		if (ids.length === 0) return { type: q.type, columns: boardColumns([], q.type, todayLocal(ctx.now())), truncated: false };
	}
	const rows = await ctx.repos.tasks.list({ type: q.type, ids, limit: 300 });
	return { type: q.type, columns: boardColumns(rows, q.type, todayLocal(ctx.now())), truncated: rows.length >= 300 };
}
const boardColumns = (rows, type, today) => buildBoard(rows, stagesFor(type), today);

/** One task, its assignees (names only) and the stages the caller can move it to. */
async function getTask(ctx, id) {
	const task = await loadTask(ctx, id);
	const { isAssignee, assigneeLinks } = await taskAccess(ctx, task, 'view');

	const people = await ctx.repos.people.findByIds(assigneeLinks.map((l) => l.person_id));
	const byId = new Map(people.map((p) => [String(p.ROWID), p]));
	const assignees = assigneeLinks.map((l) => {
		const p = byId.get(String(l.person_id));
		return {
			linkId: l.ROWID,
			personId: String(l.person_id),
			role: l.assignee_role,
			name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : null,
		};
	});

	return {
		task: present(ctx.actor, task),
		assignees,
		nextStages: nextStages(task.task_type, task.stage, { roles: ctx.actor.roles, isAssignee }),
	};
}

async function updateTask(ctx, id, raw) {
	const task = await loadTask(ctx, id);
	const { grant } = await taskAccess(ctx, task, 'edit');
	const input = parse(updateInput, raw);

	if (grant.scope !== 'all' && Object.keys(input).some((k) => !FIELD_CREW_MAY_EDIT.includes(k))) {
		throw forbidden('You can only edit notes on a task');
	}
	// TSK-6, checked again on the server: a finished task is locked (notes aside); dates stay in order; only fabrication has a spec.
	if (isTerminal(task.stage) && Object.keys(input).some((k) => k !== 'notes')) {
		throw new AppError(409, 'task_closed', `A task that is ${task.stage} cannot be edited. Reopen it first.`);
	}
	const start = input.scheduled_date !== undefined ? input.scheduled_date : task.scheduled_date;
	const finish = input.required_finish !== undefined ? input.required_finish : task.required_finish;
	if (start && finish && String(start).slice(0, 10) > String(finish).slice(0, 10)) throw badRequest('The scheduled date cannot be after the required finish date.');
	if (input.spec !== undefined && task.task_type !== 'fabrication') throw badRequest('Only fabrication tasks have a fabrication spec.');
	// Hired equipment is kept inside the spec of the task; it goes off hire when the install finishes on site (EQP-2).
	const { hired_equipment: hired, spec: newSpec, repeat, ...columns } = input;
	if (repeat !== undefined) {
		if (!(task.task_type === 'fabrication' && task.kind === 'Workshop')) throw badRequest('Only workshop tasks can repeat.');
		try {
			columns.repeat_rule = repeat === null ? null : JSON.stringify(normaliseRepeat(repeat));
		} catch (err) {
			throw badRequest(err.message);
		}
	}
	if (newSpec !== undefined) {
		const cleaned = normaliseFabSpec(task.kind, newSpec);
		if (cleaned.error) throw badRequest(cleaned.error);
		let old = {};
		try {
			old = task.spec ? JSON.parse(task.spec) : {};
		} catch {
			old = {};
		}
		// keep the fields the platform keeps in the spec (hired equipment, the equipment of a maintenance task)
		const kept = Object.fromEntries(['hired_equipment', 'equipment_id'].filter((k) => old[k] !== undefined).map((k) => [k, old[k]]));
		columns.spec = JSON.stringify({ ...kept, ...cleaned.spec });
	}
	if (hired !== undefined) {
		let spec = {};
		try {
			spec = task.spec ? JSON.parse(task.spec) : {};
		} catch {
			spec = {};
		}
		columns.spec = JSON.stringify({ ...(columns.spec ? JSON.parse(columns.spec) : spec), hired_equipment: hired });
	}
	if (Object.keys(columns).length > 0) await ctx.repos.tasks.update({ ROWID: task.ROWID, ...columns });
	return { task: present(ctx.actor, { ...task, ...columns }) };
}

/** The stage history of one task, newest first: who moved it, from where to where, and the reason given. One query for the log, one for the names. */
async function taskHistory(ctx, id) {
	const task = await loadTask(ctx, id);
	await taskAccess(ctx, task, 'view');
	const rows = await ctx.repos.activity.listByEntity({ entityType: 'task', entityId: task.ROWID, activityType: 'stage_change', limit: 100 });
	const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean).map(String))];
	const people = ids.length ? await ctx.repos.people.findByIds(ids) : [];
	const nameOf = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
	const items = rows.map((r) => ({ at: r.logged_at || null, from: r.from_value || null, to: r.to_value || null, comment: r.comment_text || null, by: r.actor_id ? nameOf.get(String(r.actor_id)) || null : null }));
	return { items, count: items.length };
}

async function transitionTask(ctx, id, raw) {
	const task = await loadTask(ctx, id);
	const { isAssignee } = await taskAccess(ctx, task, 'edit');
	const input = parse(transitionInput, raw);

	if (!stagesFor(task.task_type).includes(input.to)) {
		throw badRequest(`Unknown stage for a ${task.task_type} task: ${input.to}`);
	}
	// External Install and Print Only tasks have no checklists or review: a manager closes them directly (INS-6).
	const closeDirectly = input.to === 'Completed' && canCloseDirectly(task);
	if (closeDirectly) {
		if (!isManager(ctx.actor.roles)) throw forbidden('Only a manager can close this task');
	} else {
		const check = checkTransition(task.task_type, task.stage, input.to, {
			roles: ctx.actor.roles,
			isAssignee,
		});
		if (!check.ok) {
			throw check.code === 'invalid_transition'
				? new AppError(409, 'invalid_transition', check.reason)
				: forbidden(check.reason);
		}
	}
	// DES-2: a design task cannot be completed until hours are booked on it.
	if (task.task_type === 'design' && input.to === 'Approved & Completed' && !(Number(task.booked_hours) > 0)) {
		throw new AppError(409, 'hours_required', 'Book hours on this design task before it can be completed.');
	}
	if (NEEDS_COMMENT.includes(input.to) && !input.comment) {
		throw badRequest(`A comment is required to move a task to "${input.to}"`);
	}

	// INS-3 (from the demo): fab and install work goes to review only when every crew member has closed their post-job checklist.
	if (task.stage === 'In Progress' && input.to === 'Manager Review' && !closeDirectly && ['fabrication', 'install'].includes(task.task_type) && !['Workshop', 'Maintenance'].includes(task.kind)) {
		const [links, lists] = await Promise.all([ctx.repos.assignees.listForTask(task.ROWID), ctx.repos.checklists.listByTask(task.ROWID)]);
		const closed = new Set(lists.filter((c) => c.phase === 'post' && c.checklist_status === 'Completed').map((c) => String(c.assignee_id)));
		const open = [...new Set(links.map((l) => String(l.person_id)))].filter((p) => !closed.has(p));
		if (open.length) {
			const people = await ctx.repos.people.findByIds(open);
			const names = people.map((p) => `${p.first_name || ''} ${p.last_name || ''}`.trim()).filter(Boolean);
			throw new AppError(409, 'closure_open', `Closure step still open for ${names.length ? names.join(' and ') : 'the crew'}`);
		}
	}

	const job = await ctx.repos.jobs.findById(task.job_id);
	if (job && job.stage === 'Completed - Closed') {
		throw new AppError(409, 'job_closed', 'This job is closed; its tasks cannot change');
	}

	const patch = { ROWID: task.ROWID, stage: input.to };
	if (isTerminal(input.to) && input.to !== 'Cancelled') patch.completed_at = toDbDateTime(ctx.now());
	// A manager's approval records the OH&S answer (default No) and the optional management-review flag (INS-5).
	if (task.stage === 'Manager Review' && ['Completed', 'Approved & Completed'].includes(input.to)) {
		patch.ohs_flag = input.ohs || 'No';
		if (input.management_review !== undefined) patch.management_review = input.management_review ? 'Yes' : 'No';
	}
	await ctx.repos.tasks.update(patch);
	// A manager's approval also approves the hours booked on the task.
	if (input.to === 'Completed') await ctx.repos.timeEntries.approveForTask(task.ROWID);
	if (input.to === 'Complete - Not Used') await swmsService.markNotRequired(ctx, task);
	// A reject or reopen sends the post-job checklist back to the crew and puts the hours back in review.
	if (REWORK_STAGES.includes(input.to)) {
		await ctx.repos.checklists.reopenPostForTask(task.ROWID);
		await ctx.repos.timeEntries.unapproveForTask(task.ROWID);
	}

	if (input.to === 'Completed') await afterCompleted(ctx, { ...task, ...patch });

	await logActivity(ctx, 'task', task.ROWID, 'stage_change', {
		from_value: task.stage,
		to_value: input.to,
		comment_text: input.comment,
	});
	const rollup = await recalcJob(ctx, task.job_id);
	await ctx.publish('task.stage_changed', {
		taskId: String(task.ROWID),
		jobId: String(task.job_id),
		from: task.stage,
		to: input.to,
	});

	return {
		task: present(ctx.actor, { ...task, ...patch }),
		job: rollup,
		nextStages: nextStages(task.task_type, input.to, { roles: ctx.actor.roles, isAssignee }),
	};
}

async function addAssignee(ctx, taskId, raw) {
	const task = await loadTask(ctx, taskId);
	const { grant, assigneeLinks } = await taskAccess(ctx, task, 'edit');
	if (grant.scope !== 'all') throw forbidden('Only managers can assign people');
	const input = parse(assigneeInput, raw);

	const [person] = await ctx.repos.people.findByIds([input.person_id]);
	if (!person) throw notFound('Person not found');
	if (assigneeLinks.some((l) => String(l.person_id) === String(input.person_id))) {
		throw new AppError(409, 'already_assigned', 'This person is already on the task');
	}
	if (input.role === 'lead' && assigneeLinks.some((l) => l.assignee_role === 'lead')) {
		throw new AppError(409, 'lead_exists', 'This task already has a team leader; remove them first');
	}

	const link = await ctx.repos.assignees.add({
		task_id: task.ROWID,
		person_id: person.ROWID,
		assignee_role: input.role,
	});
	if (input.role === 'lead') await ctx.repos.tasks.update({ ROWID: task.ROWID, lead_id: person.ROWID });

	await logActivity(ctx, 'task', task.ROWID, 'assigned', {
		to_value: input.role,
		payload: JSON.stringify({ personId: String(person.ROWID) }),
	});
	await ctx.publish('task.assigned', { taskId: String(task.ROWID), personId: String(person.ROWID) });
	return { assignee: { linkId: link.ROWID, personId: String(person.ROWID), role: input.role } };
}

async function removeAssignee(ctx, taskId, personId) {
	const task = await loadTask(ctx, taskId);
	const { grant, assigneeLinks } = await taskAccess(ctx, task, 'edit');
	if (grant.scope !== 'all') throw forbidden('Only managers can change assignments');
	parse(rowId, personId);

	const link = assigneeLinks.find((l) => String(l.person_id) === String(personId));
	if (!link) throw notFound('That person is not on this task');

	await ctx.repos.assignees.remove([link.ROWID]);
	// TSK-3: changing the crew clears that person's unfinished checklists (finished ones stay as a record). Done after the save.
	const open = (await ctx.repos.checklists.listByTask(task.ROWID)).filter((c) => String(c.assignee_id) === String(personId) && c.checklist_status !== 'Completed');
	if (open.length) await ctx.repos.checklists.remove(open.map((c) => c.ROWID));
	if (link.assignee_role === 'lead') await ctx.repos.tasks.update({ ROWID: task.ROWID, lead_id: null });
	await logActivity(ctx, 'task', task.ROWID, 'unassigned', {
		from_value: link.assignee_role,
		payload: JSON.stringify({ personId: String(personId) }),
	});
	return { removed: true };
}

/** JOB-4: a task can only be created from inside its job. A direct attempt gets the wording people know from the old system. */
function rejectDirectCreate() {
	throw badRequest('You cannot create a Task here. Please create it from within your job');
}

module.exports = {
	taskHistory,
	rejectDirectCreate,
	taskBoard,
	createTask,
	createWorkshopTask,
	createSubtask,
	listTasks,
	getTask,
	updateTask,
	transitionTask,
	addAssignee,
	removeAssignee,
	recalcJob,
};
