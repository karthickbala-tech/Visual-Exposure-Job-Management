'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const people = require('../lib/services/people');
const compliance = require('../lib/services/compliance');
const checklists = require('../lib/services/checklists');

const mkTask = async (w, input) => {
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	return String((await tasks.createTask(w.ctx, job, input)).task.ROWID);
};

test('TSK-6: finished tasks lock, dates stay in order, only fabrication has a spec', async () => {
	const w = makeWorld();
	const id = await mkTask(w, { task_type: 'install', name: 'Fit', kind: 'VE Install' });
	await rejects(tasks.updateTask(w.ctx, id, { scheduled_date: '2026-12-10', required_finish: '2026-12-01' }), 400);
	await rejects(tasks.updateTask(w.ctx, id, { spec: { material: 'ACM' } }), 400);
	assert.ok((await tasks.updateTask(w.ctx, id, { scheduled_date: '2026-12-01', required_finish: '2026-12-10' })).task);
	w.db.tasks.find((t) => String(t.ROWID) === id).stage = 'Completed';
	await rejects(tasks.updateTask(w.ctx, id, { description: 'late edit' }), 409);
	assert.ok((await tasks.updateTask(w.ctx, id, { notes: 'a note' })).task, 'notes can still be added');
});

test('roles: only an administrator changes roles or the active flag, nobody locks themselves out, the role list exists', async () => {
	const w = makeWorld();
	const other = String((await people.createPerson(w.ctx, { first_name: 'Sam', email: 'sam@example.test', roles: ['installer'] })).person.ROWID);
	const pm = w.as(['project_manager'], null);
	await rejects(people.updatePerson(pm, other, { roles: ['admin'] }), 403);
	await rejects(people.updatePerson(pm, other, { is_active: false }), 403);
	await rejects(people.createPerson(pm, { first_name: 'X', roles: ['admin'] }), 403);
	assert.ok((await people.updatePerson(w.ctx, other, { roles: ['installer', 'fab_worker'] })).person);

	const me = String(w.ctx.actor.person.ROWID);
	await rejects(people.updatePerson(w.ctx, me, { roles: ['project_manager'] }), 409);
	await rejects(people.updatePerson(w.ctx, me, { is_active: false }), 409);
	const roles = await people.listRoles(w.ctx);
	assert.ok(roles.items.some((r) => r.key === 'admin'));
});

test('CMP-1: a company document belongs to a company and shows in its own list', async () => {
	const w = makeWorld();
	const company = (await w.ctx.repos.companies.insert({ name: 'Crane Co', kind: 'subcontractor', contact: '{"email":"c@example.test"}', do_not_contact: '{}' }));
	w.db.ctypes.push({ ROWID: '105747000000800001', compliance_kind: 'company_document', name: 'Public liability', requires_expiry: 'true' }, { ROWID: '105747000000800002', compliance_kind: 'ticket', name: 'White card', requires_expiry: 'true' });
	const out = await compliance.createItem(w.ctx, { type_id: '105747000000800001', company_id: String(company.ROWID), expiry_date: '2027-01-01' });
	assert.equal(out.item.companyName, 'Crane Co');
	assert.equal(out.item.personId, null);
	await rejects(compliance.createItem(w.ctx, { type_id: '105747000000800001', expiry_date: '2027-01-01' }), 400);
	await rejects(compliance.createItem(w.ctx, { type_id: '105747000000800001', person_id: String(w.ctx.actor.person.ROWID), company_id: String(company.ROWID), expiry_date: '2027-01-01' }), 400);
	await rejects(compliance.createItem(w.ctx, { type_id: '105747000000800001', person_id: String(w.ctx.actor.person.ROWID), expiry_date: '2027-01-01' }), 400);
	await rejects(compliance.createItem(w.ctx, { type_id: '105747000000800002', company_id: String(company.ROWID), expiry_date: '2027-01-01' }), 400);
	const list = await compliance.listItems(w.ctx, { company_id: String(company.ROWID) });
	assert.equal(list.count, 1);
	assert.equal(list.items[0].typeName, 'Public liability');
});

test('CHK-8: a photo answer must be a finished photo uploaded for this checklist', async () => {
	const w = makeWorld();
	const taskId = await mkTask(w, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' });
	const me = String(w.ctx.actor.person.ROWID);
	await tasks.addAssignee(w.ctx, taskId, { person_id: me, role: 'lead' });
	const definition = JSON.stringify({ sections: [{ key: 's', title: 'S', questions: [{ key: 'pic', label: 'Photo', type: 'photo' }] }] });
	w.db.templates.push({ ROWID: 'tpl', template_key: 'k', version_no: 1, task_type: 'fabrication', phase: 'post', role: 'lead', definition });
	w.db.checklists.push({ ROWID: '105747000000900001', task_id: taskId, assignee_id: me, phase: 'post', assignee_role: 'lead', template_key: 'k', template_version: 1, checklist_status: 'In Progress', answers: '{}' });
	w.db.files.push(
		{ ROWID: '105747000000700001', entity_type: 'checklist', entity_id: '105747000000900001', file_kind: 'photo', is_uploaded: 'true' },
		{ ROWID: '105747000000700002', entity_type: 'checklist', entity_id: '105747000000900009', file_kind: 'photo', is_uploaded: 'true' },
		{ ROWID: '105747000000700003', entity_type: 'checklist', entity_id: '105747000000900001', file_kind: 'photo', is_uploaded: 'false' },
	);
	await rejects(checklists.saveAnswers(w.ctx, '105747000000900001', { answers: { pic: '105747000000700002' } }), 400);
	await rejects(checklists.saveAnswers(w.ctx, '105747000000900001', { answers: { pic: '105747000000700003' } }), 400);
	await rejects(checklists.saveAnswers(w.ctx, '105747000000900001', { answers: { pic: '105747000000700099' } }), 400);
	const ok = await checklists.saveAnswers(w.ctx, '105747000000900001', { answers: { pic: '105747000000700001' } });
	assert.ok(ok);
});
