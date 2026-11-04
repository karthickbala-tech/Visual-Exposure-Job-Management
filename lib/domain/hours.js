'use strict';

/**
 * Hours reporting rules (FSD HRS-1, HRS-3, HRS-4). Pure, no I/O. Dates are YYYY-MM-DD strings.
 * ASSUMPTIONS where the spec is silent: weeks run Monday to Sunday; "final" hours are total worked minus unbilled
 * (never below zero); workshop hours are counted in the total (the Creator app left them out, which was a defect).
 */
const { addDays, daysUntil } = require('./reminders');

const round2 = (n) => Math.round(n * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** The Monday of the week a date falls in. */
function mondayOf(date) {
	const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
	return addDays(date, -dow);
}
const weekDays = (monday) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/**
 * The pay period (HRS-3) a date falls in, from one configuration: an anchor date and a length in days.
 * Works for dates before the anchor too. Returns { start, end } (both inclusive).
 */
function payPeriodFor(config, date) {
	const len = Number(config.length_days);
	const index = Math.floor(daysUntil(date, config.start_date) / len); // whole periods since the anchor
	const start = addDays(config.start_date, index * len);
	return { start, end: addDays(start, len - 1) };
}
const previousPeriod = (config, period) => payPeriodFor(config, addDays(period.start, -1));

/** Which column an entry belongs in: workshop comes from the task kind, the rest from the task type. */
function bucketOf(entry, task) {
	if (task && task.task_type === 'fabrication' && task.kind === 'Workshop') return 'workshop';
	const type = (task && task.task_type) || entry.entry_kind;
	if (type === 'install') return 'install';
	if (type === 'design') return 'design';
	if (type === 'fabrication') return 'fab';
	return 'other';
}

const workedHours = (e) => num(e.hours_single) + num(e.hours_x1_5) + num(e.hours_x2);
const emptyCell = () => ({ fab: 0, install: 0, workshop: 0, design: 0, other: 0, unbilled: 0, total: 0, final: 0 });

function finishCell(c) {
	for (const k of ['fab', 'install', 'workshop', 'design', 'other', 'unbilled']) c[k] = round2(c[k]);
	c.total = round2(c.fab + c.install + c.workshop + c.design + c.other); // workshop IS included
	c.final = round2(Math.max(0, c.total - c.unbilled));
	return c;
}

/**
 * Per person, per day, hours by kind plus unbilled and final, and a total for the whole range.
 * entries: time entries; tasksById: Map of task id -> task. Entries outside [from, to] are ignored.
 * Returns an array of { personId, days: { date: cell }, totals: cell }, ordered by person id.
 */
function aggregateHours(entries, tasksById, from, to) {
	const people = new Map();
	for (const e of entries) {
		const date = String(e.work_date || '').slice(0, 10);
		if (!date || date < from || date > to) continue;
		const pid = String(e.person_id);
		const person = people.get(pid) || { personId: pid, days: {}, totals: emptyCell() };
		people.set(pid, person);
		const bucket = bucketOf(e, tasksById.get(String(e.task_id)));
		const cell = (person.days[date] = person.days[date] || emptyCell());
		const h = workedHours(e);
		cell[bucket] += h;
		cell.unbilled += num(e.unbilled_hours);
		person.totals[bucket] += h;
		person.totals.unbilled += num(e.unbilled_hours);
	}
	const out = [...people.values()].sort((a, b) => a.personId.localeCompare(b.personId));
	for (const p of out) {
		for (const c of Object.values(p.days)) finishCell(c);
		finishCell(p.totals);
	}
	return out;
}

/**
 * HRS-4: fabrication work scheduled in the past for which the person has not yet filled in their post-job checklist (so no
 * hours are booked). Cancelled and not-used tasks are ignored; an optional cutoff date ignores older work.
 * Returns { workshop, other, total }.
 */
function hoursNotFilled({ tasks, postDoneTaskIds, today, cutoff }) {
	const done = new Set(postDoneTaskIds.map(String));
	const result = { workshop: 0, other: 0, total: 0 };
	for (const t of tasks) {
		if (t.task_type !== 'fabrication') continue;
		if (['Cancelled', 'Complete - Not Used'].includes(t.stage)) continue;
		const date = t.scheduled_date ? String(t.scheduled_date).slice(0, 10) : null;
		if (!date || date >= today || (cutoff && date < cutoff)) continue;
		if (done.has(String(t.ROWID))) continue;
		if (t.kind === 'Workshop') result.workshop += 1;
		else result.other += 1;
		result.total += 1;
	}
	return result;
}

/** Add several cells together (for the all-people total of a report). */
function sumCells(cells) {
	const t = emptyCell();
	for (const c of cells) for (const k of ['fab', 'install', 'workshop', 'design', 'other', 'unbilled']) t[k] += c[k];
	return finishCell(t);
}

module.exports = { sumCells, round2, mondayOf, weekDays, payPeriodFor, previousPeriod, bucketOf, aggregateHours, hoursNotFilled, workedHours };
