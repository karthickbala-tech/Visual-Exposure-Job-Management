'use strict';

const { releaseHiredEquipment } = require('./registers');

const { projectRow } = require('../authz');
const { AppError, forbidden, notFound, badRequest } = require('../errors');
const { z, parse, schemas } = require('../validate');
const { isTerminal } = require('../domain/stages');
const { activeQuestions, checkAnswer, progressOf, nextQuestion } = require('../domain/checklistProgress');
const { splitPayHours } = require('../domain/payRules');
const { labourCost, effectiveHours } = require('../domain/labourCost');
const { toDbDateTime } = require('../time');
const { requireGrant, taskAccess } = require('./access');
const { raiseFromChecklist } = require('./issues');
const { allowsPreJobChecklist } = require('../domain/swms');

const rowId = schemas.rowId;
const MAX_ANSWER_JSON = 9000; // column limit is 10,000 characters
const MAX_SHIFT_HOURS = 16; // FSD CHK-6: hard stop above 16 h
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM (24 hour)');

const startInput = z.object({ phase: z.enum(['pre', 'post']) });
const answersInput = z.object({
	answers: z.record(z.string().min(1).max(60), z.union([z.string().max(2000), z.number(), z.null()])),
});
const completeInput = z.object({
	work_date: date,
	start: clock,
	end: clock,
	break_minutes: z.number().int().min(0).max(600).default(0),
	unbilled_hours: z.number().min(0).max(16).default(0),
	is_public_holiday: z.boolean().default(false),
});

const actorId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

/** The checklist as the screen needs it: the questions, the answers, and where things stand. */
function view(ctx, checklist, template) {
	const definition = parseJson(template.definition, { sections: [] });
	const answers = parseJson(checklist.answers, {});
	return {
		checklist: {
			id: String(checklist.ROWID),
			taskId: String(checklist.task_id),
			phase: checklist.phase,
			status: checklist.checklist_status,
			role: checklist.assignee_role,
			templateKey: checklist.template_key,
			startedAt: checklist.started_at,
			finishedAt: checklist.finished_at,
			hours: checklist.hours,
			unbilledHours: checklist.unbilled_hours,
		},
		definition,
		answers,
		progress: progressOf(definition, answers),
		next: nextQuestion(definition, answers),
	};
}

async function loadChecklist(ctx, id) {
	parse(rowId, id);
	const checklist = await ctx.repos.checklists.findById(id);
	if (!checklist) throw notFound('Checklist not found');
	const template = await ctx.repos.templates.findByKey(checklist.template_key);
	if (!template) throw new AppError(500, 'template_missing', 'The checklist template is missing');
	return { checklist, template };
}

/** Only the person a checklist belongs to may fill it in; others see "not found". */
function requireOwner(ctx, checklist) {
	requireGrant(ctx.actor, 'tasks', 'edit');
	if (actorId(ctx) !== String(checklist.assignee_id)) throw notFound('Checklist not found');
}

/** Start (or reopen) the caller's own checklist for a task phase. Safe to call twice. */
async function startChecklist(ctx, taskId, raw) {
	parse(rowId, taskId);
	const { phase } = parse(startInput, raw);
	const task = await ctx.repos.tasks.findById(taskId);
	if (!task) throw notFound('Task not found');

	const { isAssignee, assigneeLinks } = await taskAccess(ctx, task, 'edit');
	if (!isAssignee) throw forbidden('Only people assigned to a task fill in its checklists');
	if (isTerminal(task.stage)) throw new AppError(409, 'task_closed', 'This task is finished');
	// Workshop tasks skip the pre-job checklist and go straight to the post-job one (WORKFLOWS section 5).
	if (phase === 'pre' && task.task_type === 'fabrication' && task.kind === 'Workshop') {
		throw new AppError(409, 'no_pre_job', 'Workshop tasks have no pre-job checklist; go straight to the post-job one.');
	}

	const personId = actorId(ctx);
	const mine = await ctx.repos.checklists.findMine({ taskId: task.ROWID, personId, phase });
	if (mine) {
		const { template } = await loadChecklist(ctx, mine.ROWID);
		return view(ctx, mine, template);
	}

	const link = assigneeLinks.find((l) => String(l.person_id) === personId);
	const role = link?.assignee_role === 'lead' ? 'lead' : 'member';
	const find = (r) => ctx.repos.templates.findLatest({ taskType: task.task_type, phase, role: r });
	const template = (await find(role)) || (role === 'lead' ? await find('member') : null);
	if (!template) throw notFound(`No ${phase}-job checklist is set up for ${task.task_type} tasks`);

	const row = await ctx.repos.checklists.insert({
		task_id: task.ROWID,
		assignee_id: personId,
		phase,
		assignee_role: role,
		template_key: template.template_key,
		template_version: template.version_no,
		checklist_status: 'In Progress',
		answers: '{}',
		started_at: toDbDateTime(ctx.now()),
	});
	return view(ctx, row, template);
}

async function getChecklist(ctx, id) {
	const { checklist, template } = await loadChecklist(ctx, id);
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	if (grant.scope !== 'all' && actorId(ctx) !== String(checklist.assignee_id)) throw notFound('Checklist not found');
	return view(ctx, checklist, template);
}

/** Checklists on one task: managers see everyone's, crew see their own. */
async function listForTask(ctx, taskId) {
	parse(rowId, taskId);
	const task = await ctx.repos.tasks.findById(taskId);
	if (!task) throw notFound('Task not found');
	const { grant } = await taskAccess(ctx, task, 'view');
	const rows = await ctx.repos.checklists.listByTask(task.ROWID);
	const visible = grant.scope === 'all' ? rows : rows.filter((c) => String(c.assignee_id) === actorId(ctx));
	return {
		items: visible.map((c) => ({
			id: String(c.ROWID),
			phase: c.phase,
			status: c.checklist_status,
			assigneeId: c.assignee_id ? String(c.assignee_id) : null,
			role: c.assignee_role,
			hours: c.hours,
		})),
	};
}

/** Save some answers. Hidden questions are dropped, bad values are refused, nothing else changes. */
async function saveAnswers(ctx, id, raw) {
	const { checklist, template } = await loadChecklist(ctx, id);
	requireOwner(ctx, checklist);
	if (checklist.checklist_status === 'Completed') throw new AppError(409, 'checklist_closed', 'This checklist is already completed');
	const { answers: incoming } = parse(answersInput, raw);

	const definition = parseJson(template.definition, { sections: [] });
	const merged = { ...parseJson(checklist.answers, {}) };
	for (const [key, value] of Object.entries(incoming)) {
		if (value === null || value === '') delete merged[key];
		else merged[key] = value;
	}

	// Judge answers against the questions that apply once the new answers are in.
	const questions = new Map(activeQuestions(definition, merged).map((q) => [q.key, q]));
	const allKeys = new Set(definition.sections.flatMap((s) => (s.questions || []).map((q) => q.key)));
	const problems = {};
	for (const key of Object.keys(incoming)) {
		if (!allKeys.has(key)) problems[key] = 'Unknown question';
		else if (questions.has(key)) {
			const msg = checkAnswer(questions.get(key), merged[key]);
			if (msg) problems[key] = msg;
		}
	}
	if (Object.keys(problems).length) throw badRequest('Some answers are not valid', problems);

	const kept = Object.fromEntries(Object.entries(merged).filter(([k]) => questions.has(k)));
	const json = JSON.stringify(kept);
	if (json.length > MAX_ANSWER_JSON) throw new AppError(413, 'value_too_large', 'Too many answers for one checklist');

	await ctx.repos.checklists.update({ ROWID: checklist.ROWID, answers: json });
	const result = view(ctx, { ...checklist, answers: json }, template);
	await ctx.publish('checklist.step_completed', { checklistId: String(checklist.ROWID), taskId: String(checklist.task_id) });
	return result;
}

/** Recompute a task's booked hours, labour cost and variance from its time entries. */
async function refreshTaskTotals(ctx, task) {
	const entries = await ctx.repos.timeEntries.listByTask(task.ROWID);
	const sum = (k) => entries.reduce((n, e) => n + Number(e[k] || 0), 0);
	const pay = { single: sum('hours_single'), x1_5: sum('hours_x1_5'), x2: sum('hours_x2') };
	const booked = Math.round((pay.single + pay.x1_5 + pay.x2) * 100) / 100;
	const patch = {
		ROWID: task.ROWID,
		booked_hours: booked,
		labour_cost: Math.round(sum('labour_cost') * 100) / 100,
		variance: Math.round((Number(task.quoted_hours || 0) - effectiveHours(pay)) * 100) / 100,
	};
	await ctx.repos.tasks.update(patch);
	return patch;
}

/**
 * Finish a checklist. A post-job checklist also needs the shift times: they become a
 * time entry (pay split and labour cost) and update the task's booked hours.
 */
/**
 * INS-2: an install task sub-stage follows its team leader checklists: pre-job done means On Site, post-job done means
 * Finished On Site (which also releases hired equipment, EQP-2). Safe to run twice.
 */
async function advanceInstallSubStage(ctx, checklist) {
	if (checklist.assignee_role !== 'lead') return;
	const task = await ctx.repos.tasks.findById(checklist.task_id);
	if (!task || task.task_type !== 'install') return;
	const next = checklist.phase === 'pre' ? 'On Site' : checklist.phase === 'post' ? 'Finished On Site' : null;
	if (!next || task.sub_stage === next) return;
	await ctx.repos.tasks.update({ ROWID: task.ROWID, sub_stage: next });
	if (next === 'Finished On Site') await releaseHiredEquipment(ctx, task);
}

async function completeChecklist(ctx, id, raw) {
	const { checklist, template } = await loadChecklist(ctx, id);
	requireOwner(ctx, checklist);
	if (checklist.checklist_status === 'Completed') throw new AppError(409, 'checklist_closed', 'This checklist is already completed');

	const definition = parseJson(template.definition, { sections: [] });
	const answers = parseJson(checklist.answers, {});
	const progress = progressOf(definition, answers);
	if (!progress.canComplete) {
		throw new AppError(409, 'checklist_incomplete', 'Some required questions are not answered yet', { missing: progress.missing });
	}

	// INS-4: a team leader cannot finish the pre-job checklist until the SWMS is signed (or not needed).
	if (checklist.phase === 'pre' && checklist.assignee_role === 'lead') {
		const task = await ctx.repos.tasks.findById(checklist.task_id);
		const swms = task && task.swms_id ? await ctx.repos.swms.findById(task.swms_id) : null;
		if (swms && !allowsPreJobChecklist(swms.swms_status)) {
			throw new AppError(409, 'swms_required', 'The SWMS must be signed by the project manager and the team leader first', { swmsId: String(swms.ROWID), status: swms.swms_status });
		}
	}

	const patch = { ROWID: checklist.ROWID, checklist_status: 'Completed', finished_at: toDbDateTime(ctx.now()) };
	let entry = null;
	let totals = null;

	if (checklist.phase === 'post') {
		const input = parse(completeInput, raw);
		let pay;
		try {
			pay = splitPayHours({
				date: input.work_date,
				start: input.start,
				end: input.end,
				breakMinutes: input.break_minutes,
				isPublicHoliday: input.is_public_holiday,
			});
		} catch (err) {
			throw badRequest(err.message);
		}
		if (pay.total > MAX_SHIFT_HOURS) throw badRequest(`A shift cannot be more than ${MAX_SHIFT_HOURS} hours`);

		const task = await ctx.repos.tasks.findById(checklist.task_id);
		const [person] = await ctx.repos.people.findByIds([checklist.assignee_id]);
		const row = {
			person_id: checklist.assignee_id,
			task_id: checklist.task_id,
			checklist_id: checklist.ROWID,
			work_date: input.work_date,
			entry_kind: task ? task.task_type : undefined,
			hours_single: pay.single,
			hours_x1_5: pay.x1_5,
			hours_x2: pay.x2,
			unbilled_hours: input.unbilled_hours,
			labour_cost: labourCost(pay.total, person ? person.hourly_rate : 0),
			entry_source: 'checklist',
			approved: 'false',
		};
		const existing = await ctx.repos.timeEntries.findByChecklist(checklist.ROWID);
		if (existing) {
			await ctx.repos.timeEntries.update({ ...row, ROWID: existing.ROWID });
			entry = { ...existing, ...row };
		} else {
			entry = await ctx.repos.timeEntries.insert(row);
		}
		patch.hours = pay.total;
		patch.unbilled_hours = input.unbilled_hours;
		if (task) totals = await refreshTaskTotals(ctx, task);
	}

	await ctx.repos.checklists.update(patch);
	await advanceInstallSubStage(ctx, checklist);

	// Answers flagged as a problem become issues for the task's department (once each).
	let raised = [];
	if (progress.issues.length) {
		const labels = new Map(activeQuestions(definition, answers).map((q) => [q.key, q.label]));
		const task = await ctx.repos.tasks.findById(checklist.task_id);
		if (task) raised = await raiseFromChecklist(ctx, task, progress.issues.map((k) => labels.get(k) || k));
	}
	await ctx.repos.activity.insert({
		entity_type: 'checklist',
		entity_id: checklist.ROWID,
		activity_type: 'completed',
		actor_id: actorId(ctx),
		logged_at: toDbDateTime(ctx.now()),
	});
	await ctx.publish('checklist.closed', {
		checklistId: String(checklist.ROWID),
		taskId: String(checklist.task_id),
		phase: checklist.phase,
		issues: progress.issues,
	});

	return {
		...view(ctx, { ...checklist, ...patch }, template),
		raisedIssues: raised.map(String),
		timeEntry: entry ? projectRow(ctx.actor.roles, 'time', entry) : null,
		task: totals ? projectRow(ctx.actor.roles, 'tasks', totals) : null,
	};
}

module.exports = {
	refreshTaskTotals, startChecklist, getChecklist, listForTask, saveAnswers, completeChecklist };
