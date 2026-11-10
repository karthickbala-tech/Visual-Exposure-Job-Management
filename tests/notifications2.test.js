'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const N = require('../lib/domain/notifications');
const notifications = require('../lib/services/notifications');
const appSettings = require('../lib/services/appSettings');
const handlers = require('../lib/events/handlers');
const compliance = require('../lib/services/compliance');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');

const ME = '105747000000900001';
const BOSS = '105747000000900002';
const quiet = { info() {}, warn() {}, error() {} };

function setup(sendImpl) {
	const w = makeWorld();
	w.db.people.push({ ROWID: BOSS, first_name: 'Rachel', last_name: 'PM', email: 'rachel@example.test', roles: ['project_manager'], is_active: 'true' });
	const sent = [];
	const mailer = { send: sendImpl || (async (m) => (sent.push(m), { sent: true, count: m.to.length })) };
	return { w, sent, mailer, ctx: { ...w.ctx, log: quiet, mailer } };
}
const msg = { subject: 'Hello', html: '<p>Hi</p>' };

test('rules: placeholders are checked and edits are applied safely', () => {
	assert.deepEqual(N.placeholdersOf('jobClosed'), ['job', 'completed']);
	assert.deepEqual(N.unknownPlaceholders('Closed {job} on {when} {job}', 'jobClosed'), ['when']);
	assert.deepEqual(N.unknownPlaceholders('', 'jobClosed'), []);

	const data = { job: { name: 'Pylon <b>refresh</b>', completed_date: '2026-11-04' }, link: 'https://x.test/app' };
	const base = N.render('jobClosed', data);
	assert.equal(N.applyOverrides(base, null, 'jobClosed', data), base, 'no edit, no change');

	const out = N.applyOverrides(base, { subject: 'Done: {job}', intro: 'Hello team, {job} finished {completed}.', footer: 'Thanks from Visual Exposure' }, 'jobClosed', data);
	assert.equal(out.subject, 'Done: Pylon <b>refresh</b>', 'the subject is plain text');
	assert.ok(out.html.includes('<h2 style="margin:0 0 12px">Done: Pylon &lt;b&gt;refresh&lt;/b&gt;</h2>'), 'the heading follows the subject and is escaped');
	assert.ok(out.html.includes('Hello team, Pylon &lt;b&gt;refresh&lt;/b&gt; finished 2026-11-04.'), 'values are escaped in the HTML');
	assert.ok(!out.html.includes('<b>refresh'), 'no markup gets in');
	assert.ok(out.html.indexOf('Hello team') < out.html.indexOf('Every task on'), 'the intro comes before the details');
	assert.ok(out.html.indexOf('Thanks from') > out.html.indexOf('Open in Visual Exposure'), 'the footer comes last');
	assert.ok(out.html.endsWith('</div>'));
	assert.match(out.text, /^Hello team, Pylon <b>refresh<\/b> finished 2026-11-04\./);
	assert.match(out.text, /Thanks from Visual Exposure$/);
	assert.equal(N.applyOverrides(base, { subject: 'x' }, 'nope', data), base, 'an unknown template is left alone');
});

test('admin can list, edit, preview and reset email templates; placeholders and roles are checked', async () => {
	const { w } = setup();
	const list = await notifications.listTemplates(w.ctx);
	assert.equal(list.items.length, 10); // 8 original plus install finished and fab checklist submitted (DS_COMPARISON 14.1)
	assert.deepEqual(list.items.find((i) => i.name === 'issueRaised').placeholders, ['subject', 'department', 'priority']);
	assert.equal(list.items.find((i) => i.name === 'jobClosed').override, null);

	await rejects(notifications.listTemplates(w.as(['project_manager'], BOSS)), 403);
	await rejects(notifications.updateTemplate(w.ctx, 'nope', { subject: 'x' }), 404);
	const bad = await rejects(notifications.updateTemplate(w.ctx, 'jobClosed', { subject: 'Closed {nonsense}' }), 400);
	assert.match(bad.message, /unknown placeholders: \{nonsense\}/);
	await rejects(notifications.updateTemplate(w.ctx, 'jobClosed', { subject: 'x'.repeat(151) }), 400);
	await rejects(notifications.updateTemplate(w.ctx, 'jobClosed', { colour: 'red' }), 400);

	await notifications.updateTemplate(w.ctx, 'jobClosed', { subject: 'Finished: {job}', intro: 'Good news.' });
	await notifications.updateTemplate(w.ctx, 'issueRaised', { footer: 'Please act today.' });
	assert.equal(w.db.settings.filter((s) => s.setting_key === 'mail.templates').length, 1, 'one row');
	const preview = await notifications.previewTemplate(w.ctx, 'jobClosed');
	assert.equal(preview.subject, 'Finished: Pylon refresh');
	assert.ok(preview.html.includes('Good news.'));
	await rejects(notifications.previewTemplate(w.as(['installer']), 'jobClosed'), 403);

	const again = await notifications.updateTemplate(w.ctx, 'jobClosed', { intro: null });
	assert.deepEqual(again.template.override, { subject: 'Finished: {job}' }, 'clearing one part keeps the rest');
	await notifications.updateTemplate(w.ctx, 'jobClosed', { subject: '' });
	assert.equal((await notifications.listTemplates(w.ctx)).items.find((i) => i.name === 'jobClosed').override, null, 'clearing everything resets it');
	assert.deepEqual(JSON.parse(w.db.settings[0].setting_value), { issueRaised: { footer: 'Please act today.' } });
});

test('the real email uses the edit, and every send is logged', async () => {
	const { w, ctx, sent } = setup();
	w.db.people.push({ ROWID: 'pm1', first_name: 'Tom', email: 'tom@example.test', roles: ['project_manager'], is_active: 'true' });
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh' });
	await notifications.updateTemplate(w.ctx, 'jobClosed', { subject: 'Finished: {job}' });

	await handlers['job.closed']({ jobId: String(job.ROWID) }, ctx);
	assert.equal(sent.length, 1);
	assert.equal(sent[0].subject, 'Finished: Pylon refresh');

	const log = await notifications.listNotifications(w.ctx);
	assert.equal(log.items.length, 1);
	assert.deepEqual([log.items[0].event, log.items[0].status, log.items[0].subject], ['job.closed', 'sent', 'Finished: Pylon refresh']);
	assert.deepEqual(log.items[0].recipients.sort(), ['rachel@example.test', 'tom@example.test']);
});

test('the notification log: sent, skipped (no sender) and failed (with the body kept); filters; admin only', async () => {
	const { w } = setup();
	const base = { ...w.ctx, log: quiet };
	await notifications.sendAndLog({ ...base, mailer: { send: async () => ({ sent: true, count: 1 }) } }, { event: 'a', to: ['a@x.test', 'A@x.test', 'junk'], message: msg });
	await notifications.sendAndLog({ ...base, mailer: { send: async () => ({ sent: false, reason: 'no_sender' }) } }, { event: 'b', to: ['b@x.test'], message: msg });
	const failed = await notifications.sendAndLog({ ...base, mailer: { send: async () => { throw new Error('boom token=SECRET123'); } } }, { event: 'c', to: ['c@x.test'], message: msg });
	assert.equal(failed.sent, false);
	assert.equal(failed.reason, 'failed', 'a mail problem never throws');

	const all = await notifications.listNotifications(w.ctx);
	assert.deepEqual(all.items.map((i) => [i.event, i.status]).sort(), [['a', 'sent'], ['b', 'skipped'], ['c', 'failed']]);
	assert.deepEqual(all.items.find((i) => i.event === 'a').recipients, ['a@x.test'], 'addresses are cleaned and de-duplicated');
	const f = all.items.find((i) => i.event === 'c');
	assert.ok(!JSON.stringify(f).includes('SECRET123'), 'secrets are hidden in the log');
	assert.ok(w.db.activity.find((a) => a.from_value === 'c').payload.includes('<p>Hi</p>'), 'the body is kept for a failed email');
	assert.ok(!w.db.activity.find((a) => a.from_value === 'a').payload.includes('<p>'), 'but not for a sent one');
	assert.deepEqual((await notifications.listNotifications(w.ctx, { status: 'failed' })).items.map((i) => i.event), ['c']);
	assert.deepEqual((await notifications.listNotifications(w.ctx, { event: 'b' })).items.map((i) => i.status), ['skipped']);
	await rejects(notifications.listNotifications(w.ctx, { status: 'weird' }), 400);
	await rejects(notifications.listNotifications(w.as(['project_manager'], BOSS)), 403);
});

test('retrying a failed notification: it is sent again, the original becomes retried, and only failed ones can be retried', async () => {
	let working = false;
	const { w } = setup();
	const mailer = { send: async (m) => { if (!working) throw new Error('down'); return { sent: true, count: m.to.length }; } };
	const ctx = { ...w.ctx, log: quiet, mailer };
	await notifications.sendAndLog(ctx, { event: 'issue.raised', to: ['a@x.test'], message: msg });
	const failedId = (await notifications.listNotifications(ctx, { status: 'failed' })).items[0].id;

	const still = await notifications.retryNotification(ctx, failedId);
	assert.equal(still.sent, false, 'still down: it fails again and stays failed');
	assert.ok(w.db.activity.find((a) => String(a.ROWID) === failedId).to_value === 'failed');

	working = true;
	const done = await notifications.retryNotification(ctx, failedId);
	assert.equal(done.sent, true);
	assert.equal(w.db.activity.find((a) => String(a.ROWID) === failedId).to_value, 'retried');
	assert.equal((await notifications.listNotifications(ctx, { status: 'sent' })).items.length, 1);
	await rejects(notifications.retryNotification(ctx, failedId), 409, 'not_failed');
	await rejects(notifications.retryNotification(ctx, '105747000009999999'), 404);
	await rejects(notifications.retryNotification({ ...w.as(['project_manager'], BOSS), mailer }, failedId), 403);
});

test('settings: reminder days, company defaults for new SWMS, and report recipients are validated and used', async () => {
	const { w } = setup();
	await rejects(appSettings.updateSettings(w.ctx, { expiry_reminder_days: [] }), 400);
	await rejects(appSettings.updateSettings(w.ctx, { expiry_reminder_days: [366] }), 400);
	await rejects(appSettings.updateSettings(w.ctx, { pcbu_defaults: Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 'v'])) }), 400);
	await rejects(appSettings.updateSettings(w.ctx, { hours_report_recipients: ['nope'] }), 400);
	const saved = await appSettings.updateSettings(w.ctx, { expiry_reminder_days: [10, 3], pcbu_defaults: { name: 'Visual Exposure Pty Ltd', phone: '03 9000 0000' }, hours_report_recipients: [BOSS] });
	assert.deepEqual(saved.settings.expiry_reminder_days, [10, 3]);
	assert.deepEqual(saved.settings.hours_report_recipients, [BOSS]);

	// A new install task starts its SWMS from the company defaults.
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon' });
	await tasks.createTask(w.ctx, job.ROWID, { task_type: 'install', name: 'Fit', kind: 'VE Install' });
	assert.deepEqual(JSON.parse(w.db.swms[0].pcbu), { name: 'Visual Exposure Pty Ltd', phone: '03 9000 0000' });

	// A ticket type with no reminder days of its own uses the global days.
	w.db.ctypes.push({ ROWID: '105747000001500001', name: 'Forklift', compliance_kind: 'ticket', requires_expiry: 'true', reminder_offsets: null });
	const made = await compliance.createItem(w.ctx, { type_id: '105747000001500001', person_id: ME, expiry_date: '2026-11-20' });
	assert.equal(w.db.citems[0].next_reminder_at, '2026-11-10 00:00:00', 'ten days before, from the global setting');
	assert.ok(made.item);
});

test('the compliance reminder job logs each send and counts a real mail failure as failed (left due for later)', async () => {
	const { w } = setup();
	const { runComplianceDue } = require('../lib/services/complianceJob');
	w.db.ctypes.push({ ROWID: 'ct1', name: 'Forklift', compliance_kind: 'ticket', requires_expiry: 'true', reminder_offsets: '[30,14,7,0]' });
	w.db.people[0].email = 'me@example.test';
	w.db.citems.push({ ROWID: 'ci1', type_id: 'ct1', person_id: ME, compliance_kind: 'ticket', expiry_date: '2026-11-09', next_reminder_at: '2026-11-02 00:00:00', is_active: 'true', meta: '{}' });
	const down = { send: async () => { throw new Error('down'); } };
	const r1 = await runComplianceDue({ repos: w.ctx.repos, mailer: down, log: quiet, now: w.ctx.now });
	assert.deepEqual([r1.sent, r1.failed], [0, 1]);
	assert.equal(w.db.citems[0].next_reminder_at, '2026-11-02 00:00:00', 'still due');
	const up = { send: async (m) => ({ sent: true, count: m.to.length }) };
	const r2 = await runComplianceDue({ repos: w.ctx.repos, mailer: up, log: quiet, now: w.ctx.now });
	assert.equal(r2.sent, 1);
	const log = await notifications.listNotifications(w.ctx);
	assert.deepEqual(log.items.map((i) => [i.event, i.status]).sort(), [['compliance.due', 'failed'], ['compliance.due', 'sent']]);
});

test('a finished post-job checklist emails the managers: install to the PM and install manager, fabrication to the fab manager', async () => {
	const { w, sent, ctx } = setup();
	const IM = '105747000000900009';
	w.db.people.push({ ROWID: 'pm1', first_name: 'Pat', last_name: 'PM', email: 'pat@example.test', roles: ['project_manager'], is_active: 'true' });
	w.db.people.push({ ROWID: IM, first_name: 'Ian', last_name: 'IC', email: 'ian@example.test', roles: ['install_coordinator'], is_active: 'true' });
	w.db.people.push({ ROWID: 'fm1', first_name: 'Fay', last_name: 'FM', email: 'fay@example.test', roles: ['fab_manager'], is_active: 'true' });
	w.db.people.push({ ROWID: 'tl1', first_name: 'Sam', last_name: 'Installer', email: 'sam@example.test', roles: ['installer'], is_active: 'true' });
	w.db.jobs.push({ ROWID: 'j1', name: 'Pylon refresh', pm_id: 'pm1', fab_manager_id: 'fm1' });
	w.db.tasks.push({ ROWID: 't1', job_id: 'j1', task_type: 'install', name: 'Install pylon' });
	w.db.tasks.push({ ROWID: 't2', job_id: 'j1', task_type: 'fabrication', name: 'Cut panels' });
	w.db.checklists.push({ ROWID: 'c1', task_id: 't1', assignee_id: 'tl1', assignee_role: 'lead', phase: 'post' });
	w.db.checklists.push({ ROWID: 'c2', task_id: 't1', assignee_id: 'tl1', assignee_role: 'member', phase: 'post' });
	w.db.checklists.push({ ROWID: 'c3', task_id: 't2', assignee_id: 'tl1', assignee_role: 'member', phase: 'post' });
	await appSettings.updateSettings(w.ctx, { issue_routing: { Install: { manager_id: IM } } });

	await handlers['checklist.closed']({ checklistId: 'c1', taskId: 't1', phase: 'post' }, ctx);
	assert.equal(sent.length, 1, 'one email for the install, not one per person');
	assert.deepEqual(sent[0].to.sort(), ['ian@example.test', 'pat@example.test']);
	assert.match(sent[0].subject, /Install finished on site: Install pylon/);
	assert.match(sent[0].html, /Sam Installer/);

	await handlers['checklist.closed']({ checklistId: 'c2', taskId: 't1', phase: 'post' }, ctx); // a member's checklist
	await handlers['checklist.closed']({ checklistId: 'c1', taskId: 't1', phase: 'pre' }, ctx); // not a post-job checklist
	assert.equal(sent.length, 1, 'only the team leader post-job checklist of an install sends');

	await handlers['checklist.closed']({ checklistId: 'c3', taskId: 't2', phase: 'post' }, ctx);
	assert.equal(sent.length, 2);
	assert.deepEqual(sent[1].to, ['fay@example.test']);
	assert.match(sent[1].subject, /Fab checklist submitted: Cut panels/);
});
