'use strict';

const { createRepos } = require('../repos');
const { createMailer, linkTo } = require('../mail');
const { render, cleanRecipients } = require('../domain/notifications');

/**
 * Event handlers that send email. Each takes (payload, ctx) where ctx = { app, db, log, mailer? }.
 * They never throw because email is missing: no sender or no recipients is logged and skipped.
 */
const MANAGER_ROLES = ['project_manager'];

async function send(ctx, to, message, what) {
	const mailer = ctx.mailer || createMailer(ctx.app);
	const recipients = cleanRecipients(to);
	const result = await mailer.send({ to: recipients, subject: message.subject, html: message.html });
	if (!result.sent) ctx.log.info('email skipped', { what, reason: result.reason });
	else ctx.log.info('email sent', { what, count: result.count });
	return result;
}

/** A new issue goes to the project managers. */
async function onIssueChanged(payload, ctx) {
	if (!payload.created) return;
	const repos = ctx.repos || createRepos(ctx.db);
	const issue = await repos.issues.findById(payload.issueId);
	if (!issue) return;
	const managers = (await Promise.all(MANAGER_ROLES.map((r) => repos.people.listByRole(r)))).flat();
	const task = issue.task_id ? { id: issue.task_id } : null;
	await send(ctx, managers.map((p) => p.email), render('issueRaised', { issue, link: linkTo(task ? '/tasks/' + task.id : '/issues') }), 'issue.raised');
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
	await send(ctx, people.map((p) => p.email), render('taskSentBack', { task, stage: payload.to, jobName: job && job.name, link: linkTo('/tasks/' + task.ROWID) }), 'task.sent_back');
}

module.exports = { 'issue.changed': onIssueChanged, 'task.stage_changed': onTaskStageChanged, send };
