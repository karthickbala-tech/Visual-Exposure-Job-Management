'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const dashboard = require('../lib/services/dashboard');
const reports = require('../lib/services/reports');
const weekly = require('../lib/services/weeklyReports');
const issues = require('../lib/services/issues');
const appSettings = require('../lib/services/appSettings');
const registers = require('../lib/services/registers');
const R = require('../lib/domain/reports');
const { run, handlers } = require('../lib/jobs/registry');

const ME = '105747000000900001';
const BOSS = '105747000000900002';
const CREW = '105747000000900003';
const quiet = { info() {}, warn() {}, error() {} };

async function setup() {
	const w = makeWorld();
	w.db.people.push({ ROWID: BOSS, first_name: 'Rachel', last_name: 'PM', email: 'rachel@example.test', roles: ['project_manager'], is_active: 'true', is_internal: 'true' });
	w.db.people.push({ ROWID: CREW, first_name: 'Sam', last_name: 'Crew', email: 'sam@example.test', roles: ['installer'], is_active: 'true', is_internal: 'false' });
	w.db.people[0].email = 'me@example.test';
	return w;
}
const mkJob = async (w, name, over = {}) => String((await jobs.createJob(w.ctx, { name, ...over })).job.ROWID);
const mkTask = async (w, jobId, input) => String((await tasks.createTask(w.ctx, jobId, input)).task.ROWID);
const dbTask = (w, id) => w.db.tasks.find((t) => String(t.ROWID) === String(id));
const dbJob = (w, id) => w.db.jobs.find((j) => String(j.ROWID) === String(id));

test('rules: job tabs, discipline numbers, kanban overdue flags, calendars', () => {
	assert.deepEqual(R.jobView('preparation'), { stages: ['Preparation'] });
	assert.deepEqual(R.jobView('ongoing').stages, ['In Progress', 'On Hold']);
	assert.deepEqual(R.jobView('completed').stages, ['Completed', 'Completed - Closed']);
	assert.equal(R.jobView('my_open').mine, 'pm');
	assert.equal(R.jobView('my_jobs').mine, 'pm_or_fab');
	assert.deepEqual(R.jobView('all'), {});
	assert.deepEqual(R.jobView(undefined), {});

	const t = (type, stage, finish) => ({ ROWID: Math.random(), task_type: type, stage, required_finish: finish, name: 'n', job_id: 1 });
	const k = R.kpisFor([t('design', 'Completed'), t('design', 'In Progress', '2026-10-01'), t('install', 'Scheduled', '2026-12-01'), t('fabrication', 'Cancelled', '2026-10-01')], '2026-11-02');
	assert.deepEqual(k.design, { total: 2, open: 1, overdue: 1, percent: 50 });
	assert.deepEqual(k.install, { total: 1, open: 1, overdue: 0, percent: 0 });
	assert.deepEqual(k.fabrication, { total: 1, open: 0, overdue: 0, percent: 100 }, 'a cancelled task is finished and never overdue');

	const board = R.taskBoard([t('design', 'In Progress', '2026-10-01'), t('design', 'In Progress', '2027-01-01'), t('design', 'Completed', '2026-10-01')], ['To be Assigned', 'In Progress', 'Completed'], '2026-11-02');
	assert.deepEqual(board.map((c) => [c.stage, c.count, c.overdueCount]), [['To be Assigned', 0, 0], ['In Progress', 2, 1], ['Completed', 1, 0]]);
	assert.equal(board[1].items[0].overdue, true);

	const inst = { task_type: 'install', kind: 'VE Install' };
	const ext = { task_type: 'install', kind: 'External Install' };
	assert.deepEqual([R.inCalendar(inst, 'install'), R.inCalendar(ext, 'install'), R.inCalendar(ext, 'all'), R.inCalendar(inst, 'fab'), R.inCalendar({ task_type: 'fabrication' }, 'fab'), R.inCalendar(inst, undefined)], [true, false, true, false, true, true]);
	assert.deepEqual(R.lastFullWeek('2026-11-02'), { start: '2026-10-26', end: '2026-11-01' });
	assert.deepEqual(R.lastFullWeek('2026-11-08'), { start: '2026-10-26', end: '2026-11-01' }, 'a Sunday is still the same week');
});

test('rules: compliance counts and the tiles of every dashboard', () => {
	const item = (kind, expiry, active = true) => ({ compliance_kind: kind, expiry_date: expiry, is_active: active });
	const c = R.complianceCounts([item('ticket', '2026-10-30'), item('ticket', '2026-11-02'), item('ticket', '2026-11-20'), item('ticket', '2027-03-01'), item('induction', '2026-11-30'), item('document', null), item('ticket', '2026-10-01', false)], '2026-11-02', true);
	assert.deepEqual(c, { ticket: { overdue: 1, today: 1, within30: 1 }, induction: { overdue: 0, today: 0, within30: 1 } });
	assert.equal(R.complianceCounts([item('ticket', '2026-10-01', false)], '2026-11-02', false).ticket.overdue, 1, 'inactive counted when asked');

	const t = (type, stage, over = {}) => ({ ROWID: String(Math.random()), task_type: type, stage, job_id: 'j1', kind: null, scheduled_date: '2026-11-02', required_finish: null, ...over });
	const data = {
		today: '2026-11-02',
		fab: [t('fabrication', 'In Progress'), t('fabrication', 'Scheduled', { required_finish: '2026-10-01' }), t('fabrication', 'In Progress', { kind: 'Workshop', job_id: 'j2' }), t('fabrication', 'Completed')],
		install: [t('install', 'Scheduled'), t('install', 'Scheduled', { kind: 'Print Only' })],
		design: [t('design', 'In Progress')],
		mine: [t('install', 'In Progress'), t('design', 'Scheduled', { scheduled_date: '2026-11-09' }), t('fabrication', 'Scheduled')],
		myJobs: [{ stage: 'In Progress' }, { stage: 'Completed' }],
		equipmentOverdue: 3,
		notFilled: { workshop: 1, other: 2, total: 3 },
		hoursLastWeek: 31.5,
	};
	const tiles = (role) => Object.fromEntries(R.dashboardTiles(role, data).map((x) => [x.key, x.value]));
	assert.deepEqual(tiles('project_manager'), { my_open_jobs: 1, my_install_open: 1, my_design_open: 1, fab_open: 3 });
	assert.deepEqual(tiles('fab_manager'), { fab_open: 3, fab_awaiting: 0, fab_scheduled: 1, fab_in_progress: 2, fab_review: 0, fab_overdue: 1, design_open: 1, jobs_with_fab: 2 });
	assert.deepEqual(tiles('second_ic'), { my_fab_open: 1, my_today: 2, hours_last_week: 31.5 });
	assert.equal(tiles('install_coordinator').install_open, 1, 'Print Only is left out of the install numbers');
	assert.deepEqual(tiles('installer'), { my_today: 2, my_install_open: 1 });
	assert.deepEqual(tiles('fab_worker'), { hours_not_filled: 3, hours_not_filled_workshop: 1, my_today: 2, my_fab_open: 1 });
	assert.deepEqual(tiles('workshop'), { workshop_open: 1, my_open: 3, equipment_overdue: 3 });
	assert.deepEqual(R.dashboardTiles('nobody', data), []);
	assert.equal(R.DASHBOARD_ROLES.length, 7);
});

test('jobs: tabs and filters work, also for crew; the job page carries discipline numbers', async () => {
	const w = await setup();
	const a = await mkJob(w, 'Pylon refresh', { pm_id: ME });
	const b = await mkJob(w, 'Harbour wayfinding', { pm_id: BOSS, fab_manager_id: ME });
	const c = await mkJob(w, 'Old signage', { pm_id: ME });
	dbJob(w, a).stage = 'In Progress';
	dbJob(w, c).stage = 'Completed - Closed';
	const names = async (q, ctx = w.ctx) => (await jobs.listJobs(ctx, q)).items.map((j) => j.name).sort();

	assert.deepEqual(await names({ view: 'all' }), ['Harbour wayfinding', 'Old signage', 'Pylon refresh']);
	assert.deepEqual(await names({ view: 'my_open' }), ['Pylon refresh'], 'mine as project manager, not finished');
	assert.deepEqual(await names({ view: 'my_jobs' }), ['Harbour wayfinding', 'Old signage', 'Pylon refresh'], 'project manager or fab manager');
	assert.deepEqual(await names({ view: 'preparation' }), ['Harbour wayfinding']);
	assert.deepEqual(await names({ view: 'ongoing' }), ['Pylon refresh']);
	assert.deepEqual(await names({ view: 'completed' }), ['Old signage']);
	assert.deepEqual(await names({ pm_id: BOSS }), ['Harbour wayfinding']);
	assert.deepEqual(await names({ fab_manager_id: ME }), ['Harbour wayfinding']);
	assert.deepEqual(await names({ search: 'pylon' }), ['Pylon refresh']);
	await rejects(jobs.listJobs(w.ctx, { search: "x' OR '1'='1" }), 400);
	await rejects(jobs.listJobs(w.ctx, { view: 'nonsense' }), 400);
	assert.deepEqual(await names({ view: 'my_open' }, w.as(['project_manager'], null)), [], 'no person record, no "mine"');

	await mkTask(w, a, { task_type: 'design', name: 'Artwork', required_finish: '2026-10-01' });
	await mkTask(w, a, { task_type: 'install', name: 'Fit', kind: 'VE Install' });
	const page = await jobs.getJob(w.ctx, a);
	assert.deepEqual(page.kpis.design, { total: 1, open: 1, overdue: 1, percent: 0 });
	assert.equal(page.kpis.install.total, 1);
	assert.equal(page.kpis.fabrication.total, 0);
});

test('tasks: filters by kind, person, open, overdue and dates; kanban board; crew limits', async () => {
	const w = await setup();
	const j = await mkJob(w, 'Workshop job');
	const a = await mkTask(w, j, { task_type: 'fabrication', name: 'Cut', kind: 'CNC', scheduled_date: '2026-11-03', required_finish: '2026-10-20' });
	const b = await mkTask(w, j, { task_type: 'fabrication', name: 'Paint', kind: 'Paint', scheduled_date: '2026-11-20' });
	const d = await mkTask(w, j, { task_type: 'design', name: 'Artwork', required_finish: '2026-10-01' });
	await tasks.addAssignee(w.ctx, a, { person_id: CREW, role: 'lead' });
	dbTask(w, d).stage = 'Completed';
	const names = async (q, ctx = w.ctx) => (await tasks.listTasks(ctx, q)).items.map((t) => t.name).sort();

	assert.deepEqual(await names({ kind: 'CNC' }), ['Cut']);
	assert.deepEqual(await names({ assignee: CREW }), ['Cut']);
	assert.deepEqual(await names({ assignee: 'me' }, w.as(['installer'], CREW)), ['Cut']);
	assert.deepEqual(await names({ assignee: 'me' }), [], 'I have no tasks');
	assert.deepEqual(await names({ open: 'true' }), ['Cut', 'Paint']);
	assert.deepEqual(await names({ overdue: 'true' }), ['Cut'], 'the completed design task is not overdue');
	assert.deepEqual(await names({ from: '2026-11-01', to: '2026-11-10' }), ['Cut']);
	await rejects(tasks.listTasks(w.as(['installer'], CREW), { assignee: BOSS }), 403);
	await rejects(tasks.listTasks(w.ctx, { overdue: 'false' }), 400);

	const board = await tasks.taskBoard(w.ctx, { type: 'fabrication' });
	assert.equal(board.type, 'fabrication');
	const awaiting = board.columns.find((c) => c.stage === 'Awaiting Scheduling');
	assert.equal(awaiting.count, 2);
	assert.equal(awaiting.overdueCount, 1);
	assert.equal(awaiting.items.find((i) => i.name === 'Cut').overdue, true);
	const crew = await tasks.taskBoard(w.as(['installer'], CREW), { type: 'fabrication' });
	assert.equal(crew.columns.reduce((n, c) => n + c.count, 0), 1, 'crew see only their own on the board');
	await rejects(tasks.taskBoard(w.ctx, { type: 'nope' }), 400);
	await rejects(tasks.taskBoard(w.ctx, {}), 400);
});

test('calendars by discipline: install leaves out external and print-only work; items carry the fab type', async () => {
	const w = await setup();
	const j = await mkJob(w, 'Job');
	await mkTask(w, j, { task_type: 'install', name: 'Fit', kind: 'VE Install', scheduled_date: '2026-11-03' });
	await mkTask(w, j, { task_type: 'install', name: 'Supplier', kind: 'External Install', scheduled_date: '2026-11-03' });
	await mkTask(w, j, { task_type: 'fabrication', name: 'Cut', kind: 'CNC', scheduled_date: '2026-11-04' });
	const names = async (kind) => (await dashboard.getCalendar(w.ctx, { from: '2026-11-01', to: '2026-11-30', kind })).items.map((i) => i.name).sort();
	assert.deepEqual(await names('install'), ['Fit']);
	assert.deepEqual(await names('fab'), ['Cut']);
	assert.deepEqual(await names('all'), ['Cut', 'Fit', 'Supplier'], 'the unified calendar');
	assert.deepEqual(await names(undefined), ['Cut', 'Fit', 'Supplier']);
	const cal = await dashboard.getCalendar(w.ctx, { from: '2026-11-01', to: '2026-11-30', kind: 'fab' });
	assert.equal(cal.items[0].kind, 'CNC');
	await rejects(dashboard.getCalendar(w.ctx, { from: '2026-11-01', to: '2026-11-30', kind: 'moon' }), 400);
});

test('SWMS list views (all, open, completed, mine) and the checklists report', async () => {
	const w = await setup();
	const j = await mkJob(w, 'Job');
	const t1 = await mkTask(w, j, { task_type: 'install', name: 'Fit A', kind: 'VE Install' });
	const t2 = await mkTask(w, j, { task_type: 'install', name: 'Fit B', kind: 'VE Install' });
	await tasks.addAssignee(w.ctx, t1, { person_id: CREW, role: 'lead' });
	w.db.swms[1].swms_status = 'TL Signed';
	const names = async (q, ctx = w.ctx) => (await reports.listSwms(ctx, q)).items.map((i) => i.task.name).sort();

	assert.deepEqual(await names({}), ['Fit A', 'Fit B']);
	assert.deepEqual(await names({ view: 'open' }), ['Fit A']);
	assert.deepEqual(await names({ view: 'completed' }), ['Fit B']);
	assert.deepEqual(await names({ view: 'open', mine: 'true' }, w.as(['project_manager'], CREW)), ['Fit A'], 'my open');
	assert.deepEqual(await names({ view: 'completed', mine: 'true' }, w.as(['project_manager'], CREW)), [], 'my completed');
	assert.deepEqual(await names({}, w.as(['installer'], CREW)), ['Fit A'], 'crew only ever see theirs');
	await rejects(reports.listSwms(w.ctx, { view: 'weird' }), 400);
	await rejects(reports.listSwms(w.as(['viewer']), {}), 403);

	w.db.checklists.push({ ROWID: 'c1', task_id: t1, assignee_id: CREW, phase: 'pre', checklist_status: 'Completed', assignee_role: 'lead' }, { ROWID: 'c2', task_id: t2, assignee_id: ME, phase: 'post', checklist_status: 'Not Completed', assignee_role: 'lead', hours: 4 });
	const all = await reports.listChecklists(w.ctx, {});
	assert.equal(all.count, 2);
	assert.equal(all.items.find((i) => i.id === 'c1').taskName, 'Fit A');
	assert.deepEqual((await reports.listChecklists(w.ctx, { phase: 'post' })).items.map((i) => i.id), ['c2']);
	assert.deepEqual((await reports.listChecklists(w.ctx, { status: 'Completed' })).items.map((i) => i.id), ['c1']);
	assert.deepEqual((await reports.listChecklists(w.as(['installer'], CREW), {})).items.map((i) => i.id), ['c1'], 'crew see their own');
	await rejects(reports.listChecklists(w.as(['installer'], CREW), { person_id: ME }), 403);
});

test('compliance dashboard: counts by kind and bucket, worker counts, and the active toggle; managers only', async () => {
	const w = await setup();
	const item = (kind, expiry, active = 'true') => ({ ROWID: String(Math.random()), compliance_kind: kind, expiry_date: expiry, is_active: active, person_id: ME });
	w.db.citems.push(item('ticket', '2026-10-30'), item('ticket', '2026-11-02'), item('induction', '2026-11-25'), item('ticket', '2027-06-01'), item('ticket', '2026-09-01', 'false'));
	w.db.people[1].is_active = false;

	const on = await reports.complianceDashboard(w.ctx, {});
	assert.deepEqual(on.counts, { ticket: { overdue: 1, today: 1, within30: 0 }, induction: { overdue: 0, today: 0, within30: 1 } });
	assert.deepEqual(on.workers, { ve: 0, other: 2 }, 'active people only: the test user and the crew member; the inactive (VE) project manager is left out');
	const all = await reports.complianceDashboard(w.ctx, { active: 'false' });
	assert.equal(all.counts.ticket.overdue, 2, 'inactive records included when asked');
	assert.equal(all.workers.ve + all.workers.other, 3);
	await rejects(reports.complianceDashboard(w.as(['installer'], CREW), {}), 403);
	await rejects(reports.complianceDashboard(w.ctx, { active: 'maybe' }), 400);
});

test('role dashboards: tiles come from real data, you need the role (admin can open any), and unknown roles are refused', async () => {
	const w = await setup();
	const j = await mkJob(w, 'Pylon', { pm_id: BOSS });
	const fab = await mkTask(w, j, { task_type: 'fabrication', name: 'Cut', kind: 'CNC', scheduled_date: '2026-10-30' });
	const ws = await mkTask(w, j, { task_type: 'fabrication', name: 'Tidy', kind: 'Workshop', scheduled_date: '2026-10-29' });
	await tasks.addAssignee(w.ctx, fab, { person_id: CREW, role: 'lead' });
	await tasks.addAssignee(w.ctx, ws, { person_id: CREW, role: 'lead' });
	await registers.createEquipment(w.ctx, { name: 'Saw', frequency_days: 30, last_checked: '2026-09-01' });

	const tiles = (d) => Object.fromEntries(d.tiles.map((x) => [x.key, x.value]));
	const pm = tiles(await reports.roleDashboard(w.as(['project_manager'], BOSS), 'project_manager'));
	assert.equal(pm.my_open_jobs, 1);
	assert.equal(pm.fab_open, 2);
	const worker = tiles(await reports.roleDashboard(w.as(['fab_worker'], CREW), 'fab_worker'));
	assert.deepEqual([worker.hours_not_filled, worker.hours_not_filled_workshop, worker.my_fab_open], [2, 1, 2]);
	const shop = tiles(await reports.roleDashboard(w.as(['workshop'], CREW), 'workshop'));
	assert.equal(shop.equipment_overdue, 1);
	assert.equal(shop.my_open, 2);
	const fm = tiles(await reports.roleDashboard(w.as(['fab_manager'], BOSS), 'fab_manager'));
	assert.equal(fm.fab_open, 2);
	assert.equal(fm.jobs_with_fab, 1);

	assert.equal((await reports.roleDashboard(w.ctx, 'install_coordinator')).role, 'install_coordinator', 'an admin may open any dashboard');
	await rejects(reports.roleDashboard(w.as(['installer'], CREW), 'project_manager'), 403);
	await rejects(reports.roleDashboard(w.ctx, 'janitor'), 400);
	await rejects(reports.roleDashboard(w.as(['viewer']), 'viewer'), 400);
});

test('weekly hours report: one email to the chosen people with hours only, none without recipients, admin only', async () => {
	const w = await setup();
	const j = await mkJob(w, 'Pylon');
	const t = await mkTask(w, j, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' });
	const sent = [];
	const ctx = { ...w.ctx, log: quiet, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	const entry = (date, hrs) => ({ ROWID: `e${Math.random()}`, person_id: ME, task_id: t, work_date: date, hours_single: hrs, hours_x1_5: 0, hours_x2: 0, unbilled_hours: 0, labour_cost: hrs * 99 });
	w.db.time.push(entry('2026-10-27', 6), entry('2026-10-28', 2), entry('2026-11-02', 9));

	const none = await weekly.runWeeklyHoursReport(ctx);
	assert.equal(none.ran, false);
	assert.equal(sent.length, 0);
	await appSettings.updateSettings(w.ctx, { hours_report_recipients: [BOSS, CREW] });
	const out = await weekly.runWeeklyHoursReport(ctx);
	assert.deepEqual([out.ran, out.week.start, out.week.end, out.people, out.sent], [true, '2026-10-26', '2026-11-01', 1, true]);
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].to.sort(), ['rachel@example.test', 'sam@example.test']);
	assert.match(sent[0].subject, /Weekly hours report: 2026-10-26 to 2026-11-01/);
	assert.match(sent[0].html, /Test User: fab 8,/);
	assert.ok(!/99|792|labour|cost/i.test(sent[0].html), 'hours only, never cost');
	assert.ok(!sent[0].html.includes('9,'), 'the hours outside the week are left out');
	await rejects(weekly.runWeeklyHoursReport({ ...ctx, actor: { roles: ['project_manager'], person: null } }), 403);
});

test('weekly issues report: one email per department with open issues, to that department people', async () => {
	const w = await setup();
	const sent = [];
	const ctx = { ...w.ctx, log: quiet, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	assert.deepEqual(await weekly.runWeeklyIssuesReport(ctx), { ran: true, departments: 0, sent: 0 }, 'nothing open, nothing sent');

	await appSettings.updateSettings(w.ctx, { issue_routing: { 'Civic Billboards': { manager_id: CREW } } });
	const a = (await issues.createIssue(w.ctx, { subject: 'Billboard dispute', department: 'Civic Billboards', billboard_site: 'S1', billboard_face: 'North', issue_priority: 'High' })).issue;
	await issues.createIssue(w.ctx, { subject: 'Wet floor', department: 'Install' });
	await issues.createIssue(w.ctx, { subject: 'Cracked panel', department: 'Install' });
	const resolved = (await issues.createIssue(w.ctx, { subject: 'Old', department: 'Management' })).issue;
	await issues.updateIssue(w.ctx, resolved.ROWID, { issue_status: 'Completed', work_completed: 'Done' });
	await issues.updateIssue(w.ctx, a.ROWID, { assigned_to_id: BOSS });

	const out = await weekly.runWeeklyIssuesReport(ctx);
	assert.deepEqual([out.departments, out.sent], [2, 2], 'Management has only a completed issue, so no email');
	const civic = sent.find((m) => /Civic Billboards/.test(m.subject));
	const install = sent.find((m) => /Install/.test(m.subject));
	assert.deepEqual(civic.to, ['sam@example.test'], 'its own manager from the routing');
	assert.deepEqual(install.to, ['rachel@example.test'], 'no routing: the project managers');
	assert.match(civic.subject, /Open issues this week: Civic Billboards \(1\)/);
	assert.match(civic.html, /Billboard dispute - High, To Be discussed, open 0 days, assigned to Rachel PM/);
	assert.match(install.subject, /\(2\)/);
	await rejects(weekly.runWeeklyIssuesReport({ ...ctx, actor: { roles: ['project_manager'], person: null } }), 403);
});

test('the scheduled jobs for the weekly reports exist and run', async () => {
	assert.equal(typeof handlers['weekly-hours-report'], 'function');
	assert.equal(typeof handlers['weekly-issues-report'], 'function');
	const w = await setup();
	const ctx = { systemCtx: { ...w.ctx, log: quiet, mailer: { send: async () => ({ sent: true, count: 1 }) } }, log: quiet };
	assert.deepEqual(await run('weekly-issues-report', {}, ctx), { ran: true });
	assert.deepEqual(await run('weekly-hours-report', {}, ctx), { ran: true });
});
