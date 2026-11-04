'use strict';

const { createRepos } = require('../repos');
const { linkTo } = require('../mail');
const { composeEmail, sendAndLog, issueRecipients } = require('../services/notifications');

/**
 * Event handlers that send email. Each takes (payload, ctx) where ctx = { app, db, log, mailer? }.
 * They never throw because email is missing: no sender or no recipients is logged and skipped.
 */
/** An email built from a template, with the administrator's edits applied. */
const compose = (ctx, name, data) => composeEmail(ctx.repos || createRepos(ctx.db), name, data);

/** Send and log (every send writes a notification-log row). Never throws. */
async function send(ctx, to, message, what) {
	const result = await sendAndLog({ ...ctx, repos: ctx.repos || createRepos(ctx.db) }, { event: what, to, message });
	if (!result.sent) ctx.log.info(result.reason === 'failed' ? 'email failed' : 'email skipped', { what, reason: result.reason });
	else ctx.log.info('email sent', { what, count: result.count });
	return result;
}

/** A new issue goes to the project managers. */
const NAMED_FIELDS = ['assigned_to_id', 'owner_id'];

/**
 * A new issue goes to its department's people. A change goes (in ONE email) to those people plus the person who reported
 * it and whoever it is assigned to or owned by, except the person who made the change; it lists each old and new value.
 */
async function onIssueChanged(payload, ctx) {
	const changed = Array.isArray(payload.changes) && payload.changes.length > 0;
	if (!payload.created && !changed) return;
	const repos = ctx.repos || createRepos(ctx.db);
	const issue = await repos.issues.findById(payload.issueId);
	if (!issue) return;
	const link = linkTo(issue.task_id ? '/tasks/' + issue.task_id : '/issues');

	if (payload.created) {
		const people = await issueRecipients(repos, issue);
		await send(ctx, people.map((p) => p.email), await compose(ctx, 'issueRaised', { issue, link }), 'issue.raised');
		return;
	}
	const involved = [issue.reported_by_id, issue.assigned_to_id, issue.owner_id].filter(Boolean).map(String);
	const people = (await issueRecipients(repos, issue, involved)).filter((p) => String(p.ROWID) !== String(payload.actorId));
	const ids = payload.changes.filter((c) => NAMED_FIELDS.includes(c.field)).flatMap((c) => [c.from, c.to]).filter(Boolean);
	const named = ids.length ? await repos.people.findByIds(ids) : [];
	const nameOf = new Map(named.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
	const changes = payload.changes.map((c) => (NAMED_FIELDS.includes(c.field) ? { ...c, from: nameOf.get(c.from) || c.from, to: nameOf.get(c.to) || c.to } : c));
	await send(ctx, people.map((p) => p.email), await compose(ctx, 'issueUpdated', { issue, changes, link }), 'issue.updated');
}

/** A rejected or reopened task goes back to the people assigned to it. */
async function onTaskStageChanged(payload, ctx) {
	if (!['Rejected', 'Reopen'].includes(payload.to)) return;
	const repos = ctx.repos || createRepos(ctx.db);
	const task = await repos.tasks.findById(payload.taskId);
	if (!task) return;
	const links = await repos.assignees.listForTask(task.ROWID);
	const people = await repos.people.findByIds(links.map((l) => l.person_id));
	const job = await repos.jobs.findById(task.job_id);
	await send(ctx, people.map((p) => p.email), await compose(ctx, 'taskSentBack', { task, stage: payload.to, jobName: job && job.name, link: linkTo('/tasks/' + task.ROWID) }), 'task.sent_back');
}

/** A closed job goes to its project manager and every project manager. (The service guards against sending twice.) */
async function onJobClosed(payload, ctx) {
	const repos = ctx.repos || createRepos(ctx.db);
	const job = await repos.jobs.findById(payload.jobId);
	if (!job) return;
	const managers = await repos.people.listByRole('project_manager');
	const own = job.pm_id ? await repos.people.findByIds([job.pm_id]) : [];
	await send(ctx, [...own, ...managers].map((p) => p.email), await compose(ctx, 'jobClosed', { job, link: linkTo('/jobs/' + job.ROWID) }), 'job.closed');
}

/** Hired equipment went off hire: tell the project managers and install coordinators. */
async function onEquipmentOffHire(payload, ctx) {
	const repos = ctx.repos || createRepos(ctx.db);
	const task = payload.taskId ? await repos.tasks.findById(payload.taskId) : null;
	const groups = await Promise.all(['project_manager', 'install_coordinator'].map((r) => repos.people.listByRole(r)));
	await send(ctx, groups.flat().map((p) => p.email), await compose(ctx, 'equipmentOffHire', { taskName: task && task.name, equipment: payload.equipment || [], link: linkTo('/equipment') }), 'equipment.off_hire');
}

module.exports = { 'issue.changed': onIssueChanged, 'task.stage_changed': onTaskStageChanged, 'job.closed': onJobClosed, 'equipment.off_hire': onEquipmentOffHire, send };
