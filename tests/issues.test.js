'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const issues = require('../lib/services/issues');
const checklists = require('../lib/services/checklists');
const d = require('../lib/domain/issues');

const CREW = '105747000000900001';

test('issue moves follow the list and routing follows the task type', () => {
	assert.equal(d.canMove('Open', 'In Progress'), true);
	assert.equal(d.canMove('Closed', 'Open'), false);
	assert.equal(d.canMove('Resolved', 'Open'), true);
	assert.deepEqual(d.nextStatuses('Closed'), []);
	assert.equal(d.departmentFor('fabrication'), 'Fabrication');
	assert.equal(d.departmentFor(undefined), 'Management');
});

async function withTask(adminCtx) {
	const { job } = await jobs.createJob(adminCtx, { name: 'Job' });
	const { task } = await tasks.createTask(adminCtx, job.ROWID, { task_type: 'install', name: 'Install' });
	return task;
}

test('an issue raised on a task is routed to its department and logged', async () => {
	const w = makeWorld({ roles: ['installer'] });
	const task = await withTask(w.as(['admin']));
	const { issue } = await issues.createIssue(w.ctx, { subject: 'Bracket missing', task_id: String(task.ROWID) });
	assert.equal(issue.department, 'Install');
	assert.equal(issue.issue_status, 'Open');
	assert.equal(issue.reported_by_id, CREW);
	assert.ok(w.published.some((p) => p.type === 'issue.changed'));
});

test('crew see only their own issues; managers see all and can move them', async () => {
	const w = makeWorld({ roles: ['installer'] });
	await issues.createIssue(w.ctx, { subject: 'Mine' });
	w.db.issues.push({ ROWID: '105747000001999999', subject: 'Not mine', reported_by_id: '105747000000900003', issue_status: 'Open' });

	assert.equal((await issues.listIssues(w.ctx)).items.length, 1);
	await rejects(issues.getIssue(w.ctx, '105747000001999999'), 404);
	await rejects(issues.updateIssue(w.ctx, w.db.issues[0].ROWID, { issue_status: 'Resolved' }), 403);

	const pm = w.as(['project_manager'], '105747000000900002');
	assert.equal((await issues.listIssues(pm)).items.length, 2);
	const r = await issues.updateIssue(pm, w.db.issues[0].ROWID, { issue_status: 'Resolved' });
	assert.equal(r.issue.issue_status, 'Resolved');
	assert.ok(r.issue.completed_at, 'resolved time stamped');
	await rejects(issues.updateIssue(pm, w.db.issues[0].ROWID, { issue_status: 'In Progress' }), 409, 'invalid_transition');
	const back = await issues.updateIssue(pm, w.db.issues[0].ROWID, { issue_status: 'Open' });
	assert.equal(back.issue.completed_at, null, 'reopening clears the finish time');
});

test('a checklist answer that flags a problem raises one issue, even if completed twice', async () => {
	const w = makeWorld();
	w.db.people[0].hourly_rate = 40;
	const { job } = await jobs.createJob(w.ctx, { name: 'Job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install', quoted_hours: 8 });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: CREW, role: 'lead' });
	w.db.templates.push({
		template_key: 'install.pre.lead@1', task_type: 'install', phase: 'pre', assignee_role: 'lead', version_no: 1,
		definition: JSON.stringify({ sections: [{ key: 's', questions: [{ key: 'site_safe', label: 'Is the site safe?', type: 'yesno', required: true, raiseIssueOn: 'no' }] }] }),
	});
	// A contractor cannot create issues by role, but finishing a checklist must still work.
	const crew = w.as(['contractor'], CREW);
	const { checklist } = await checklists.startChecklist(crew, task.ROWID, { phase: 'pre' });
	await checklists.saveAnswers(crew, checklist.id, { answers: { site_safe: 'no' } });
	const done = await checklists.completeChecklist(crew, checklist.id, {});

	assert.equal(done.raisedIssues.length, 1);
	assert.equal(w.db.issues[0].subject, 'Is the site safe?');
	assert.equal(w.db.issues[0].source_kind, 'checklist');
	assert.equal(w.db.issues[0].department, 'Install');

	w.db.checklists[0].checklist_status = 'In Progress'; // reopened, then finished again
	const again = await checklists.completeChecklist(crew, checklist.id, {});
	assert.equal(again.raisedIssues.length, 0);
	assert.equal(w.db.issues.length, 1, 'no duplicate');
});
