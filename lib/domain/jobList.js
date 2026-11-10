'use strict';

const { jobView, isOverdue, isOpenTask } = require('./reports');

/** The jobs list (JOB-2): tabs with counts, hours against the quote, and a short "risk" line. Pure, no I/O. */

const TABS = ['all', 'my_open', 'my_jobs', 'preparation', 'ongoing', 'completed'];

/** Does a job belong in a tab? `me` is the signed-in person's id (or null). */
function inView(job, tab, me) {
	const v = jobView(tab);
	if (v.stages && !v.stages.includes(job.stage)) return false;
	if (v.excludeStages && v.excludeStages.includes(job.stage)) return false;
	if (v.mine === 'pm') return !!me && String(job.pm_id) === me;
	if (v.mine === 'pm_or_fab') return !!me && (String(job.pm_id) === me || String(job.fab_manager_id) === me);
	return true;
}

/** How many jobs each tab holds, for the numbers on the tabs. */
function tabCounts(jobs, me) {
	return Object.fromEntries(TABS.map((t) => [t, jobs.filter((j) => inView(j, t, me)).length]));
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round1 = (n) => Math.round(n * 10) / 10;

/** Quoted and booked hours over all the job's tasks (subtasks included: they carry their own hours). */
function hoursOf(tasks) {
	return { quoted: round1(tasks.reduce((n, t) => n + num(t.quoted_hours), 0)), booked: round1(tasks.reduce((n, t) => n + num(t.booked_hours), 0)) };
}

/** Plain-language warnings, most important first (at most two): hours over the quote, then late fab or install work. */
function risksOf(tasks, hours, today) {
	const risks = [];
	if (hours.quoted > 0 && hours.booked > hours.quoted) risks.push(`Hours ${Math.round(((hours.booked - hours.quoted) / hours.quoted) * 100)}% over quote`);
	const late = (type) => tasks.filter((t) => t.task_type === type && isOpenTask(t) && isOverdue(t, today)).length;
	if (late('fabrication')) risks.push('Fab behind schedule');
	if (late('install')) risks.push('Install behind schedule');
	if (late('design')) risks.push('Design behind schedule');
	return risks.slice(0, 2);
}

/** Booked hours (and, when allowed, labour cost) of one trade's tasks, for the wide jobs table. */
function tradeFigures(tasks, type, withMoney) {
	const own = tasks.filter((t) => t.task_type === type);
	const out = { hours: round1(own.reduce((n, t) => n + num(t.booked_hours), 0)) };
	if (withMoney) out.cost = Math.round(own.reduce((n, t) => n + num(t.labour_cost), 0) * 100) / 100;
	return out;
}

module.exports = { TABS, inView, tabCounts, hoursOf, risksOf, tradeFigures };
