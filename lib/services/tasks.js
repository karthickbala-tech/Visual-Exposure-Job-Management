'use strict';

const { TASK_TYPES } = require('../config');
const { projectRow } = require('../authz');
const { AppError, forbidden, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { stagesFor, initialStage, isTerminal, isManager, checkTransition, nextStages } = require('../domain/stages');
const { canCloseDirectly, subtaskDraft } = require('../domain/taskRules');
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
});

const updateInput = createInput
	.omit({ task_type: true })
	.extend({ notes: z.string().max(9000).optional(), hired_equipment: z.array(rowId).max(50).optional() })
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

	return insertTask(ctx, job, input);
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
	const rows = await ctx.repos.tasks.list({
		jobId: q.job_id,
		type: q.type,
		stage: q.stage,
		ids,
		limit: q.limit,
		offset: q.offset,
	});
	return { items: rows.map((r) => present(ctx.actor, r)), count: rows.length };
}

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
	// Hired equipment is kept inside the spec of the task; it goes off hire when the install finishes on site (EQP-2).
	const { hired_equipment: hired, ...columns } = input;
	if (hired !== undefined) {
		let spec = {};
		try {
			spec = task.spec ? JSON.parse(task.spec) : {};
		} catch {
			spec = {};
		}
		columns.spec = JSON.stringify({ ...spec, hired_equipment: hired });
	}
	if (Object.keys(columns).length > 0) await ctx.repos.tasks.update({ ROWID: task.ROWID, ...columns });
	return { task: present(ctx.actor, { ...task, ...columns }) };
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
	if (NEEDS_COMMENT.includes(input.to) && !input.comment) {
		throw badRequest(`A comment is required to move a task to "${input.to}"`);
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
	if (link.assignee_role === 'lead') await ctx.repos.tasks.update({ ROWID: task.ROWID, lead_id: null });
	await logActivity(ctx, 'task', task.ROWID, 'unassigned', {
		from_value: link.assignee_role,
		payload: JSON.stringify({ personId: String(personId) }),
	});
	return { removed: true };
}

module.exports = {
	createTask,
	createSubtask,
	listTasks,
	getTask,
	updateTask,
	transitionTask,
	addAssignee,
	removeAssignee,
	recalcJob,
};
