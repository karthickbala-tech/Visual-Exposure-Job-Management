'use strict';

/**
 * The five live crons, run the way Catalyst runs them: through the job registry, as the system (an admin with no person),
 * so the output is checked before a deploy instead of on real data after it. The cron table is docs/GO_LIVE.md section 4.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const issues = require('../lib/services/issues');
const registers = require('../lib/services/registers');
const appSettings = require('../lib/services/appSettings');
const { JOB_NAMES, handlers, run } = require('../lib/jobs/registry');

// Cron name in Catalyst -> the `job` parameter it sends.
const LIVE_CRONS = {
	compliance_due_daily: 'compliance-due',
	maintenance_daily: 'maintenance-tasks',
	weekly_hours_report: 'weekly-hours-report',
	weekly_issues_report: 'weekly-issues-report',
	drain_outbox_5min: 'crm-sync',
};

const ME = '105747000000900001';
const BOSS = '105747000000900002';

function world() {
	const w = makeWorld();
	w.db.people[0].email = 'me@example.test';
	w.db.people.push({ ROWID: BOSS, first_name: 'Rachel', last_name: 'PM', email: 'rachel@example.test', roles: ['project_manager'], is_active: 'true', is_internal: 'true', department: 'Install' });
	const sent = [];
	const logged = [];
	const log = { info: (m, d) => logged.push([m, d]), warn: (m, d) => logged.push([m, d]), error: (m, d) => logged.push([m, d]) };
	// What the job function builds: an admin with no signed-in person.
	const system = { ...w.as(['admin'], null), log, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } };
	return { w, sent, logged, system, jobCtx: { systemCtx: system, repos: w.ctx.repos, log, now: w.ctx.now, mailer: system.mailer } };
}

test('every live cron sends a job name the job function knows and has a handler for', () => {
	for (const [cron, job] of Object.entries(LIVE_CRONS)) {
		assert.ok(JOB_NAMES.includes(job), `${cron} sends "${job}", which is not a job name`);
		assert.equal(typeof handlers[job], 'function', `${cron}: "${job}" has no handler`);
	}
});

test('maintenance cron: makes the task under the workshop job, and the equipment history shows it as Automatic', async () => {
	const { w, system, jobCtx } = world();
	const { job } = await jobs.createJob(w.ctx, { name: 'Workshop' });
	await appSettings.updateSettings(w.ctx, { workshop_job_id: String(job.ROWID) });
	const saw = (await registers.createEquipment(w.ctx, { name: 'Bandsaw', frequency_days: 30, last_checked: '2026-09-01' })).item;

	assert.deepEqual(await run('maintenance-tasks', {}, jobCtx), { ran: true });
	const made = w.db.tasks.filter((t) => t.kind === 'Maintenance');
	assert.equal(made.length, 1);
	assert.equal(String(made[0].job_id), String(job.ROWID));
	const history = (await registers.equipmentHistory(system, saw.id)).items;
	assert.equal(history[0].by, 'Automatic');
	assert.equal(history[0].reason, 'Maintenance task created');

	await run('maintenance-tasks', {}, jobCtx);
	assert.equal(w.db.tasks.filter((t) => t.kind === 'Maintenance').length, 1, 'a second run the same day makes nothing new');
});

test('maintenance cron without a workshop job: does nothing and says why', async () => {
	const { w, logged, jobCtx } = world();
	await registers.createEquipment(w.ctx, { name: 'Bandsaw', frequency_days: 30, last_checked: '2026-09-01' });
	assert.deepEqual(await run('maintenance-tasks', {}, jobCtx), { ran: true });
	assert.equal(w.db.tasks.length, 0);
	const line = logged.find(([m]) => m === 'maintenance tasks');
	assert.match(line[1].reason, /workshop job is not set/);
});

test('weekly hours cron: one email with last week\'s hours, sent by the system', async () => {
	const { w, sent, jobCtx } = world();
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon' });
	const t = String((await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'fabrication', name: 'Cut', kind: 'CNC' })).task.ROWID);
	w.db.time.push({ ROWID: 'e1', person_id: ME, task_id: t, work_date: '2026-10-28', hours_single: 6, hours_x1_5: 1, hours_x2: 0, unbilled_hours: 0, labour_cost: 500 });
	await appSettings.updateSettings(w.ctx, { hours_report_recipients: [BOSS] });

	assert.deepEqual(await run('weekly-hours-report', {}, jobCtx), { ran: true });
	assert.equal(sent.length, 1);
	assert.deepEqual(sent[0].to, ['rachel@example.test']);
	assert.match(sent[0].subject, /2026-10-26 to 2026-11-01/);
	assert.match(sent[0].html, /Test User/);
	assert.ok(!/500|cost/i.test(sent[0].html), 'hours only, never cost');
});

test('weekly hours cron with nobody chosen: no email', async () => {
	const { sent, jobCtx } = world();
	assert.deepEqual(await run('weekly-hours-report', {}, jobCtx), { ran: true });
	assert.equal(sent.length, 0);
});

test('weekly issues cron: an email per department with open issues, none when there are none', async () => {
	const { w, sent, jobCtx } = world();
	assert.deepEqual(await run('weekly-issues-report', {}, jobCtx), { ran: true });
	assert.equal(sent.length, 0, 'no open issues, no email');

	await issues.createIssue(w.ctx, { subject: 'Sign arrived scratched', department: 'Install', issue_priority: 'High' });
	await run('weekly-issues-report', {}, jobCtx);
	assert.equal(sent.length, 1);
	assert.match(sent[0].subject, /Install/);
	assert.match(sent[0].html, /Sign arrived scratched/);
});

test('CRM cron: skipped when Zoho is not set up; otherwise makes jobs for won deals, then delivers the queue', async () => {
	const { w, logged, jobCtx } = world();
	assert.deepEqual(await run('crm-sync', {}, { ...jobCtx, zoho: null }), { ran: true });
	assert.ok(logged.some(([m]) => /crm-sync skipped/.test(m)));
	assert.equal(w.db.jobs.length, 0);

	const deal = { id: '900', Deal_Name: 'Benton', Stage: 'Closed Won', Closing_Date: '2026-11-04', Owner: { name: 'K', email: 'x@example.test' }, Modified_Time: '2026-11-02T09:00:00+00:00' };
	const zoho = { crm: { listDealsModifiedSince: async () => [deal] } };
	assert.deepEqual(await run('crm-sync', {}, { ...jobCtx, zoho }), { ran: true });
	assert.equal(w.db.jobs.filter((j) => j.crm_deal_id === '900').length, 1);
	assert.ok(logged.some(([m]) => m === 'outbox drained'), 'the queue is delivered in the same run');

	await run('crm-sync', {}, { ...jobCtx, zoho });
	assert.equal(w.db.jobs.filter((j) => j.crm_deal_id === '900').length, 1, 'the next hour makes no second job');
});

test('compliance cron: runs with no email set up and sends nothing', async () => {
	const { w, jobCtx } = world();
	const out = await run('compliance-due', {}, { ...jobCtx, mailer: { send: async () => ({ sent: false, skipped: 'no mail' }) } });
	assert.deepEqual(out, { ran: true });
	assert.equal(w.db.citems.length, 0);
});
