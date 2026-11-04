'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const files = require('../lib/services/files');
const checklists = require('../lib/services/checklists');

const CREW = '105747000000900003';

test('JOB-7/8: edits keep name and expected finish; deal link and created date are admin only', async () => {
	const w = makeWorld();
	const id = String((await jobs.createJob(w.ctx, { name: 'Pylon', expected_finish: '2026-12-01', server_path: 'S:\Jobs\Pylon' })).job.ROWID);
	const pm = w.as(['project_manager'], null);
	assert.equal((await jobs.updateJob(pm, id, { description: 'x' })).job.description, 'x');
	await rejects(jobs.updateJob(pm, id, { crm_deal_id: '123' }), 403);
	await rejects(jobs.updateJob(pm, id, { created_date: '2026-01-01' }), 403);
	const out = await jobs.updateJob(w.ctx, id, { crm_deal_id: '123', created_date: '2026-01-01' });
	assert.equal(out.job.crm_deal_id, '123');
	const ignored = await jobs.updateJob(w.ctx, id, { stage: 'Completed', percent_job: 100 });
	assert.equal(ignored.job.stage, 'Preparation', 'rollup fields and stage are read-only here');
	assert.equal(w.db.jobs.find((j) => String(j.ROWID) === id).percent_job, 0);

	const bare = String((await jobs.createJob(w.ctx, { name: 'No finish' })).job.ROWID);
	await rejects(jobs.updateJob(w.ctx, bare, { description: 'y' }), 400);
	assert.ok((await jobs.updateJob(w.ctx, bare, { description: 'y', expected_finish: '2026-12-02', server_path: 'S:\Jobs\Bare' })).job);
});

test('TSK-5: an attachment can be deleted by who added it or a manager, and is gone from the list', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	const task = String((await tasks.createTask(w.ctx, job, { task_type: 'design', name: 'Art' })).task.ROWID);
	w.ctx.storage = { signedPut: async () => 'u', signedGet: async () => 'g' };
	const up = await files.requestUpload(w.ctx, { entity_type: 'task', entity_id: task, file_name: 'a.pdf', mime_type: 'application/pdf', size_bytes: 100 });
	await files.confirmUpload(w.ctx, up.file.id);
	assert.equal((await files.listFiles(w.ctx, { entity_type: 'task', entity_id: task })).items.length, 1);
	await rejects(files.deleteFile(w.as(['installer'], CREW), up.file.id), 404);
	assert.deepEqual(await files.deleteFile(w.ctx, up.file.id), { deleted: true });
	assert.equal((await files.listFiles(w.ctx, { entity_type: 'task', entity_id: task })).items.length, 0);
	await rejects(files.deleteFile(w.ctx, up.file.id), 404);
});

test('CHK-3: the next checklist step is pre, then post, then done; workshop skips pre', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	const task = String((await tasks.createTask(w.ctx, job, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' })).task.ROWID);
	await rejects(checklists.nextStep(w.ctx, task), 403);
	await tasks.addAssignee(w.ctx, task, { person_id: String(w.ctx.actor.person.ROWID), role: 'lead' });
	assert.deepEqual(await checklists.nextStep(w.ctx, task), { phase: 'pre', action: 'start', checklistId: null, next: null });
	const me = String(w.ctx.actor.person.ROWID);
	w.db.checklists.push({ ROWID: 'c1', task_id: task, assignee_id: me, phase: 'pre', checklist_status: 'Completed' });
	assert.equal((await checklists.nextStep(w.ctx, task)).phase, 'post');
	w.db.checklists.push({ ROWID: 'c2', task_id: task, assignee_id: me, phase: 'post', checklist_status: 'Completed' });
	assert.equal((await checklists.nextStep(w.ctx, task)).action, 'done');

	const shop = String((await tasks.createTask(w.ctx, job, { task_type: 'fabrication', name: 'Tidy', kind: 'Workshop' })).task.ROWID);
	await tasks.addAssignee(w.ctx, shop, { person_id: me, role: 'lead' });
	assert.equal((await checklists.nextStep(w.ctx, shop)).phase, 'post');
});

test('TSK-3: removing someone from the crew clears their unfinished checklists only', async () => {
	const w = makeWorld();
	const job = String((await jobs.createJob(w.ctx, { name: 'J' })).job.ROWID);
	const task = String((await tasks.createTask(w.ctx, job, { task_type: 'fabrication', name: 'Cut', kind: 'CNC' })).task.ROWID);
	w.db.people.push({ ROWID: CREW, first_name: 'Sam', last_name: 'Crew', email: 's@example.test', roles: ['installer'], is_active: 'true' });
	await tasks.addAssignee(w.ctx, task, { person_id: CREW, role: 'member' });
	w.db.checklists.push({ ROWID: 'a', task_id: task, assignee_id: CREW, phase: 'pre', checklist_status: 'Completed' }, { ROWID: 'b', task_id: task, assignee_id: CREW, phase: 'post', checklist_status: 'In Progress' }, { ROWID: 'c', task_id: task, assignee_id: 'other', phase: 'pre', checklist_status: 'In Progress' });
	await tasks.removeAssignee(w.ctx, task, CREW);
	assert.deepEqual(w.db.checklists.map((c) => c.ROWID).sort(), ['a', 'c']);
});
