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
