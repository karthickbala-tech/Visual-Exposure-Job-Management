'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const swms = require('../lib/services/swms');
const reports = require('../lib/services/reports');
const D = require('../lib/domain/swms');

async function setup() {
	const w = makeWorld();
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon Refresh' })).job;
	const task = (await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'install', name: 'Fit', kind: 'VE Install' })).task;
	return { w, task, id: String(w.db.swms[0].ROWID), me: String(w.ctx.actor.person.ROWID) };
}

test('hazard and PPE lists are consistent: every auto-PPE item is a known PPE item and the rules only add', () => {
	assert.equal(D.HAZARDS.length, 23); // 21 original plus hazardous substances and flammable atmosphere (DS_COMPARISON 4.3)
	assert.equal(D.PPE_ITEMS.length, 13); // 11 original plus breathing apparatus and full face shield (DS_COMPARISON 4.4)
	for (const items of Object.values(D.PPE_FOR)) for (const p of items) assert.ok(D.PPE_ITEMS.includes(p), p);
	for (const key of Object.keys(D.PPE_FOR)) assert.ok(D.HAZARD_KEYS.includes(key), key);
	assert.deepEqual(D.autoPpe(['falls', 'hot_works']).sort(), ['Gloves', 'Hard hat', 'Harness and fall arrest', 'Long sleeves and pants', 'Safety boots', 'Safety glasses', 'Welding mask or face shield']);
	assert.deepEqual(D.autoPpe([]), []);
});

test('ticking hazards saves them and adds the PPE they need; unticking never removes PPE; unknown hazards are refused', async () => {
	const { w, id } = await setup();
	const a = await swms.updateSwms(w.ctx, id, { hazards: ['falls', 'dust'], ppe: ['Sun protection'] });
	assert.deepEqual(a.swms.hazards, ['falls', 'dust']);
	for (const p of ['Sun protection', 'Harness and fall arrest', 'Dust mask or respirator', 'Hard hat']) assert.ok(a.swms.ppe.includes(p), p);
	const b = await swms.updateSwms(w.ctx, id, { hazards: [] });
	assert.deepEqual(b.swms.hazards, []);
	assert.ok(b.swms.ppe.includes('Harness and fall arrest'), 'PPE stays');
	await rejects(swms.updateSwms(w.ctx, id, { hazards: ['moon_walking'] }), 400);
	const opt = await swms.options(w.ctx);
	assert.equal(opt.hazards.length, 23);
	assert.ok(opt.ppeFor.falls.includes('Hard hat'));
});

test('signing needs the declaration and a typed name; the typed name is what is recorded', async () => {
	const { w, id } = await setup();
	const pm = w.as(['project_manager'], '105747000000900002');
	await rejects(swms.signSwms(pm, id, { as: 'pm' }), 400);
	await rejects(swms.signSwms(pm, id, { as: 'pm', typed_name: 'Pat', declaration: false }), 400);
	await rejects(swms.signSwms(pm, id, { as: 'pm', typed_name: 'P', declaration: true }), 400);
	const out = await swms.signSwms(pm, id, { as: 'pm', typed_name: '  Rachel Barnes ', declaration: true });
	assert.equal(out.swms.signoff.pm.name, 'Rachel Barnes');
	assert.equal(out.swms.status, 'PM Signed');
});

test('the SWMS list shows the progress of the three signing steps, the job and the date', async () => {
	const { w, task, me } = await setup();
	const id = String(w.db.swms[0].ROWID);
	await tasks.addAssignee(w.ctx, String(task.ROWID), { person_id: me, role: 'lead' });
	await swms.declare(w.ctx, id, { typed_name: 'Test Crew' });
	const out = await reports.listSwms(w.ctx, {});
	const row = out.items[0];
	assert.equal(row.jobName, 'Pylon Refresh');
	assert.deepEqual(row.progress, { pm: false, tl: false, crewSigned: 1, crewTotal: 1 });
	assert.equal(w.db.swms[0].declarations.includes('Test Crew'), true);
});
