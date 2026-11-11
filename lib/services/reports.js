'use strict';

const { forbidden } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const R = require('../domain/reports');
const Reg = require('../domain/registers');
const { addDays } = require('../domain/reminders');
const { todayLocal } = require('../time');
const { requireGrant, assignedTaskIds } = require('./access');
const hours = require('./hours');

const rowId = schemas.rowId;
const myId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

const swmsQuery = z.object({ view: z.enum(['all', 'open', 'completed']).default('all'), mine: z.enum(['true']).optional() });
const checklistQuery = z.object({ status: z.string().max(30).optional(), phase: z.enum(['pre', 'post']).optional(), person_id: rowId.optional() });
const complianceQuery = z.object({ active: z.enum(['true', 'false']).default('true') });

/**
 * SWMS list views (SW-4): all, open (not fully signed yet), completed (fully signed or not required), and "mine" for the SWMS of
 * tasks assigned to the caller (My Open is view=open&mine=true; My Completed is view=completed&mine=true). Crew only ever see theirs.
 */
async function listSwms(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'swms', 'view');
	const q = parse(swmsQuery, rawQuery);
	const statuses = q.view === 'open' ? R.SWMS_OPEN : q.view === 'completed' ? R.SWMS_DONE : undefined;
	const rows = await ctx.repos.swms.list({ statuses });
	if (rows.length === 0) return { items: [], count: 0 };

	const tasks = await ctx.repos.tasks.list({ swmsIds: rows.map((r) => String(r.ROWID)), limit: 300 });
	const taskBySwms = new Map(tasks.map((t) => [String(t.swms_id), t]));
	let visible = rows;
	if (grant.scope !== 'all' || q.mine) {
		const mine = new Set(await assignedTaskIds(ctx));
		visible = rows.filter((r) => {
			const t = taskBySwms.get(String(r.ROWID));
			return t && mine.has(String(t.ROWID));
		});
	}
	const [jobRows, links] = await Promise.all([ctx.repos.jobs.list({ ids: [...new Set(visible.map((r) => String(r.job_id)))], limit: 300 }), ctx.repos.assignees.listForTasks([...taskBySwms.values()].map((t) => String(t.ROWID)))]);
	const jobName = new Map(jobRows.map((j) => [String(j.ROWID), j.name]));
	const json = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };
	const items = visible.map((r) => {
		const t = taskBySwms.get(String(r.ROWID));
		const sign = json(r.signoff) || {};
		const decl = json(r.declarations) || [];
		const crew = t ? links.filter((l) => String(l.task_id) === String(t.ROWID)).length : 0;
		// The three steps of the signing flow, for the progress bar: project manager, team leader, then the crew declarations.
		return { id: String(r.ROWID), status: r.swms_status, jobId: String(r.job_id), jobName: jobName.get(String(r.job_id)) || null, siteAddress: r.site_address || '', onSite: t ? t.scheduled_date || null : null, progress: { pm: !!sign.pm, tl: !!sign.tl, crewSigned: Array.isArray(decl) ? decl.length : 0, crewTotal: crew }, task: t ? { id: String(t.ROWID), name: t.name, stage: t.stage } : null };
	});
	return { items, count: items.length };
}

/** Checklists across tasks, by status, phase and person (the checklists report). Crew see only their own. */
async function listChecklists(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	const q = parse(checklistQuery, rawQuery);
	let personId = q.person_id;
	if (grant.scope !== 'all') {
		const me = myId(ctx);
		if (!me) return { items: [], count: 0 };
		if (personId && personId !== me) throw forbidden('You can only list your own checklists');
		personId = me;
	}
	const rows = await ctx.repos.checklists.list({ status: q.status, phase: q.phase, personId });
	const taskIds = [...new Set(rows.map((c) => String(c.task_id)))];
	const tasks = taskIds.length ? await ctx.repos.tasks.list({ ids: taskIds, limit: 300 }) : [];
	const nameById = new Map(tasks.map((t) => [String(t.ROWID), t.name]));
	const items = rows.map((c) => ({
		id: String(c.ROWID),
		taskId: String(c.task_id),
		taskName: nameById.get(String(c.task_id)) || null,
		phase: c.phase,
		status: c.checklist_status,
		assigneeId: c.assignee_id ? String(c.assignee_id) : null,
		role: c.assignee_role,
		hours: c.hours === undefined || c.hours === null ? null : Number(c.hours),
	}));
	return { items, count: items.length };
}

/**
 * CMP-2 (managers only): how many tickets, inductions and company documents are overdue, expire today, or expire within 30 days,
 * plus how many workers are active (VE staff and others). `active=false` includes inactive records and people too.
 */
async function complianceDashboard(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'compliance', 'view');
	if (grant.scope !== 'all') throw forbidden('Only managers can see the compliance dashboard');
	const q = parse(complianceQuery, rawQuery);
	const activeOnly = q.active !== 'false';
	const today = todayLocal(ctx.now());

	const [items, people] = await Promise.all([
		ctx.repos.compliance.listExpiringBy(addDays(today, 30), { activeOnly }),
		ctx.repos.people.list({ active: activeOnly ? true : undefined, limit: 300 }),
	]);
	const workers = people.map((p) => withBooleans(p, ['is_internal']));
	return {
		today,
		activeOnly,
		counts: R.complianceCounts(items, today, activeOnly),
		workers: { ve: workers.filter((p) => p.is_internal === true).length, other: workers.filter((p) => p.is_internal !== true).length },
		truncated: items.length >= 300,
	};
}

/** What each dashboard needs, so a dashboard only runs the queries it uses. */
const NEEDS = Object.freeze({
	project_manager: ['fab', 'mine', 'myJobs'],
	fab_manager: ['fab', 'design'],
	second_ic: ['mine', 'hoursLastWeek'],
	install_coordinator: ['install'],
	installer: ['mine'],
	fab_worker: ['mine', 'notFilled'],
	workshop: ['fab', 'mine', 'equipment'],
});

/** The tiles of one role's dashboard (FSD 5.12). The caller must hold that role (an administrator may open any). */
async function roleDashboard(ctx, role) {
	parse(z.enum(R.DASHBOARD_ROLES), role); // a 400 for a role that has no dashboard
	if (!ctx.actor.roles.includes(role) && !ctx.actor.roles.includes('admin')) throw forbidden('This dashboard is for another role');
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	const today = todayLocal(ctx.now());
	const needs = new Set(NEEDS[role]);
	const me = myId(ctx);

	const data = { today, fab: [], install: [], design: [], mine: [], myJobs: [], equipmentOverdue: 0, notFilled: { workshop: 0, other: 0, total: 0 }, hoursLastWeek: 0 };
	const all = grant.scope === 'all';
	const jobs = [];
	if (needs.has('fab') && all) jobs.push(ctx.repos.tasks.list({ type: 'fabrication', limit: 300 }).then((r) => (data.fab = r)));
	if (needs.has('install') && all) jobs.push(ctx.repos.tasks.list({ type: 'install', limit: 300 }).then((r) => (data.install = r)));
	if (needs.has('design') && all) jobs.push(ctx.repos.tasks.list({ type: 'design', limit: 300 }).then((r) => (data.design = r)));
	if (needs.has('mine') && me) {
		jobs.push(
			ctx.repos.assignees.listForPerson(me).then(async (links) => {
				const ids = [...new Set(links.map((l) => String(l.task_id)))];
				data.mine = ids.length ? await ctx.repos.tasks.list({ ids, limit: 300 }) : [];
			})
		);
	}
	if (needs.has('myJobs') && me) jobs.push(ctx.repos.jobs.list({ pmId: me, limit: 300 }).then((r) => (data.myJobs = r)));
	if (needs.has('equipment')) {
		jobs.push(
			ctx.repos.registerItems.list({ kind: 'equipment', limit: 300 }).then((rows) => {
				data.equipmentOverdue = rows.filter((e) => Reg.isOverdue({ status: e.status || 'In service', plan: parseJson(e.plan, {}) }, today)).length;
			})
		);
	}
	if (needs.has('notFilled')) jobs.push(hours.hoursNotFilled(ctx, {}).then((r) => (data.notFilled = r)));
	if (needs.has('hoursLastWeek') && me) {
		const week = R.lastFullWeek(today);
		jobs.push(hours.hoursReport(ctx, week.start, week.end, me).then((r) => (data.hoursLastWeek = r.totals.total)));
	}
	await Promise.all(jobs);
	return { role, today, tiles: R.dashboardTiles(role, data) };
}

const VARIANCE_LIMIT = 300;

/** Fabrication task variance (booked against quoted hours). Two queries at most: the tasks, then their jobs in one IN list. */
async function fabVariance(ctx) {
	const grant = requireGrant(ctx.actor, 'tasks', 'view');
	let ids;
	if (grant.scope !== 'all') {
		ids = await assignedTaskIds(ctx);
		if (ids.length === 0) return { items: [], jobs: [], capped: false };
	}
	const tasks = await ctx.repos.tasks.list({ ids, type: 'fabrication', orderBy: 'MODIFIEDTIME DESC', limit: VARIANCE_LIMIT });
	const jobRows = tasks.length ? await ctx.repos.jobs.list({ ids: [...new Set(tasks.map((t) => String(t.job_id)))], limit: 300 }) : [];
	const out = R.taskVariance(tasks, new Map(jobRows.map((j) => [String(j.ROWID), j.name])));
	return { ...out, capped: tasks.length >= VARIANCE_LIMIT };
}

module.exports = { listSwms, listChecklists, complianceDashboard, roleDashboard, fabVariance };
