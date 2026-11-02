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

	await rejects(swms.signSwms(lead, id, { as: 'pm' }), 403);
	await rejects(swms.signSwms(lead, id, { as: 'tl' }), 409, 'invalid_state'); // PM must go first

	const a = await swms.signSwms(pm, id, { as: 'pm' });
	assert.equal(a.swms.status, 'PM Signed');
	assert.equal(a.swms.signoff.pm.personId, PM);

	await rejects(swms.signSwms(pm, id, { as: 'tl' }), 403); // a manager is not the task's leader
	const b = await swms.signSwms(lead, id, { as: 'tl' });
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
	await swms.signSwms(pm, id, { as: 'pm' });
	await swms.signSwms(lead, id, { as: 'tl' });
	const done = await checklists.completeChecklist(lead, checklist.id, {});
	assert.equal(done.checklist.status, 'Completed');
});
