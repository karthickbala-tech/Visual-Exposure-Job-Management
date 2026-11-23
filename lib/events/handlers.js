'use strict';

const { createRepos } = require('../repos');
const { linkTo } = require('../mail');
const { composeEmail, sendAndLog, issueRecipients } = require('../services/notifications');
const { departmentFor } = require('../domain/issues');
const { closureFigures } = require('../domain/jobList');
const { createZoho } = require('../integrations/zoho');

const amount = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/**
 * Revenue and profit for the closure report, read from the job's CRM deal (WORKFLOWS: Total_Revenue, Job_Profit, Job_Profit1 = profit %).
 * Null when the job has no deal, Zoho is not connected, or the read fails: the report is still sent, without them.
 */
async function dealFigures(ctx, job) {
	if (!job.crm_deal_id) return null;
	const zoho = ctx.zoho === undefined ? createZoho() : ctx.zoho;
	if (!zoho) return null;
	try {
		const deal = await zoho.crm.getDeal(job.crm_deal_id);
		if (!deal) return null;
		return { revenue: amount(deal.Total_Revenue), profit: amount(deal.Job_Profit), profitPercent: amount(deal.Job_Profit1) };
	} catch (err) {
		ctx.log.warn('closure report: CRM deal not read', { error: err.message });
		return null;
	}
}
const { readSettings } = require('../services/appSettings');

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
		// Several issues raised by one checklist come as one event: one email names them all (same task, so same department).
		const more = Array.isArray(payload.alsoIssueIds) ? (await Promise.all(payload.alsoIssueIds.map((id) => repos.issues.findById(id)))).filter(Boolean) : [];
		const shown = more.length
			? { ...issue, subject: `${issue.subject} (and ${more.length} more)`, description: `Flagged answers: ${[issue.subject, ...more.map((i) => i.subject)].join('; ')}` }
			: issue;
		await send(ctx, people.map((p) => p.email), await compose(ctx, 'issueRaised', { issue: shown, link }), 'issue.raised');
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

const TYPE_LABEL = { install: 'Install', fabrication: 'Fabrication', design: 'Design' };

/**
 * Submitted for approval (WORKFLOWS section 13): the job's project manager for install and design tasks, its fab manager for
 * fabrication. A job with nobody in that place goes to everyone holding the role, so the request is never lost.
 */
async function sendApprovalRequest(payload, ctx, repos) {
	const task = await repos.tasks.findById(payload.taskId);
	if (!task || !TYPE_LABEL[task.task_type]) return;
	const job = await repos.jobs.findById(task.job_id);
	const fab = task.task_type === 'fabrication';
	const ownId = job && (fab ? job.fab_manager_id : job.pm_id);
	const people = ownId ? await repos.people.findByIds([ownId]) : await repos.people.listByRole(fab ? 'fab_manager' : 'project_manager');
	const data = { task, typeLabel: TYPE_LABEL[task.task_type], jobName: job && job.name, link: linkTo('/tasks/' + task.ROWID) };
	await send(ctx, people.map((p) => p.email), await compose(ctx, 'taskApproval', data), 'task.approval_requested');
}

/**
 * An approval flagged for a management review or an OH&S concern (WORKFLOWS section 4, INS-5) goes to the task department's
 * manager and inform-also list from settings (Install for install tasks, Workshop for fabrication), as issues are routed.
 */
async function sendApprovalFlag(payload, ctx, repos) {
	const task = await repos.tasks.findById(payload.taskId);
	if (!task) return;
	const job = await repos.jobs.findById(task.job_id);
	const people = await issueRecipients(repos, { department: departmentFor(task.task_type) });
	const data = { task, jobName: job && job.name, ohs: payload.ohs === 'Yes', managementReview: !!payload.managementReview, comment: payload.comment, link: linkTo('/tasks/' + task.ROWID) };
	await send(ctx, people.map((p) => p.email), await compose(ctx, 'approvalFlagged', data), 'task.approval_flagged');
}

/**
 * A task submitted for approval tells its manager; an approval flagged for review or OH&S tells the department; a rejected or
 * reopened task goes back to the people assigned to it.
 */
async function onTaskStageChanged(payload, ctx) {
	const repos = ctx.repos || createRepos(ctx.db);
	if (payload.to === 'Manager Review') return sendApprovalRequest(payload, ctx, repos);
	if (payload.ohs === 'Yes' || payload.managementReview) return sendApprovalFlag(payload, ctx, repos);
	if (!['Rejected', 'Reopen'].includes(payload.to)) return;
	const task = await repos.tasks.findById(payload.taskId);
	if (!task) return;
	const links = await repos.assignees.listForTask(task.ROWID);
	const people = await repos.people.findByIds(links.map((l) => l.person_id));
	const job = await repos.jobs.findById(task.job_id);
	await send(ctx, people.map((p) => p.email), await compose(ctx, 'taskSentBack', { task, stage: payload.to, jobName: job && job.name, link: linkTo('/tasks/' + task.ROWID) }), 'task.sent_back');
}

/**
 * The job closure report (WORKFLOWS section 13: directors, PM, fab manager; sent once, the service guards it).
 * Administrators (the directors) get hours, labour cost, purchases and the CRM revenue and profit. The job's project manager
 * and fab manager get the hours only, because money is for administrators (FSD JOB-9). A job with neither goes to every
 * project manager. Someone who is both gets the administrators' copy only.
 */
async function onJobClosed(payload, ctx) {
	const repos = ctx.repos || createRepos(ctx.db);
	const job = await repos.jobs.findById(payload.jobId);
	if (!job) return;
	const link = linkTo('/jobs/' + job.ROWID);
	const tasks = await repos.tasks.listByJob(job.ROWID);
	const admins = await repos.people.listByRole('admin');
	const leadIds = [job.pm_id, job.fab_manager_id].filter(Boolean).map(String);
	const leads = leadIds.length ? await repos.people.findByIds(leadIds) : await repos.people.listByRole('project_manager');
	const adminEmails = new Set(admins.map((p) => String(p.email || '').toLowerCase()));
	const crm = admins.length ? await dealFigures(ctx, job) : null;
	if (admins.length) {
		await send(ctx, admins.map((p) => p.email), await compose(ctx, 'jobClosed', { job, figures: closureFigures(tasks, true), money: true, crm, link }), 'job.closed');
	}
	const others = leads.filter((p) => !adminEmails.has(String(p.email || '').toLowerCase()));
	if (others.length) {
		await send(ctx, others.map((p) => p.email), await compose(ctx, 'jobClosed', { job, figures: closureFigures(tasks, false), money: false, link }), 'job.closed');
	}
}

/** Hired equipment went off hire: tell the project managers and install coordinators. */
async function onEquipmentOffHire(payload, ctx) {
	const repos = ctx.repos || createRepos(ctx.db);
	const task = payload.taskId ? await repos.tasks.findById(payload.taskId) : null;
	const groups = await Promise.all(['project_manager', 'install_coordinator'].map((r) => repos.people.listByRole(r)));
	await send(ctx, groups.flat().map((p) => p.email), await compose(ctx, 'equipmentOffHire', { taskName: task && task.name, equipment: payload.equipment || [], link: linkTo('/equipment') }), 'equipment.off_hire');
}

/**
 * A finished post-job checklist tells the manager (DS workflows "Send Email to PM (Finished On Site)" and "Send Email to Fab Manager").
 * Install: the team leader's checklist, to the job's project manager and the installation manager from the settings, in one email.
 * Fabrication: to the job's fab manager. Skipped quietly when there is nobody to tell.
 */
async function onChecklistClosed(payload, ctx) {
	if (payload.phase !== 'post') return;
	const repos = ctx.repos || createRepos(ctx.db);
	const checklist = await repos.checklists.findById(payload.checklistId);
	const task = await repos.tasks.findById(payload.taskId);
	if (!checklist || !task) return;
	const isInstall = task.task_type === 'install';
	if (!isInstall && task.task_type !== 'fabrication') return;
	if (isInstall && checklist.assignee_role !== 'lead') return;
	const job = task.job_id ? await repos.jobs.findById(task.job_id) : null;
	const who = checklist.assignee_id ? (await repos.people.findByIds([checklist.assignee_id]))[0] : null;
	const whoName = who ? `${who.first_name || ''} ${who.last_name || ''}`.trim() : '';
	const ids = [];
	if (isInstall) {
		const settings = await readSettings(repos);
		const route = settings.issue_routing && settings.issue_routing.Install;
		ids.push(job && job.pm_id, route && route.manager_id);
	} else {
		ids.push(job && job.fab_manager_id);
	}
	const people = await repos.people.findByIds([...new Set(ids.filter(Boolean).map(String))]);
	const data = { taskName: task.name, jobName: job && job.name, who: whoName, link: linkTo('/tasks/' + task.ROWID) };
	await send(ctx, people.map((p) => p.email), await compose(ctx, isInstall ? 'installFinished' : 'fabChecklistSubmitted', data), isInstall ? 'install.finished_on_site' : 'fab.checklist_submitted');
}

module.exports = { 'checklist.closed': onChecklistClosed, 'issue.changed': onIssueChanged, 'task.stage_changed': onTaskStageChanged, 'job.closed': onJobClosed, 'equipment.off_hire': onEquipmentOffHire, send };
