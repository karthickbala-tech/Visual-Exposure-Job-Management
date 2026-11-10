'use strict';

const { forbidden } = require('../errors');
const { OPEN_STATUSES } = require('../domain/issues');
const { daysUntil } = require('../domain/reminders');
const { lastFullWeek } = require('../domain/reports');
const { linkTo } = require('../mail');
const { todayLocal } = require('../time');
const { readSettings } = require('./appSettings');
const { composeEmail, sendAndLog, issueRecipients } = require('./notifications');
const hours = require('./hours');

const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '');
const requireAdmin = (ctx) => {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can run reports');
};

/**
 * The weekly hours report (Wednesday): hours per person for the last full week (Monday to Sunday), emailed in ONE message to the
 * people chosen in settings (`hours_report_recipients`). Hours only, never cost. Without recipients nothing is sent.
 * ctx: { actor (admin), repos, mailer, log, now }
 */
async function runWeeklyHoursReport(ctx) {
	requireAdmin(ctx);
	const settings = await readSettings(ctx.repos);
	const ids = settings.hours_report_recipients || [];
	if (!ids.length) return { ran: false, reason: 'No report recipients are set (Admin settings).' };

	const week = lastFullWeek(todayLocal(ctx.now()));
	const report = await hours.hoursReport(ctx, week.start, week.end, null);
	const people = await ctx.repos.people.findByIds(ids);
	const message = await composeEmail(ctx.repos, 'weeklyHours', { weekStart: week.start, weekEnd: week.end, rows: report.rows, totals: report.totals, link: linkTo('/hours') });
	const result = await sendAndLog(ctx, { event: 'report.weekly_hours', to: people.map((p) => p.email), message });
	return { ran: true, week, people: report.rows.length, sent: !!result.sent, reason: result.reason || null };
}

/**
 * The weekly issues report (Thursday): for each department that has open issues, ONE email listing them, sent to that
 * department's people (its manager and inform-also list from settings, else every project manager).
 */
async function runWeeklyIssuesReport(ctx) {
	requireAdmin(ctx);
	const today = todayLocal(ctx.now());
	const open = await ctx.repos.issues.list({ statuses: OPEN_STATUSES, limit: 300 });
	if (!open.length) return { ran: true, departments: 0, sent: 0 };

	const assigneeIds = [...new Set(open.map((i) => i.assigned_to_id).filter(Boolean).map(String))];
	const assignees = assigneeIds.length ? await ctx.repos.people.findByIds(assigneeIds) : [];
	const nameOf = new Map(assignees.map((p) => [String(p.ROWID), fullName(p)]));

	const byDepartment = new Map();
	for (const i of open) {
		const d = i.department || 'Management';
		byDepartment.set(d, [...(byDepartment.get(d) || []), i]);
	}
	let sent = 0;
	let skipped = 0;
	for (const [department, list] of byDepartment) {
		const issues = list.map((i) => ({
			subject: i.subject,
			priority: i.issue_priority || 'Medium',
			status: i.issue_status,
			ageDays: Math.max(0, daysUntil(today, String(i.CREATEDTIME || today).slice(0, 10))),
			assignee: i.assigned_to_id ? nameOf.get(String(i.assigned_to_id)) || '' : '',
		}));
		const people = await issueRecipients(ctx.repos, { department });
		const message = await composeEmail(ctx.repos, 'weeklyIssues', { department, issues, link: linkTo('/issues') });
		const result = await sendAndLog(ctx, { event: 'report.weekly_issues', to: people.map((p) => p.email), message });
		if (result.sent) sent += 1;
		else skipped += 1;
	}
	return { ran: true, departments: byDepartment.size, sent, notSent: skipped };
}

module.exports = { runWeeklyHoursReport, runWeeklyIssuesReport };
