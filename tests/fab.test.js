'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const checklists = require('../lib/services/checklists');
const registers = require('../lib/services/registers');
const appSettings = require('../lib/services/appSettings');
const { generateMaintenanceTasks } = require('../lib/services/maintenance');
const F = require('../lib/domain/fab');

const ME = '105747000000900001';
const dbTask = (w, id) => w.db.tasks.find((t) => String(t.ROWID) === String(id));
async function setup() {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Workshop' });
	return { w, jobId: String(job.ROWID) };
}
const fab = async (w, jobId, over = {}) => String((await tasks.createTask(w.ctx, jobId, { task_type: 'fabrication', name: 'Cut panels', kind: 'CNC', ...over })).task.ROWID);

test('rules: fab types, spec panels, repeat dates', () => {
	assert.ok(F.FAB_KINDS.includes('CCV') && F.FAB_KINDS.includes('Maintenance') && F.FAB_KINDS.includes('Workshop'));
	assert.deepEqual(F.normaliseFabSpec('CCV', { material: ' Vinyl ', width_mm: 1200, height_mm: 600, colour: '' }).spec, { material: 'Vinyl', width_mm: 1200, height_mm: 600 });
	assert.match(F.normaliseFabSpec('CCV', { depth_mm: 5 }).error, /no spec field "depth_mm"/);
	assert.match(F.normaliseFabSpec('CNC', { width_mm: -1 }).error, /must be a number/);
	assert.match(F.normaliseFabSpec('CNC', { material: 5 }).error, /must be text/);
	assert.match(F.normaliseFabSpec('CLB', 'text').error, /must be an object/);
	assert.deepEqual(F.normaliseFabSpec('Metal', { anything: 'goes', n: 3 }).spec, { anything: 'goes', n: 3 }, 'other types are free-form');
	assert.match(F.normaliseFabSpec('Metal', { big: 'x'.repeat(190), more: 'y'.repeat(190), a: 'z'.repeat(190), b: 'q'.repeat(190), c: 'r'.repeat(190), d: 's'.repeat(190), e: 't'.repeat(190), f: 'u'.repeat(190), g: 'v'.repeat(190), h: 'w'.repeat(190), i: 'x'.repeat(190), j: 'y'.repeat(190), k: 'z'.repeat(190), l: 'x'.repeat(190), m: 'y'.repeat(190), n: 'z'.repeat(190), o: 'x'.repeat(190), p: 'y'.repeat(190), q: 'z'.repeat(190), r: 'x'.repeat(190), s: 'y'.repeat(190), t: 'z'.repeat(190) }).error, /too large/);

	assert.deepEqual(F.normaliseRepeat({ every: 2, unit: 'weeks' }), { every: 2, unit: 'weeks' });
	assert.equal(F.normaliseRepeat(null), null);
	assert.throws(() => F.normaliseRepeat({ every: 0, unit: 'days' }), /whole number/);
	assert.throws(() => F.normaliseRepeat({ every: 1, unit: 'years' }), /days, weeks or months/);
	assert.equal(F.nextRepeatDate('2026-11-01', { every: 1, unit: 'days' }), '2026-11-02');
	assert.equal(F.nextRepeatDate('2026-11-01', { every: 2, unit: 'weeks' }), '2026-11-15');
	assert.equal(F.nextRepeatDate('2026-11-01', { every: 1, unit: 'months' }), '2026-12-01', 'a month is 30 days');
	assert.equal(F.shouldRepeat({ kind: 'Workshop', stage: 'Completed' }, { every: 1, unit: 'days' }), true);
	assert.equal(F.shouldRepeat({ kind: 'Workshop', stage: 'Completed' }, { every: 1, unit: 'days', spawned: true }), false);
	assert.equal(F.shouldRepeat({ kind: 'CNC', stage: 'Completed' }, { every: 1, unit: 'days' }), false);
});

test('rules: parents with their subtasks, then stage in the custom order, then date; and what is due for maintenance', () => {
	const t = (id, stage, date, parent) => ({ ROWID: id, stage, scheduled_date: date, parent_id: parent });
	const list = F.groupAndSort([t('s1', 'Scheduled', '2026-11-05', 'p2'), t('p1', 'Scheduled', '2026-11-03'), t('p2', 'In Progress', '2026-11-09'), t('p3', 'Completed', '2026-11-01'), t('s0', 'In Progress', '2026-11-04', 'p2'), t('orphan', 'Scheduled', '2026-11-01', 'missing')]);
	assert.deepEqual(list.map((x) => x.ROWID), ['p2', 's0', 's1', 'orphan', 'p1', 'p3']);
	assert.deepEqual(list.map((x) => x.depth), [0, 1, 1, 0, 0, 0]);

	const eq = (code, over, plan) => ({ code, status: 'In service', plan, ...over });
	const due = F.dueForMaintenance([
		eq('A', {}, { frequency_days: 30, last_checked: '2026-09-01' }),
		eq('B', {}, { frequency_days: 30, last_checked: '2026-10-25' }),
		eq('C', { status: 'Off hire' }, { frequency_days: 30, last_checked: '2026-01-01' }),
		eq('D', {}, {}),
		eq('E', {}, { frequency_days: 30 }),
		eq('F', {}, { frequency_days: 30, last_checked: '2026-01-01', create_task: false }),
	], '2026-11-02');
	assert.deepEqual(due.map((x) => x.code), ['A', 'E']);
});

test('fabrication tasks: only known types; the spec follows the type; crew cannot change it', async () => {
	const { w, jobId } = await setup();
	await rejects(tasks.createTask(w.ctx, jobId, { task_type: 'fabrication', name: 'x', kind: 'Rocket' }), 400);
	const id = await fab(w, jobId, { kind: 'CCV' });
	const out = await tasks.updateTask(w.ctx, id, { spec: { material: 'Vinyl', width_mm: 1200 } });
	assert.deepEqual(JSON.parse(dbTask(w, id).spec), { material: 'Vinyl', width_mm: 1200 });
	await rejects(tasks.updateTask(w.ctx, id, { spec: { nope: 1 } }), 400);
	await tasks.updateTask(w.ctx, id, { hired_equipment: ['105747000000800001'] });
	assert.deepEqual(JSON.parse(dbTask(w, id).spec), { material: 'Vinyl', width_mm: 1200, hired_equipment: ['105747000000800001'] });
	await tasks.updateTask(w.ctx, id, { spec: { material: 'Gloss' } });
	assert.equal(JSON.parse(dbTask(w, id).spec).hired_equipment.length, 1, 'platform-kept fields survive a spec edit');
	await rejects(tasks.updateTask(w.as(['fab_worker']), id, { spec: { material: 'x' } }), 404); // not assigned to them
	assert.ok(out.task);
});

test('FAB-5: workshop tasks go under the configured workshop job, and fail clearly when none is set', async () => {
	const { w, jobId } = await setup();
	await rejects(tasks.createWorkshopTask(w.ctx, { name: 'Sweep floor' }), 409, 'workshop_job_not_set');
	await rejects(appSettings.updateSettings(w.as(['project_manager']), { workshop_job_id: jobId }), 403);
	await rejects(appSettings.updateSettings(w.ctx, { workshop_job_id: '105747000009999999' }), 404);
	await rejects(appSettings.updateSettings(w.ctx, { something_else: 1 }), 400);

	const saved = await appSettings.updateSettings(w.ctx, { workshop_job_id: jobId });
	assert.equal(saved.workshopJobName, 'Workshop');
	assert.equal(w.db.settings.length, 1);
	const task = (await tasks.createWorkshopTask(w.ctx, { name: 'Sweep floor', quoted_hours: 1 })).task;
	assert.equal(task.kind, 'Workshop');
	assert.equal(task.task_type, 'fabrication');
	assert.equal(String(task.job_id), jobId);

	await appSettings.updateSettings(w.ctx, { workshop_job_id: null });
	assert.equal((await appSettings.getSettings(w.ctx)).settings.workshop_job_id, null);
	assert.equal(w.db.settings.length, 1, 'one settings row, updated');
	await rejects(appSettings.getSettings(w.as(['project_manager'])), 403);
});

test('FAB-3: a repeating workshop task creates the next one when completed, once, and only workshop tasks repeat', async () => {
	const { w, jobId } = await setup();
	await appSettings.updateSettings(w.ctx, { workshop_job_id: jobId });
	await rejects(tasks.createTask(w.ctx, jobId, { task_type: 'fabrication', name: 'x', kind: 'CNC', repeat: { every: 1, unit: 'days' } }), 400);
	await rejects(tasks.createWorkshopTask(w.ctx, { name: 'x', repeat: { every: 0, unit: 'days' } }), 400);

	const first = (await tasks.createWorkshopTask(w.ctx, { name: 'Clean the extractor', scheduled_date: '2026-11-02', repeat: { every: 1, unit: 'weeks' } })).task;
	const id = String(first.ROWID);
	await tasks.addAssignee(w.ctx, id, { person_id: ME, role: 'lead' });
	await tasks.transitionTask(w.ctx, id, { to: 'Scheduled' });
	await tasks.transitionTask(w.ctx, id, { to: 'In Progress' });
	await tasks.transitionTask(w.ctx, id, { to: 'Manager Review' });
	await tasks.transitionTask(w.ctx, id, { to: 'Completed' });

	const all = w.db.tasks.filter((t) => t.name === 'Clean the extractor');
	assert.equal(all.length, 2, 'the next one was created');
	const next = all.find((t) => String(t.ROWID) !== id);
	assert.equal(next.scheduled_date, '2026-11-09');
	assert.equal(next.stage, 'Awaiting Scheduling');
	assert.deepEqual(JSON.parse(next.repeat_rule), { every: 1, unit: 'weeks' });
	assert.equal(JSON.parse(dbTask(w, id).repeat_rule).spawned, true);

	// Reopen and complete again: still only two tasks.
	await tasks.transitionTask(w.ctx, id, { to: 'Reopen', comment: 'redo' });
	await tasks.transitionTask(w.ctx, id, { to: 'In Progress' });
	await tasks.transitionTask(w.ctx, id, { to: 'Manager Review' });
	await tasks.transitionTask(w.ctx, id, { to: 'Completed' });
	assert.equal(w.db.tasks.filter((t) => t.name === 'Clean the extractor').length, 2);
});

test('workshop tasks have no pre-job checklist', async () => {
	const { w, jobId } = await setup();
	await appSettings.updateSettings(w.ctx, { workshop_job_id: jobId });
	const id = String((await tasks.createWorkshopTask(w.ctx, { name: 'Tidy bays' })).task.ROWID);
	await tasks.addAssignee(w.ctx, id, { person_id: ME, role: 'lead' });
	await rejects(checklists.startChecklist(w.as(['workshop']), id, { phase: 'pre' }), 409, 'no_pre_job');
});

test('FAB-4: due equipment gets one Maintenance task and its next due date moves; a rerun makes nothing; completing counts as a check', async () => {
	const { w, jobId } = await setup();
	const old = (await registers.createEquipment(w.ctx, { name: 'Bandsaw', frequency_days: 30, last_checked: '2026-09-01' })).item;
	const fresh = (await registers.createEquipment(w.ctx, { name: 'Drill', frequency_days: 30, last_checked: '2026-10-30' })).item;
	const hired = (await registers.createEquipment(w.ctx, { name: 'Lift', frequency_days: 30, last_checked: '2026-01-01', status: 'Off hire' })).item;

	const before = await generateMaintenanceTasks(w.ctx);
	assert.equal(before.ran, false, 'needs the workshop job first');
	await appSettings.updateSettings(w.ctx, { workshop_job_id: jobId });
	await rejects(generateMaintenanceTasks(w.as(['project_manager'])), 403);

	const run = await generateMaintenanceTasks(w.ctx);
	assert.deepEqual([run.ran, run.created, run.equipment], [true, 1, [old.code]]);
	const t = w.db.tasks.find((x) => x.kind === 'Maintenance');
	assert.equal(t.name, `Maintenance: Bandsaw (${old.code})`);
	assert.equal(t.scheduled_date, '2026-11-02');
	assert.equal(t.task_type, 'fabrication');
	assert.equal(t.stage, 'Awaiting Scheduling');
	assert.equal(JSON.parse(t.spec).equipment_id, old.id);

	const items = (await registers.listEquipment(w.ctx)).items;
	assert.equal(items.find((i) => i.id === old.id).lastChecked, '2026-11-02', 'next due moved forward');
	assert.equal(items.find((i) => i.id === old.id).nextDue, '2026-12-02');
	assert.equal(items.find((i) => i.id === fresh.id).lastChecked, '2026-10-30', 'not due, so untouched');
	assert.equal(items.find((i) => i.id === hired.id).lastChecked, '2026-01-01', 'off hire is never checked');

	assert.equal((await generateMaintenanceTasks(w.ctx)).created, 0, 'a rerun the same day makes nothing');
	assert.equal(w.db.tasks.filter((x) => x.kind === 'Maintenance').length, 1);

	// Finishing the maintenance task counts as the check, from the day it is finished.
	w.db.register.find((r) => String(r.ROWID) === old.id).plan = JSON.stringify({ frequency_days: 30, last_checked: '2026-10-01' });
	const id = String(t.ROWID);
	await tasks.addAssignee(w.ctx, id, { person_id: ME, role: 'lead' });
	await tasks.transitionTask(w.ctx, id, { to: 'Scheduled' });
	await tasks.transitionTask(w.ctx, id, { to: 'In Progress' });
	await tasks.transitionTask(w.ctx, id, { to: 'Manager Review' });
	await tasks.transitionTask(w.ctx, id, { to: 'Completed' });
	assert.equal((await registers.listEquipment(w.ctx)).items.find((i) => i.id === old.id).lastChecked, '2026-11-02');
});

test('FAB-2: the task list can come back grouped, parents with their subtasks', async () => {
	const { w, jobId } = await setup();
	const root = await fab(w, jobId, { name: 'Big sign' });
	const other = await fab(w, jobId, { name: 'Small sign' });
	await tasks.createSubtask(w.ctx, root);
	dbTask(w, other).stage = 'In Progress';
	const grouped = await tasks.listTasks(w.ctx, { order: 'grouped' });
	assert.deepEqual(grouped.items.map((t) => [t.name, t.depth]), [['Small sign', 0], ['Big sign', 0], ['Big sign - Subtask', 1]]);
	const plain = await tasks.listTasks(w.ctx, {});
	assert.equal('depth' in plain.items[0], false);
});
