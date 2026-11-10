'use strict';

const { AppError, forbidden, notFound, badRequest } = require('../errors');
const { FINANCIAL_ROLES } = require('../authz');
const { z, parse, schemas } = require('../validate');
const { isTerminal } = require('../domain/stages');
const { labourCost } = require('../domain/labourCost');
const H = require('../domain/hours');
const { todayLocal, toDbDateTime } = require('../time');
const { requireGrant, taskAccess } = require('./access');
const { readSettings } = require('./appSettings');
const { refreshTaskTotals } = require('./checklists');
const { addDays } = require('../domain/reminders');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const MAX_ENTRY_HOURS = 16; // the same limit as a checklist shift

const weekQuery = z.object({ week: date.optional(), from: date.optional(), to: date.optional(), person_id: rowId.optional() });
const periodQuery = z.object({ which: z.enum(['this', 'last']).default('this'), person_id: rowId.optional() });
const personQuery = z.object({ person_id: rowId.optional() });
const entryInput = z.object({
	work_date: date,
	hours: z.number().min(0.25).max(MAX_ENTRY_HOURS),
	unbilled_hours: z.number().min(0).max(MAX_ENTRY_HOURS).optional(),
	person_id: rowId.optional(), // a manager can book hours for someone on the task
});
const ratingInput = z.object({ person_id: rowId, rating: z.number().int().min(1).max(5), comment: z.string().trim().max(500).optional() });

const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '');
const myId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const seesMoney = (ctx) => (ctx.actor.roles || []).some((r) => FINANCIAL_ROLES.includes(r));

/** Who may be looked at: managers (scope all) choose anyone or everyone; everyone else sees only themselves. */
function whoFor(ctx, grant, requested) {
	if (grant.scope === 'all') return requested || null; // null = everyone
	const me = myId(ctx);
	if (!me) return 'none';
	if (requested && requested !== me) throw notFound('Not found');
	return me;
}

/** One report over [from, to]: three queries (entries, their tasks, the people), however many people there are. */
async function hoursReport(ctx, from, to, personId) {
	const entries = personId === 'none' ? [] : await ctx.repos.timeEntries.listBetween({ from, to, personId: personId || undefined });
	const taskIds = [...new Set(entries.map((e) => e.task_id).filter(Boolean).map(String))];
	const tasks = taskIds.length ? await ctx.repos.tasks.list({ ids: taskIds, limit: 300 }) : [];
	const rows = H.aggregateHours(entries, new Map(tasks.map((t) => [String(t.ROWID), t])), from, to);
	const people = rows.length ? await ctx.repos.people.findByIds(rows.map((r) => r.personId)) : [];
	const nameById = new Map(people.map((p) => [String(p.ROWID), fullName(p)]));

	const money = seesMoney(ctx);
	const cost = new Map();
	if (money) for (const e of entries) cost.set(String(e.person_id), (cost.get(String(e.person_id)) || 0) + (Number(e.labour_cost) || 0));
	const out = rows.map((r) => ({ ...r, name: nameById.get(r.personId) || '', ...(money ? { labourCost: H.round2(cost.get(r.personId) || 0) } : {}) }));
	return { rows: out, totals: H.sumCells(out.map((r) => r.totals)), truncated: entries.length >= 300 };
}

/** HRS-1: daily hours per person for one week (Monday to Sunday): fab, install, workshop, design, unbilled and final. */
async function weeklyHours(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'hours', 'view');
	const q = parse(weekQuery, rawQuery);
	// A custom range (for example the last 8 days) lists each day; at most 31 so one request stays small.
	if (q.from && q.to) {
		if (q.to < q.from) throw badRequest('The end date is before the start date');
		const span = [];
		for (let d = q.from; d <= q.to && span.length < 32; d = addDays(d, 1)) span.push(d);
		if (span.length > 31) throw badRequest('Choose 31 days or fewer');
		const rangeReport = await hoursReport(ctx, q.from, q.to, whoFor(ctx, grant, q.person_id));
		return { weekStart: q.from, days: span, ...rangeReport };
	}
	const monday = H.mondayOf(q.week || todayLocal(ctx.now()));
	const days = H.weekDays(monday);
	const report = await hoursReport(ctx, days[0], days[6], whoFor(ctx, grant, q.person_id));
	return { weekStart: monday, days, ...report };
}

/** HRS-3: hours in this or the last pay period, from the one pay-period setting. */
async function payPeriodHours(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'hours', 'view');
	const q = parse(periodQuery, rawQuery);
	const settings = await readSettings(ctx.repos);
	if (!settings.pay_period) throw new AppError(409, 'pay_period_not_set', 'Set the pay period in Admin settings first.');
	let period = H.payPeriodFor(settings.pay_period, todayLocal(ctx.now()));
	if (q.which === 'last') period = H.previousPeriod(settings.pay_period, period);
	const report = await hoursReport(ctx, period.start, period.end, whoFor(ctx, grant, q.person_id));
	return { which: q.which, period, ...report };
}

/** HRS-4: past fabrication work the person has not filled in yet, split into workshop and other. */
async function hoursNotFilled(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'hours', 'view');
	const q = parse(personQuery, rawQuery);
	const who = whoFor(ctx, grant, q.person_id) || myId(ctx);
	if (!who || who === 'none') return { personId: null, workshop: 0, other: 0, total: 0 };

	const links = await ctx.repos.assignees.listForPerson(who);
	const ids = [...new Set(links.map((l) => String(l.task_id)))];
	const tasks = ids.length ? await ctx.repos.tasks.list({ ids, limit: 300 }) : [];
	const done = (await ctx.repos.checklists.listDonePostForPerson(who)).map((c) => c.task_id);
	const settings = await readSettings(ctx.repos);
	return { personId: who, ...H.hoursNotFilled({ tasks, postDoneTaskIds: done, today: todayLocal(ctx.now()), cutoff: settings.hours_cutoff_date || null }) };
}

/**
 * Book hours on a task by hand (a timesheet line). Design tasks have no checklists, so this is how their hours get booked
 * (and a design task needs booked hours before it can be completed). The hours count as plain hours: there are no start and
 * end times, so no overtime split. A manager can book for anyone on the task; everyone else for themselves.
 */
async function addTimeEntry(ctx, taskId, raw) {
	parse(rowId, taskId);
	const input = parse(entryInput, raw);
	const task = await ctx.repos.tasks.findById(taskId);
	if (!task) throw notFound('Task not found');
	const { grant, assigneeLinks } = await taskAccess(ctx, task, 'edit');
	if (isTerminal(task.stage)) throw new AppError(409, 'task_closed', 'This task is finished');
	const job = await ctx.repos.jobs.findById(task.job_id);
	if (job && job.stage === 'Completed - Closed') throw new AppError(409, 'job_closed', 'This job is closed');

	let personId = myId(ctx);
	if (input.person_id) {
		if (grant.scope !== 'all') throw forbidden('You can only book your own hours');
		personId = input.person_id;
	}
	if (!personId) throw badRequest('There is no person record for your account');
	if (!assigneeLinks.some((l) => String(l.person_id) === String(personId))) throw badRequest('That person is not assigned to this task');
	if (input.unbilled_hours !== undefined && input.unbilled_hours > input.hours) throw badRequest('Unbilled hours cannot be more than the hours worked');

	const [person] = await ctx.repos.people.findByIds([personId]);
	const row = await ctx.repos.timeEntries.insert({
		person_id: personId,
		task_id: task.ROWID,
		work_date: input.work_date,
		entry_kind: task.task_type,
		hours_single: input.hours,
		hours_x1_5: 0,
		hours_x2: 0,
		unbilled_hours: input.unbilled_hours || 0,
		labour_cost: labourCost(input.hours, person ? person.hourly_rate : 0),
		entry_source: 'manual',
		approved: 'false',
	});
	const totals = await refreshTaskTotals(ctx, task);
	const { labour_cost: _hidden, ...entry } = row;
	return { entry: seesMoney(ctx) ? row : entry, task: { bookedHours: totals.booked_hours } };
}

/**
 * HRS-5: a manager rates someone who worked on a finished task (1 to 5, with an optional comment), once per person per task.
 * ASSUMPTION: a 1 to 5 scale (the spec gives none). Ratings live in the activity log (the plan keeps them there).
 */
async function rateEmployee(ctx, taskId, raw) {
	parse(rowId, taskId);
	const input = parse(ratingInput, raw);
	const task = await ctx.repos.tasks.findById(taskId);
	if (!task) throw notFound('Task not found');
	const { grant, assigneeLinks } = await taskAccess(ctx, task, 'edit');
	if (grant.scope !== 'all') throw forbidden('Only a manager can rate');
	if (!['Completed', 'Approved & Completed'].includes(task.stage)) throw new AppError(409, 'not_complete', 'A task can be rated once it is completed');
	if (!assigneeLinks.some((l) => String(l.person_id) === String(input.person_id))) throw badRequest('That person is not assigned to this task');
	if (await ctx.repos.activity.findByFromValue({ entityType: 'person', entityId: input.person_id, activityType: 'rating', fromValue: String(task.ROWID) })) {
		throw new AppError(409, 'already_rated', 'This person has already been rated for this task');
	}
	await ctx.repos.activity.insert({
		entity_type: 'person',
		entity_id: input.person_id,
		activity_type: 'rating',
		actor_id: myId(ctx) || undefined,
		from_value: String(task.ROWID),
		to_value: String(input.rating),
		comment_text: input.comment,
		logged_at: toDbDateTime(ctx.now()),
	});
	return { personId: input.person_id, taskId: String(task.ROWID), rating: input.rating };
}

/** A person's ratings, newest first, with the average. Managers only (people view). */
async function listRatings(ctx, personId) {
	requireGrant(ctx.actor, 'people', 'view');
	parse(rowId, personId);
	const rows = await ctx.repos.activity.listByEntity({ entityType: 'person', entityId: personId, activityType: 'rating', limit: 100 });
	const items = rows.map((r) => ({ taskId: String(r.from_value), rating: Number(r.to_value), comment: r.comment_text || '', ratedAt: r.logged_at || null }));
	const average = items.length ? H.round2(items.reduce((n, i) => n + i.rating, 0) / items.length) : null;
	return { items, count: items.length, average };
}

module.exports = { hoursReport, weeklyHours, payPeriodHours, hoursNotFilled, addTimeEntry, rateEmployee, listRatings };
