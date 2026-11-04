'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const checklists = require('../lib/services/checklists');
const registers = require('../lib/services/registers');
const handlers = require('../lib/events/handlers');

const CREW = '105747000000900001';
const pre = { sections: [{ key: 'arrival', questions: [{ key: 'site_safe', type: 'yesno', required: true }] }] };
const post = { sections: [{ key: 'closure', questions: [{ key: 'tidy', type: 'yesno', required: true }] }] };

/** An install task (no SWMS) with the crew member as team leader, ready for its checklists. */
async function setup() {
	const w = makeWorld();
	w.db.people[0].hourly_rate = 40;
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install pylon', kind: 'Minor Task', quoted_hours: 8 });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: CREW, role: 'lead' });
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Scheduled' });
	const tpl = (phase, def, key) => ({ template_key: key, task_type: 'install', phase, assignee_role: 'lead', version_no: 1, definition: JSON.stringify(def) });
	w.db.templates.push(tpl('pre', pre, 'install.pre.lead@1'), tpl('post', post, 'install.post.lead@1'));
	return { w, task, crew: w.as(['installer'], CREW) };
}
const dbTask = (w, id) => w.db.tasks.find((t) => String(t.ROWID) === String(id));
const shift = { work_date: '2026-11-02', start: '07:00', end: '15:30', break_minutes: 30 };

test('the sub-stage follows the team leader checklists: pre-job done is On Site, post-job done is Finished On Site', async () => {
	const { w, task, crew } = await setup();
	assert.equal(dbTask(w, task.ROWID).sub_stage, undefined);

	const a = (await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' })).checklist;
	await checklists.saveAnswers(crew, a.id, { answers: { site_safe: 'yes' } });
	await checklists.completeChecklist(crew, a.id, {});
	assert.equal(dbTask(w, task.ROWID).sub_stage, 'On Site');

	const b = (await checklists.startChecklist(crew, task.ROWID, { phase: 'post' })).checklist;
	await checklists.saveAnswers(crew, b.id, { answers: { tidy: 'yes' } });
	await checklists.completeChecklist(crew, b.id, shift);
	assert.equal(dbTask(w, task.ROWID).sub_stage, 'Finished On Site');
});

test('hired equipment linked to the install goes off hire when it finishes on site, and the managers hear once', async () => {
	const { w, task, crew } = await setup();
	const hired = (await registers.createEquipment(w.ctx, { name: 'Hired scissor lift', off_hire_required: true })).item.id;
	const owned = (await registers.createEquipment(w.ctx, { name: 'Our drill' })).item.id;
	await tasks.updateTask(w.ctx, task.ROWID, { hired_equipment: [hired, owned] });
	await rejects(tasks.updateTask(crew, task.ROWID, { hired_equipment: [hired] }), 403); // crew cannot link equipment

	const b = (await checklists.startChecklist(crew, task.ROWID, { phase: 'post' })).checklist;
	await checklists.saveAnswers(crew, b.id, { answers: { tidy: 'yes' } });
	await checklists.completeChecklist(crew, b.id, shift);

	const items = (await registers.listEquipment(w.ctx)).items;
	assert.equal(items.find((i) => i.id === hired).status, 'Off hire');
	assert.equal(items.find((i) => i.id === owned).status, 'In service', 'not flagged as hired, so it stays');
	const events = w.published.filter((p) => p.type === 'equipment.off_hire');
	assert.equal(events.length, 1);
	assert.deepEqual(events[0].payload.equipment.map((e) => e.name), ['Hired scissor lift']);

	// A second release finds nothing left to switch, so no second event.
	assert.equal(await registers.releaseHiredEquipment({ ...w.ctx }, dbTask(w, task.ROWID)), 0);
	assert.equal(w.published.filter((p) => p.type === 'equipment.off_hire').length, 1);
});

test('the off-hire email goes to project managers and install coordinators in one message', async () => {
	const w = makeWorld();
	w.db.people.push({ ROWID: 'pm1', email: 'pm@example.test', roles: ['project_manager'], is_active: 'true' });
	w.db.people.push({ ROWID: 'ic1', email: 'ic@example.test', roles: ['install_coordinator'], is_active: 'true' });
	w.db.tasks.push({ ROWID: 't1', name: 'Install pylon' });
	const sent = [];
	const ctx = { ...w.ctx, log: { info() {}, warn() {}, error() {} }, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	await handlers['equipment.off_hire']({ taskId: 't1', equipment: [{ code: 'VE - 101', name: 'Scissor lift' }] }, ctx);
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].to.sort(), ['ic@example.test', 'pm@example.test']);
	assert.match(sent[0].subject, /VE - 101/);
	assert.match(sent[0].html, /Install pylon/);
});
