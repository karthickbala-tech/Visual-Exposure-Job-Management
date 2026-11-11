'use strict';

/**
 * Report and dashboard rules (FSD 5.12, 5.13, section 12). Pure, no I/O. Dates are YYYY-MM-DD strings.
 * ASSUMPTIONS where the spec is silent (marked ASSUMPTION): which stages count as "ongoing", and the tiles of each dashboard.
 */
const { TERMINAL } = require('./stages');
const { addDays, daysUntil } = require('./reminders');
const { isCloseOnly } = require('./taskRules');

const FINISHED_JOB_STAGES = Object.freeze(['Completed', 'Completed - Closed']);
const isOpenTask = (t) => !TERMINAL.includes(t.stage);
/** A task is overdue when its required finish date has passed and it is not finished (DES-3: these cards turn red). */
const isOverdue = (t, today) => !!t.required_finish && String(t.required_finish).slice(0, 10) < today && isOpenTask(t);

/**
 * The job tabs of JOB-2. Returns the filter a view means: { stages?, excludeStages?, mine?: 'pm' | 'pm_or_fab' }.
 * ASSUMPTION: "Ongoing" is In Progress and On Hold; "My Open" is jobs where I am the project manager and that are not finished.
 */
function jobView(view) {
	switch (view) {
		case 'my_open':
			return { excludeStages: FINISHED_JOB_STAGES, mine: 'pm' };
		case 'my_jobs':
			return { mine: 'pm_or_fab' };
		case 'all_open':
			// Creator's All Open Jobs: everything except Completed, Cancelled and On Hold
			return { excludeStages: ['Completed', 'Cancelled', 'On Hold'] };
		case 'preparation':
			return { stages: ['Preparation'] };
		case 'ongoing':
			return { stages: ['In Progress', 'On Hold'] };
		case 'completed':
			return { stages: FINISHED_JOB_STAGES };
		default:
			return {};
	}
}

/** Per discipline: how many tasks, how many open, how many overdue, and the percent done (JOB-3). */
function kpisFor(tasks, today) {
	const out = {};
	for (const type of ['design', 'fabrication', 'install']) {
		const mine = tasks.filter((t) => t.task_type === type);
		const open = mine.filter(isOpenTask);
		const overdue = mine.filter((t) => isOverdue(t, today)).length;
		out[type] = { total: mine.length, open: open.length, overdue, percent: mine.length ? Math.round(((mine.length - open.length) / mine.length) * 100) : 0 };
	}
	return out;
}

/** Tasks grouped by stage for a kanban board, each flagged when overdue (DES-3). Stages come in the order given. */
function taskBoard(tasks, stages, today) {
	const columns = stages.map((stage) => ({ stage, items: [] }));
	const byStage = new Map(columns.map((c) => [c.stage, c]));
	for (const t of tasks) {
		const col = byStage.get(t.stage);
		if (col) col.items.push({ ROWID: String(t.ROWID), name: t.name, job_id: String(t.job_id), kind: t.kind || null, scheduled_date: t.scheduled_date || null, required_finish: t.required_finish || null, overdue: isOverdue(t, today) });
	}
	return columns.map((c) => ({ ...c, count: c.items.length, overdueCount: c.items.filter((i) => i.overdue).length }));
}

/** Which calendar a task belongs to: install excludes the close-only kinds (External Install, Print Only). */
function inCalendar(task, which) {
	if (which === 'all' || !which) return true;
	if (which === 'fab') return task.task_type === 'fabrication';
	if (which === 'design') return task.task_type === 'design';
	if (which === 'install') return task.task_type === 'install' && !isCloseOnly(task);
	return true;
}

/**
 * CMP-2: how many compliance items are overdue, expire today, or expire within 30 days, by kind (ticket, induction, document).
 * Items with no expiry date are not counted. `activeOnly` leaves out inactive records.
 */
function complianceCounts(items, today, activeOnly) {
	const kinds = {};
	for (const i of items) {
		if (activeOnly && (i.is_active === false || i.is_active === 'false')) continue;
		if (!i.expiry_date) continue;
		const left = daysUntil(String(i.expiry_date).slice(0, 10), today);
		const bucket = left < 0 ? 'overdue' : left === 0 ? 'today' : left <= 30 ? 'within30' : null;
		if (!bucket) continue;
		const k = (kinds[i.compliance_kind || 'other'] = kinds[i.compliance_kind || 'other'] || { overdue: 0, today: 0, within30: 0 });
		k[bucket] += 1;
	}
	return kinds;
}

/** SWMS list views (SW-4): all, open (not yet fully signed), completed (fully signed or not required). */
const SWMS_OPEN = Object.freeze(['Created', 'PM Signed']);
const SWMS_DONE = Object.freeze(['TL Signed', 'Not Required', 'Completed', 'Closed']);

/** The dashboards by role (FSD 5.12). ASSUMPTION: the tiles listed here; the spec names them only loosely. */
const DASHBOARD_ROLES = Object.freeze(['project_manager', 'fab_manager', 'second_ic', 'install_coordinator', 'installer', 'fab_worker', 'workshop']);

const stageCount = (tasks, stage) => tasks.filter((t) => t.stage === stage).length;

/**
 * Tile figures for one dashboard. `data`: { fab, install, design (all tasks of that type, newest first), mine (my tasks), myJobs,
 * jobs (all open jobs), equipmentOverdue, notFilled, hoursLastWeek, today }.
 */
function dashboardTiles(role, data) {
	const { today } = data;
	const open = (list) => list.filter(isOpenTask);
	const overdue = (list) => list.filter((t) => isOverdue(t, today)).length;
	const mineOpen = (type) => open(data.mine.filter((t) => t.task_type === type));
	switch (role) {
		case 'project_manager':
			return [
				{ key: 'my_open_jobs', label: 'My open jobs', value: data.myJobs.filter((j) => !FINISHED_JOB_STAGES.includes(j.stage)).length },
				{ key: 'my_install_open', label: 'My open install tasks', value: mineOpen('install').length },
				{ key: 'my_design_open', label: 'My open design tasks', value: mineOpen('design').length },
				{ key: 'fab_open', label: 'All open fab tasks', value: open(data.fab).length },
			];
		case 'fab_manager':
			return [
				{ key: 'fab_open', label: 'Open fab tasks', value: open(data.fab).length },
				{ key: 'fab_awaiting', label: 'Awaiting scheduling', value: stageCount(data.fab, 'Awaiting Scheduling') },
				{ key: 'fab_scheduled', label: 'Scheduled', value: stageCount(data.fab, 'Scheduled') },
				{ key: 'fab_in_progress', label: 'In progress', value: stageCount(data.fab, 'In Progress') },
				{ key: 'fab_review', label: 'Manager review', value: stageCount(data.fab, 'Manager Review') },
				{ key: 'fab_overdue', label: 'Overdue fab tasks', value: overdue(data.fab) },
				{ key: 'design_open', label: 'Open design tasks', value: open(data.design).length },
				{ key: 'jobs_with_fab', label: 'Jobs with fab work', value: new Set(open(data.fab).map((t) => String(t.job_id))).size },
			];
		case 'second_ic':
			return [
				{ key: 'my_fab_open', label: 'My open fab tasks', value: mineOpen('fabrication').length },
				{ key: 'my_today', label: 'My tasks today', value: data.mine.filter((t) => String(t.scheduled_date || '').slice(0, 10) === today && isOpenTask(t)).length },
				{ key: 'hours_last_week', label: 'My hours last week', value: data.hoursLastWeek },
			];
		case 'install_coordinator': {
			const installs = data.install.filter((t) => !isCloseOnly(t));
			return [
				{ key: 'install_open', label: 'Open install tasks', value: open(installs).length },
				{ key: 'install_awaiting', label: 'Awaiting scheduling', value: stageCount(installs, 'Awaiting Scheduling') },
				{ key: 'install_scheduled', label: 'Scheduled', value: stageCount(installs, 'Scheduled') },
				{ key: 'install_in_progress', label: 'In progress', value: stageCount(installs, 'In Progress') },
				{ key: 'install_review', label: 'Manager review', value: stageCount(installs, 'Manager Review') },
				{ key: 'install_overdue', label: 'Overdue install tasks', value: overdue(installs) },
			];
		}
		case 'installer':
			return [
				{ key: 'my_today', label: 'My tasks today', value: data.mine.filter((t) => String(t.scheduled_date || '').slice(0, 10) === today && isOpenTask(t)).length },
				{ key: 'my_install_open', label: 'My open install tasks', value: mineOpen('install').length },
			];
		case 'fab_worker':
			return [
				{ key: 'hours_not_filled', label: 'Hours not filled', value: data.notFilled.total },
				{ key: 'hours_not_filled_workshop', label: 'Hours not filled (workshop)', value: data.notFilled.workshop },
				{ key: 'my_today', label: 'My tasks today', value: data.mine.filter((t) => String(t.scheduled_date || '').slice(0, 10) === today && isOpenTask(t)).length },
				{ key: 'my_fab_open', label: 'My open fab tasks', value: mineOpen('fabrication').length },
			];
		case 'workshop': {
			const workshop = data.fab.filter((t) => t.kind === 'Workshop');
			return [
				{ key: 'workshop_open', label: 'Open workshop tasks', value: open(workshop).length },
				{ key: 'my_open', label: 'My open tasks', value: open(data.mine).length },
				{ key: 'equipment_overdue', label: 'Equipment checks overdue', value: data.equipmentOverdue },
			];
		}
		default:
			return [];
	}
}

/** The last full Monday-to-Sunday week before `today` (what the weekly report covers). */
function lastFullWeek(today) {
	const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
	const thisMonday = addDays(today, -dow);
	const start = addDays(thisMonday, -7);
	return { start, end: addDays(start, 6) };
}

const hoursOf = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const tenth = (n) => Math.round(n * 10) / 10;

/**
 * Fabrication task variance: booked hours against quoted hours, one line per task plus a total per job.
 * Variance is booked minus quoted (positive = over the quote). Tasks with no quoted and no booked hours are left out.
 */
function taskVariance(tasks, jobNames) {
	const items = tasks
		.filter((t) => hoursOf(t.quoted_hours) > 0 || hoursOf(t.booked_hours) > 0)
		.map((t) => {
			const quoted = hoursOf(t.quoted_hours);
			const booked = hoursOf(t.booked_hours);
			return { ROWID: String(t.ROWID), name: t.name, job_id: String(t.job_id), job_name: jobNames.get(String(t.job_id)) || null, stage: t.stage, quoted: tenth(quoted), booked: tenth(booked), variance: tenth(booked - quoted) };
		});
	const byJob = new Map();
	for (const i of items) {
		const j = byJob.get(i.job_id) || { job_id: i.job_id, job_name: i.job_name, quoted: 0, booked: 0 };
		j.quoted += i.quoted;
		j.booked += i.booked;
		byJob.set(i.job_id, j);
	}
	const jobs = [...byJob.values()].map((j) => ({ ...j, quoted: tenth(j.quoted), booked: tenth(j.booked), variance: tenth(j.booked - j.quoted) }));
	return { items, jobs };
}

module.exports = { taskVariance, FINISHED_JOB_STAGES, isOpenTask, isOverdue, jobView, kpisFor, taskBoard, inCalendar, complianceCounts, SWMS_OPEN, SWMS_DONE, DASHBOARD_ROLES, dashboardTiles, lastFullWeek };
