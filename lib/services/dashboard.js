'use strict';

const { projectRow } = require('../authz');
const { badRequest } = require('../errors');
const { z, parse } = require('../validate');
const { TERMINAL } = require('../domain/stages');
const { todayLocal } = require('../time');
const { requireGrant, assignedTaskIds } = require('./access');
const { figuresMemo } = require('../caches');

const GLOBAL_FRESH_MS = 60 * 1000;
const MY_TASKS_LIMIT = 20;
const MAX_CALENDAR_DAYS = 62;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const calendarQuery = z.object({ from: date, to: date });

/**
 * Figures that are the same for every manager. Four small grouped queries, cached for a minute so a
 * busy morning costs the database one set of queries, not one per person per refresh.
 */
async function globalFigures(ctx, today) {
	const held = ctx.cache ? figuresMemo.get('dashboard.global') : undefined;
	if (held && held.today === today) return held;
	const cached = ctx.cache ? await ctx.cache.get('dashboard.global', GLOBAL_FRESH_MS) : null;
	if (cached && cached.today === today) return figuresMemo.set('dashboard.global', cached);

	const [jobsByStage, overdueTasks, issuesByStatus, swmsAwaiting] = await Promise.all([
		ctx.repos.jobs.countByStage(),
		ctx.repos.tasks.countOverdue(today, TERMINAL),
		ctx.repos.issues.countByStatus(),
		ctx.repos.swms.countAwaiting(),
	]);
	const figures = {
		today,
		jobsByStage,
		overdueTasks,
		openIssues: (issuesByStatus.Open || 0) + (issuesByStatus['In Progress'] || 0),
		swmsAwaiting,
		generatedAt: ctx.now().toISOString(),
	};
	if (ctx.cache) {
		figuresMemo.set('dashboard.global', figures);
		await ctx.cache.set('dashboard.global', figures);
	}
	return figures;
}

/**
 * One dashboard for everyone. Managers (who may see all tasks) get company-wide figures; everyone
 * gets their own upcoming work. Crew never see company-wide counts.
 */
async function getDashboard(ctx) {
	const jobGrant = requireGrant(ctx.actor, 'jobs', 'view');
	const taskGrant = requireGrant(ctx.actor, 'tasks', 'view');
	const today = todayLocal(ctx.now());

	const mine = await assignedTaskIds(ctx);
	const myTasks = mine.length
		? await ctx.repos.tasks.list({ ids: mine, excludeStages: TERMINAL, orderBy: 'scheduled_date ASC', limit: MY_TASKS_LIMIT })
		: [];

	const out = {
		scope: jobGrant.scope === 'all' && taskGrant.scope === 'all' ? 'all' : 'mine',
		today,
		myTasks: myTasks.map((t) => projectRow(ctx.actor.roles, 'tasks', t)),
	};
	if (out.scope === 'all') {
		const { jobsByStage, overdueTasks, openIssues, swmsAwaiting, generatedAt } = await globalFigures(ctx, today);
		Object.assign(out, { jobsByStage, overdueTasks, openIssues, swmsAwaiting, generatedAt });
	}
	return out;
}

/** Scheduled tasks between two dates (inclusive), limited to what the caller may see. */
async function getCalendar(ctx, rawQuery) {
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	const q = parse(calendarQuery, rawQuery);
	const days = (Date.parse(q.to) - Date.parse(q.from)) / 86400000;
	if (!(days >= 0)) throw badRequest('"to" must not be before "from"');
	if (days > MAX_CALENDAR_DAYS) throw badRequest(`Ask for at most ${MAX_CALENDAR_DAYS} days at a time`);

	let ids;
	if (grant.scope !== 'all') {
		ids = await assignedTaskIds(ctx);
		if (ids.length === 0) return { from: q.from, to: q.to, items: [] };
	}
	const rows = await ctx.repos.tasks.list({ ids, from: q.from, to: q.to, orderBy: 'scheduled_date ASC', limit: 300 });
	return {
		from: q.from,
		to: q.to,
		items: rows.map((t) => ({
			ROWID: String(t.ROWID),
			job_id: String(t.job_id),
			name: t.name,
			task_type: t.task_type,
			stage: t.stage,
			scheduled_date: t.scheduled_date,
		})),
	};
}

module.exports = { getDashboard, getCalendar };
