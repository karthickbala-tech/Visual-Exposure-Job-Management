'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const hours = require('../lib/services/hours');
const appSettings = require('../lib/services/appSettings');
const H = require('../lib/domain/hours');

const ME = '105747000000900001';
const OTHER = '105747000000900002';

test('rules: weeks run Monday to Sunday', () => {
	assert.equal(H.mondayOf('2026-11-04'), '2026-11-02'); // a Wednesday
	assert.equal(H.mondayOf('2026-11-02'), '2026-11-02');
	assert.equal(H.mondayOf('2026-11-08'), '2026-11-02'); // the Sunday
	assert.deepEqual(H.weekDays('2026-11-02'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08']);
});

test('rules: one pay-period setting gives this and last period, also for dates before the anchor', () => {
	const cfg = { start_date: '2026-10-05', length_days: 14 };
	assert.deepEqual(H.payPeriodFor(cfg, '2026-11-04'), { start: '2026-11-02', end: '2026-11-15' });
	assert.deepEqual(H.payPeriodFor(cfg, '2026-10-05'), { start: '2026-10-05', end: '2026-10-18' });
	assert.deepEqual(H.payPeriodFor(cfg, '2026-10-04'), { start: '2026-09-21', end: '2026-10-04' });
	assert.deepEqual(H.previousPeriod(cfg, { start: '2026-11-02', end: '2026-11-15' }), { start: '2026-10-19', end: '2026-11-01' });
	assert.deepEqual(H.payPeriodFor({ start_date: '2026-11-02', length_days: 7 }, '2026-11-09'), { start: '2026-11-09', end: '2026-11-15' });
});

test('rules: hours roll up by day and kind; workshop counts in the total; final is total minus unbilled', () => {
	const tasks = new Map([
		['t1', { task_type: 'fabrication', kind: 'CNC' }],
		['t2', { task_type: 'fabrication', kind: 'Workshop' }],
		['t3', { task_type: 'install', kind: 'VE Install' }],
		['t4', { task_type: 'design', kind: null }],
	]);
	const e = (person, task, date, single, over = {}) => ({ person_id: person, task_id: task, work_date: date, hours_single: single, hours_x1_5: 0, hours_x2: 0, unbilled_hours: 0, ...over });
	const rows = H.aggregateHours(
		[e('p1', 't1', '2026-11-02', 6), e('p1', 't2', '2026-11-02', 2, { unbilled_hours: 1 }), e('p1', 't3', '2026-11-03', 8, { hours_x1_5: 1, hours_x2: 0.5 }), e('p2', 't4', '2026-11-04', 4), e('p1', 't1', '2026-11-20', 9), e('p3', 'gone', '2026-11-05', 1)],
		tasks,
		'2026-11-02',
		'2026-11-08'
	);
	assert.deepEqual(rows.map((r) => r.personId), ['p1', 'p2', 'p3']);
	const p1 = rows[0];
	assert.deepEqual(p1.days['2026-11-02'], { fab: 6, install: 0, workshop: 2, design: 0, other: 0, unbilled: 1, total: 8, final: 7 });
	assert.equal(p1.days['2026-11-03'].install, 9.5, 'single + x1.5 + x2 are all hours worked');
	assert.equal(p1.totals.total, 17.5);
	assert.equal(p1.totals.workshop, 2, 'workshop is counted');
	assert.equal(p1.days['2026-11-20'], undefined, 'outside the range is ignored');
	assert.equal(rows[1].totals.design, 4);
	assert.equal(rows[2].totals.other, 1, 'an entry whose task is gone is still counted, as other');
	assert.equal(H.sumCells(rows.map((r) => r.totals)).total, 22.5);
	assert.equal(H.aggregateHours([e('p', 't1', '2026-11-02', 1, { unbilled_hours: 5 })], tasks, '2026-11-02', '2026-11-08')[0].totals.final, 0, 'final never goes below zero');
});

test('rules: hours not filled counts past fabrication work with no finished post-job checklist, workshop split out', () => {
	const t = (id, kind, date, stage = 'Scheduled', type = 'fabrication') => ({ ROWID: id, task_type: type, kind, scheduled_date: date, stage });
	const list = [t('1', 'CNC', '2026-10-30'), t('2', 'Workshop', '2026-10-31'), t('3', 'CNC', '2026-10-29'), t('4', 'CNC', '2026-11-05'), t('5', 'CNC', '2026-11-02'), t('6', 'CNC', '2026-10-01'), t('7', 'CNC', '2026-10-30', 'Cancelled'), t('8', 'VE Install', '2026-10-30', 'Scheduled', 'install'), t('9', 'CNC', null)];
	const r = H.hoursNotFilled({ tasks: list, postDoneTaskIds: ['3'], today: '2026-11-02', cutoff: '2026-10-15' });
	assert.deepEqual(r, { workshop: 1, other: 1, total: 2 }, 'task 1 and the workshop task 2; 3 is filled, 4 and 5 are not in the past, 6 is before the cutoff, 7 is cancelled, 8 is install');
	assert.equal(H.hoursNotFilled({ tasks: list, postDoneTaskIds: [], today: '2026-11-02', cutoff: null }).total, 4);
});

async function setup() {
	const w = makeWorld();
	w.db.people.push({ ROWID: OTHER, first_name: 'Sam', last_name: 'Installer', hourly_rate: 30 });
	w.db.people[0].hourly_rate = 40;
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon' });
	return { w, jobId: String(job.ROWID) };
}
const mk = async (w, jobId, input) => String((await tasks.createTask(w.ctx, jobId, input)).task.ROWID);
const entry = (task, person, date, hrs, over = {}) => ({ ROWID: `e${Math.random()}`, person_id: person, task_id: task, work_date: date, hours_single: hrs, hours_x1_5: 0, hours_x2: 0, unbilled_hours: 0, labour_cost: hrs * 40, ...over });

test('weekly hours: managers see everyone, crew only themselves, cost only for admins', async () => {
	const { w, jobId } = await setup();
	const fabTask = await mk(w, jobId, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' });
	const inst = await mk(w, jobId, { task_type: 'install', name: 'Fit', kind: 'VE Install' });
	w.db.time.push(entry(fabTask, ME, '2026-11-02', 6), entry(inst, OTHER, '2026-11-03', 8, { labour_cost: 240 }), entry(fabTask, ME, '2026-11-12', 3));

	const all = await hours.weeklyHours(w.as(['project_manager'], OTHER), { week: '2026-11-04' });
	assert.equal(all.weekStart, '2026-11-02');
	assert.equal(all.days.length, 7);
	assert.equal(all.rows.length, 2);
	assert.equal(all.totals.total, 14);
	assert.equal(all.rows.find((r) => r.personId === ME).name, 'Test User');
	assert.equal('labourCost' in all.rows[0], false, 'a project manager does not see cost');

	const admin = await hours.weeklyHours(w.ctx, { week: '2026-11-04' });
	assert.equal(admin.rows.find((r) => r.personId === OTHER).labourCost, 240);

	const mine = await hours.weeklyHours(w.as(['installer'], ME), { week: '2026-11-04' });
	assert.deepEqual(mine.rows.map((r) => r.personId), [ME]);
	assert.equal(mine.totals.total, 6);
	await rejects(hours.weeklyHours(w.as(['installer'], ME), { week: '2026-11-04', person_id: OTHER }), 404);
	await rejects(hours.weeklyHours(w.as(['viewer'], ME), {}), 403);
	const onePerson = await hours.weeklyHours(w.as(['project_manager'], OTHER), { week: '2026-11-04', person_id: ME });
	assert.deepEqual(onePerson.rows.map((r) => r.personId), [ME]);
	assert.equal(onePerson.truncated, false);
});

test('pay period: needs the setting, validates it, and gives this and last period totals', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' });
	await rejects(hours.payPeriodHours(w.ctx, {}), 409, 'pay_period_not_set');
	await rejects(appSettings.updateSettings(w.ctx, { pay_period: { start_date: '2026-10-05', length_days: 3 } }), 400);
	await rejects(appSettings.updateSettings(w.ctx, { pay_period: { start_date: 'nope', length_days: 14 } }), 400);
	await appSettings.updateSettings(w.ctx, { pay_period: { start_date: '2026-10-05', length_days: 14 } });
	assert.deepEqual((await appSettings.getSettings(w.ctx)).settings.pay_period, { start_date: '2026-10-05', length_days: 14 });

	w.db.time.push(entry(t, ME, '2026-11-03', 8), entry(t, ME, '2026-10-20', 5), entry(t, ME, '2026-10-10', 7));
	const now = await hours.payPeriodHours(w.ctx, {});
	assert.deepEqual([now.which, now.period.start, now.period.end, now.totals.total], ['this', '2026-11-02', '2026-11-15', 8]);
	const last = await hours.payPeriodHours(w.ctx, { which: 'last' });
	assert.deepEqual([last.period.start, last.period.end, last.totals.total], ['2026-10-19', '2026-11-01', 5]);
	await rejects(hours.payPeriodHours(w.ctx, { which: 'next' }), 400);
});

test('hours not filled: own count by default, split workshop and other, cutoff respected, crew cannot look at others', async () => {
	const { w, jobId } = await setup();
	await appSettings.updateSettings(w.ctx, { workshop_job_id: jobId });
	const a = await mk(w, jobId, { task_type: 'fabrication', name: 'Cut', kind: 'CNC', scheduled_date: '2026-10-30' });
	const b = String((await tasks.createWorkshopTask(w.ctx, { name: 'Tidy', scheduled_date: '2026-10-31' })).task.ROWID);
	const c = await mk(w, jobId, { task_type: 'fabrication', name: 'Paint', kind: 'Paint', scheduled_date: '2026-10-29' });
	for (const id of [a, b, c]) await tasks.addAssignee(w.ctx, id, { person_id: ME, role: 'lead' });
	w.db.checklists.push({ ROWID: 'c1', task_id: c, assignee_id: ME, phase: 'post', checklist_status: 'Completed' });

	const mine = await hours.hoursNotFilled(w.as(['fab_worker'], ME), {});
	assert.deepEqual([mine.workshop, mine.other, mine.total], [1, 1, 2]);
	await appSettings.updateSettings(w.ctx, { hours_cutoff_date: '2026-10-31' });
	assert.equal((await hours.hoursNotFilled(w.as(['fab_worker'], ME), {})).total, 1, 'older work is ignored');
	await rejects(hours.hoursNotFilled(w.as(['fab_worker'], ME), { person_id: OTHER }), 404);
	assert.equal((await hours.hoursNotFilled(w.as(['project_manager'], OTHER), { person_id: ME })).personId, ME);
});

test('booking hours by hand: for yourself, or a manager for someone on the task; checks and limits; totals update', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'design', name: 'Artwork', quoted_hours: 10 });
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	const crew = w.as(['designer'], ME);

	const out = await hours.addTimeEntry(crew, t, { work_date: '2026-11-03', hours: 6, unbilled_hours: 1 });
	assert.equal(out.task.bookedHours, 6);
	assert.equal('labour_cost' in out.entry, false, 'crew do not see cost');
	assert.equal(w.db.time[0].entry_source, 'manual');
	assert.equal(w.db.time[0].labour_cost, 240);
	assert.equal(w.db.tasks.find((x) => String(x.ROWID) === t).booked_hours, 6);

	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', hours: 17 }), 400);
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', hours: 2, unbilled_hours: 3 }), 400);
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', hours: 2, person_id: OTHER }), 403);
	await rejects(hours.addTimeEntry(w.ctx, t, { work_date: '2026-11-03', hours: 2, person_id: OTHER }), 400); // OTHER is not on the task
	await tasks.addAssignee(w.ctx, t, { person_id: OTHER, role: 'member' });
	const byManager = await hours.addTimeEntry(w.ctx, t, { work_date: '2026-11-04', hours: 2, person_id: OTHER });
	assert.equal(byManager.task.bookedHours, 8);
	assert.equal(w.db.time.find((e) => e.person_id === OTHER).labour_cost, 60);

	w.db.tasks.find((x) => String(x.ROWID) === t).stage = 'Cancelled';
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-05', hours: 1 }), 409, 'task_closed');
});

test('DES-2: a design task cannot be completed until hours are booked on it', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'design', name: 'Artwork' });
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	w.db.tasks.find((x) => String(x.ROWID) === t).stage = 'Manager Review';
	const e = await rejects(tasks.transitionTask(w.ctx, t, { to: 'Approved & Completed' }), 409, 'hours_required');
	assert.match(e.message, /Book hours/);
	await hours.addTimeEntry(w.as(['designer'], ME), t, { work_date: '2026-11-03', hours: 3 });
	const done = await tasks.transitionTask(w.ctx, t, { to: 'Approved & Completed' });
	assert.equal(done.task.stage, 'Approved & Completed');
});

test('ratings: a manager rates each person once per finished task, 1 to 5; averages are listed', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'install', name: 'Fit', kind: 'External Install' });
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	await rejects(hours.rateEmployee(w.ctx, t, { person_id: ME, rating: 4 }), 409, 'not_complete');
	await tasks.transitionTask(w.ctx, t, { to: 'Completed' });

	await rejects(hours.rateEmployee(w.as(['installer'], ME), t, { person_id: ME, rating: 5 }), 403);
	await rejects(hours.rateEmployee(w.ctx, t, { person_id: ME, rating: 6 }), 400);
	await rejects(hours.rateEmployee(w.ctx, t, { person_id: ME, rating: 2.5 }), 400);
	await rejects(hours.rateEmployee(w.ctx, t, { person_id: OTHER, rating: 4 }), 400);
	const ok = await hours.rateEmployee(w.ctx, t, { person_id: ME, rating: 4, comment: 'Tidy site' });
	assert.equal(ok.rating, 4);
	await rejects(hours.rateEmployee(w.ctx, t, { person_id: ME, rating: 5 }), 409, 'already_rated');

	const t2 = await mk(w, jobId, { task_type: 'install', name: 'Fit 2', kind: 'Print Only' });
	await tasks.addAssignee(w.ctx, t2, { person_id: ME, role: 'lead' });
	await tasks.transitionTask(w.ctx, t2, { to: 'Completed' });
	await hours.rateEmployee(w.ctx, t2, { person_id: ME, rating: 5 });
	const list = await hours.listRatings(w.as(['project_manager'], OTHER), ME);
	assert.equal(list.count, 2);
	assert.equal(list.average, 4.5);
	assert.equal(list.items.find((i) => i.taskId === t).comment, 'Tidy site');
	await rejects(hours.listRatings(w.as(['installer'], ME), ME), 403);
	assert.deepEqual(await hours.listRatings(w.ctx, OTHER), { items: [], count: 0, average: null });
});

test('booking a past shift by start and end time: split into single, time and a half, and double; stored with the times', async () => {
	const { w, jobId } = await setup();
	const t = await mk(w, jobId, { task_type: 'design', name: 'Artwork', quoted_hours: 20 });
	await tasks.addAssignee(w.ctx, t, { person_id: ME, role: 'lead' });
	const crew = w.as(['designer'], ME);

	// Tuesday 3 Nov: 06:00 to 16:30 with a 30 minute break = 8 h single, 2 h at time and a half.
	const week = await hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '06:00', end_time: '16:30', break_minutes: 30 });
	assert.equal(week.task.bookedHours, 10);
	const e1 = w.db.time[0];
	assert.deepEqual([e1.hours_single, e1.hours_x1_5, e1.hours_x2], [8, 2, 0]);
	assert.deepEqual([e1.start_time, e1.end_time, e1.break_minutes], ['06:00', '16:30', 30]);
	assert.equal(e1.labour_cost, 400, 'cost is the total hours at the hourly rate, as for a checklist shift');

	// Saturday 7 Nov: 08:00 to 12:00 = 2 h at time and a half, 2 h double.
	await hours.addTimeEntry(crew, t, { work_date: '2026-11-07', start_time: '08:00', end_time: '12:00' });
	const e2 = w.db.time[1];
	assert.deepEqual([e2.hours_single, e2.hours_x1_5, e2.hours_x2], [0, 2, 2]);

	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '08:00' }), 400); // an end time is needed too
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '16:00', end_time: '08:00' }), 400); // end before start
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '25:00', end_time: '26:00' }), 400); // not a time
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '01:00', end_time: '19:00' }), 400); // over 16 hours
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03', start_time: '08:00', end_time: '10:00', unbilled_hours: 3 }), 400);
	await rejects(hours.addTimeEntry(crew, t, { work_date: '2026-11-03' }), 400); // neither hours nor times
});
