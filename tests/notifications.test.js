'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const issues = require('../lib/services/issues');
const handlers = require('../lib/events/handlers');
const { dispatch } = require('../lib/events/registry');
const { render, cleanRecipients, escapeHtml } = require('../lib/domain/notifications');
const { createMailer } = require('../lib/mail');

test('templates escape user text and unknown templates fail loudly', () => {
	const m = render('issueRaised', { issue: { subject: '<script>alert(1)</script>', description: 'a & b' }, link: 'https://x.test/a?b=1&c=2' });
	assert.ok(!m.html.includes('<script>'));
	assert.match(m.html, /&lt;script&gt;/);
	assert.match(m.html, /a &amp; b/);
	assert.match(m.text, /Open: https:\/\/x\.test/);
	assert.throws(() => render('nope', {}));
	assert.equal(escapeHtml(`"'`), '&quot;&#39;');
});

test('recipients are cleaned and de-duplicated', () => {
	assert.deepEqual(cleanRecipients(['A@x.com', 'a@x.com ', null, 'bad', '', 'b@y.org']), ['a@x.com', 'b@y.org']);
});

test('the mailer sends nothing, and says why, when no sender is configured', async () => {
	const prev = process.env.MAIL_FROM;
	delete process.env.MAIL_FROM;
	const calls = [];
	const mailer = createMailer({ email: () => ({ sendMail: async (m) => calls.push(m) }) });
	assert.deepEqual(await mailer.send({ to: ['a@x.com'], subject: 's', html: 'h' }), { sent: false, reason: 'no_sender' });
	process.env.MAIL_FROM = 'noreply@example.test';
	assert.deepEqual(await mailer.send({ to: [], subject: 's', html: 'h' }), { sent: false, reason: 'no_recipients' });
	assert.equal((await mailer.send({ to: ['a@x.com'], subject: 's', html: 'h' })).sent, true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].from_email, 'noreply@example.test');
	if (prev === undefined) delete process.env.MAIL_FROM; else process.env.MAIL_FROM = prev;
});

function setup() {
	const w = makeWorld();
	const sent = [];
	const ctx = { repos: w.ctx.repos, log: { info() {}, warn() {}, error() {} }, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	return { w, ctx, sent };
}

test('a new issue emails the project managers, once, with the issue in the message', async () => {
	const { w, ctx, sent } = setup();
	w.db.people.push({ ROWID: '105747000000900005', email: 'pm@x.com', roles: ['project_manager'] }, { ROWID: '105747000000900006', email: 'crew@x.com', roles: ['installer'] });
	const { issue } = await issues.createIssue(w.ctx, { subject: 'Loose bracket' });

	await dispatch('issue.changed', { issueId: String(issue.ROWID), created: true }, ctx);
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].to, ['pm@x.com']);
	assert.match(sent[0].subject, /Loose bracket/);

	await dispatch('issue.changed', { issueId: String(issue.ROWID), status: 'Completed' }, ctx); // a status change is not a new issue
	assert.equal(sent.length, 1);
});

test('a rejected task emails the people assigned to it, and other moves send nothing', async () => {
	const { w, ctx, sent } = setup();
	w.db.people[0].email = 'lead@x.com';
	const { job } = await jobs.createJob(w.ctx, { name: 'Harbour job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Cut letters' });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: '105747000000900001', role: 'lead' });

	await dispatch('task.stage_changed', { taskId: String(task.ROWID), to: 'Rejected' }, ctx);
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].to, ['lead@x.com']);
	assert.match(sent[0].html, /Harbour job/);

	await dispatch('task.stage_changed', { taskId: String(task.ROWID), to: 'In Progress' }, ctx);
	assert.equal(sent.length, 1);
});

test('missing email setup is skipped quietly, never thrown', async () => {
	const w = makeWorld();
	const logged = [];
	const ctx = { repos: w.ctx.repos, log: { info: (m, d) => logged.push([m, d]), warn() {}, error() {} }, mailer: { send: async () => ({ sent: false, reason: 'no_sender' }) } };
	const r = await handlers.send(ctx, ['a@x.com'], { subject: 's', html: 'h' }, 'test');
	assert.equal(r.sent, false);
	assert.equal(logged[0][0], 'email skipped');
});

test('a task submitted for approval emails the job PM (install, design) or fab manager (fab); with none set, everyone in that role', async () => {
	const { w, ctx, sent } = setup();
	w.db.people.push(
		{ ROWID: '105747000000900010', email: 'pm@x.com', roles: ['project_manager'] },
		{ ROWID: '105747000000900011', email: 'fabm@x.com', roles: ['fab_manager'] },
		{ ROWID: '105747000000900012', email: 'other-pm@x.com', roles: ['project_manager'] },
	);
	const { job } = await jobs.createJob(w.ctx, { name: 'Harbour job' });
	w.db.jobs[0].pm_id = '105747000000900010';
	w.db.jobs[0].fab_manager_id = '105747000000900011';
	const inst = (await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install pylon' })).task;
	const fab = (await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Cut letters' })).task;

	await dispatch('task.stage_changed', { taskId: String(inst.ROWID), to: 'Manager Review' }, ctx);
	assert.deepEqual(sent[0].to, ['pm@x.com']);
	assert.equal(sent[0].subject, 'Install Task Approval: Install pylon');
	assert.match(sent[0].html, /Harbour job/);

	await dispatch('task.stage_changed', { taskId: String(fab.ROWID), to: 'Manager Review' }, ctx);
	assert.deepEqual(sent[1].to, ['fabm@x.com']);
	assert.equal(sent[1].subject, 'Fabrication Task Approval: Cut letters');

	w.db.jobs[0].pm_id = null;
	await dispatch('task.stage_changed', { taskId: String(inst.ROWID), to: 'Manager Review' }, ctx);
	assert.deepEqual([...sent[2].to].sort(), ['other-pm@x.com', 'pm@x.com'], 'no PM on the job: every project manager');
});

test('an approval flagged for management review or OH&S emails the department manager and inform-also list; an unflagged one sends nothing', async () => {
	const appSettings = require('../lib/services/appSettings');
	const { w, ctx, sent } = setup();
	w.db.people.push(
		{ ROWID: '105747000000900020', email: 'install-mgr@x.com', roles: ['install_coordinator'] },
		{ ROWID: '105747000000900021', email: 'safety@x.com', roles: ['viewer'] },
	);
	await appSettings.updateSettings(w.ctx, { issue_routing: { Install: { manager_id: '105747000000900020', inform_also: ['105747000000900021'] } } });
	const { job } = await jobs.createJob(w.ctx, { name: 'Harbour job' });
	const task = (await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Install pylon' })).task;
	const id = String(task.ROWID);

	await dispatch('task.stage_changed', { taskId: id, to: 'Completed', ohs: 'No', managementReview: false }, ctx);
	assert.equal(sent.length, 0, 'a plain approval tells nobody');

	await dispatch('task.stage_changed', { taskId: id, to: 'Completed', ohs: 'Yes', managementReview: true, comment: 'Ladder footing was poor' }, ctx);
	assert.deepEqual([...sent[0].to].sort(), ['install-mgr@x.com', 'safety@x.com']);
	assert.match(sent[0].subject, /OH&S concern on an approved task: Install pylon/);
	assert.match(sent[0].html, /needs a management review/);
	assert.match(sent[0].html, /Ladder footing was poor/);

	// The approval itself publishes the flags with the stage change.
	w.db.tasks.find((t) => String(t.ROWID) === id).stage = 'Manager Review';
	await tasks.transitionTask(w.ctx, id, { to: 'Completed', ohs: 'Yes', management_review: false, comment: 'Near miss' });
	const ev = w.published.filter((e) => e.type === 'task.stage_changed').pop();
	assert.deepEqual([ev.payload.ohs, ev.payload.managementReview, ev.payload.comment], ['Yes', false, 'Near miss']);
});
