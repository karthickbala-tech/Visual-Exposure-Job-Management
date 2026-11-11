'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const swms = require('../lib/services/swms');
const checklists = require('../lib/services/checklists');
const d = require('../lib/domain/swms');

const LEAD = '105747000000900001';
const PM = '105747000000900002';

test('rules: who signs, in what order, and what is locked', () => {
	assert.deepEqual(d.checkSign('Created', 'pm', { roles: ['project_manager'] }), { ok: true, to: 'PM Signed' });
	assert.equal(d.checkSign('Created', 'pm', { roles: ['installer'] }).code, 'not_allowed');
	assert.equal(d.checkSign('Created', 'tl', { isLead: true }).code, 'invalid_state', 'PM first');
	assert.deepEqual(d.checkSign('PM Signed', 'tl', { isLead: true }), { ok: true, to: 'TL Signed' });
	assert.equal(d.checkSign('PM Signed', 'tl', { isLead: false }).code, 'not_allowed');
	assert.equal(d.checkSign('TL Signed', 'pm', { roles: ['admin'] }).ok, false);
	assert.deepEqual(d.mergePpe(['hardhat'], ['boots', 'hardhat']), ['hardhat', 'boots'], 'add only, no duplicates');
	assert.equal(d.allowsPreJobChecklist('PM Signed'), false);
	assert.equal(d.allowsPreJobChecklist('Not Required'), true);
	assert.equal(d.needsSwms('install', undefined), true);
	assert.equal(d.needsSwms('install', 'Minor Task'), false);
	assert.equal(d.needsSwms('design', undefined), false);
});

async function setup(kind) {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', kind, name: 'Install' });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: LEAD, role: 'lead' });
	const pm = w.as(['project_manager'], PM);
	return { w, task, pm, lead: w.as(['installer'], LEAD) };
}

test('an install task gets one SWMS with it; minor tasks and design tasks do not', async () => {
	const { w, task } = await setup();
	assert.equal(w.db.swms.length, 1);
	assert.equal(w.db.swms[0].swms_status, 'Created');
	assert.equal(String(w.db.tasks.find((t) => t.ROWID === task.ROWID).swms_id), String(w.db.swms[0].ROWID));
	await tasks.createTask(w.ctx, w.db.jobs[0].ROWID, { task_type: 'install', kind: 'Minor Task', name: 'Minor' });
	await tasks.createTask(w.ctx, w.db.jobs[0].ROWID, { task_type: 'design', name: 'Design' });
	assert.equal(w.db.swms.length, 1);
});

test('PM signs, then the team leader; each is recorded; then it is locked', async () => {
	const { w, pm, lead } = await setup();
	const id = String(w.db.swms[0].ROWID);

	await rejects(swms.signSwms(lead, id, { as: 'pm', typed_name: 'Pat Manager', declaration: true }), 403);
	await rejects(swms.signSwms(lead, id, { as: 'tl', typed_name: 'Lee Leader', declaration: true }), 409, 'invalid_state'); // PM must go first

	const a = await swms.signSwms(pm, id, { as: 'pm', typed_name: 'Pat Manager', declaration: true });
	assert.equal(a.swms.status, 'PM Signed');
	assert.equal(a.swms.signoff.pm.personId, PM);

	await rejects(swms.signSwms(pm, id, { as: 'tl', typed_name: 'Lee Leader', declaration: true }), 403); // a manager is not the task's leader
	const b = await swms.signSwms(lead, id, { as: 'tl', typed_name: 'Lee Leader', declaration: true });
	assert.equal(b.swms.status, 'TL Signed');
	assert.ok(b.swms.signoff.tl.at);
	assert.ok(w.published.some((p) => p.type === 'swms.signed'));

	await rejects(swms.updateSwms(pm, id, { site_address: 'x' }), 409, 'swms_locked');
	await rejects(swms.declare(lead, id), 409, 'swms_locked');
});

test('managers edit the statement; PPE only grows; crew cannot edit', async () => {
	const { w, pm, lead } = await setup();
	const id = String(w.db.swms[0].ROWID);
	await swms.updateSwms(pm, id, { ppe: ['hardhat', 'boots'], site_address: '1 Test St', swms_tasks: [{ task: 'Erect scaffold', responsible: 'Team leader' }] });
	const r = await swms.updateSwms(pm, id, { ppe: ['gloves'] });
	assert.deepEqual(r.swms.ppe, ['hardhat', 'boots', 'gloves']);
	assert.equal(r.swms.tasks.length, 1);
	await rejects(swms.updateSwms(lead, id, { site_address: 'nope' }), 403);
	await rejects(swms.updateSwms(pm, id, { ppe: 'x' }), 400);
});

test('crew declarations are recorded once each; outsiders get 404', async () => {
	const { w, lead } = await setup();
	const id = String(w.db.swms[0].ROWID);
	await swms.declare(lead, id);
	const again = await swms.declare(lead, id);
	assert.equal(again.swms.declarations.length, 1);
	await rejects(swms.getSwms(w.as(['installer'], '105747000000900003'), id), 404);
});

test('a task that is not used no longer needs its SWMS', async () => {
	const { w, task } = await setup();
	await tasks.transitionTask(w.ctx, task.ROWID, { to: 'Complete - Not Used' });
	assert.equal(w.db.swms[0].swms_status, 'Not Required');
});

test('the team leader cannot finish the pre-job checklist until the SWMS is signed', async () => {
	const { w, task, pm, lead } = await setup();
	w.db.templates.push({
		template_key: 'install.pre.lead@1', task_type: 'install', phase: 'pre', assignee_role: 'lead', version_no: 1,
		definition: JSON.stringify({ sections: [{ key: 's', questions: [{ key: 'ok', type: 'yesno', required: true }] }] }),
	});
	const { checklist } = await checklists.startChecklist(lead, task.ROWID, { phase: 'pre' });
	await checklists.saveAnswers(lead, checklist.id, { answers: { ok: 'yes' } });

	const e = await rejects(checklists.completeChecklist(lead, checklist.id, {}), 409, 'swms_required');
	assert.equal(e.details.status, 'Created');

	const id = String(w.db.swms[0].ROWID);
	await swms.signSwms(pm, id, { as: 'pm', typed_name: 'Pat Manager', declaration: true });
	await swms.signSwms(lead, id, { as: 'tl', typed_name: 'Lee Leader', declaration: true });
	const done = await checklists.completeChecklist(lead, checklist.id, {});
	assert.equal(done.checklist.status, 'Completed');
});

test('rules: SWMS numbers run from SWMS-0001; a project manager completes then closes a signed statement', () => {
	assert.equal(d.nextSwmsNumber(null), 'SWMS-0001');
	assert.equal(d.nextSwmsNumber('SWMS-0009'), 'SWMS-0010');
	assert.equal(d.nextSwmsNumber('SWMS-0099'), 'SWMS-0100');
	assert.deepEqual(d.checkAdvance('TL Signed', { roles: ['project_manager'] }), { ok: true, to: 'Completed' });
	assert.deepEqual(d.checkAdvance('Completed', { roles: ['admin'] }), { ok: true, to: 'Closed' });
	assert.equal(d.checkAdvance('Closed', { roles: ['admin'] }).code, 'invalid_state');
	assert.equal(d.checkAdvance('PM Signed', { roles: ['project_manager'] }).code, 'invalid_state', 'the team leader signs first');
	assert.equal(d.checkAdvance('TL Signed', { roles: ['installer'] }).code, 'not_allowed');
	for (const s of ['TL Signed', 'Completed', 'Closed', 'Not Required']) assert.equal(d.allowsPreJobChecklist(s), true, s);
});

test('each new install SWMS gets the next number; completing and closing works through the service', async () => {
	const { w, task, pm, lead } = await setup();
	await tasks.createTask(w.ctx, w.db.jobs[0].ROWID, { task_type: 'install', kind: 'VE Install', name: 'Second install' });
	assert.deepEqual(w.db.swms.map((s) => s.swms_number), ['SWMS-0001', 'SWMS-0002']);
	const id = String(w.db.swms[0].ROWID);
	await rejects(swms.advanceSwms(pm, id), 409); // not signed by the team leader yet
	await swms.signSwms(pm, id, { as: 'pm', typed_name: 'Pat PM', declaration: true });
	await swms.signSwms(lead, id, { as: 'tl', typed_name: 'Lee Lead', declaration: true });
	await rejects(swms.advanceSwms(lead, id), 403); // an installer cannot
	assert.equal((await swms.advanceSwms(pm, id)).swms.status, 'Completed');
	assert.equal((await swms.advanceSwms(pm, id)).swms.status, 'Closed');
	await rejects(swms.advanceSwms(pm, id), 409);
	assert.equal((await swms.getSwms(pm, id)).swms.number, 'SWMS-0001');
	await rejects(swms.updateSwms(pm, id, { site_address: 'x' }), 409); // a closed statement is locked
	void task;
});
