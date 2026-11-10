'use strict';

/**
 * The manager's "To do now" list: the few things that need a person today, most urgent first. Pure, no I/O.
 * Individual tasks and issues are listed by name (at most 3 of each kind); the rest are folded into one line with a count.
 * tone: 'danger' (late or unsafe), 'warn' (waiting on you), 'info' (planning).
 */
const SHOW = 3;
const TONE_ORDER = { danger: 0, warn: 1, info: 2 };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function todoItems({ swms = [], reviewTasks = [], scheduleTasks = [], issues = [], compliance = [], overdueTasks = 0, today }) {
	const items = [];

	if (swms.length) {
		const created = swms.filter((s) => s.swms_status === 'Created').length;
		items.push({ id: 'swms', tone: 'danger', title: `${plural(swms.length, 'SWMS is', 'SWMS are')} waiting for a signature`, detail: `${created} not signed yet, ${swms.length - created} signed by the project manager only`, to: '/swms', action: 'Open SWMS' });
	}

	reviewTasks.slice(0, SHOW).forEach((t) => items.push({ id: 'review-' + t.ROWID, tone: 'warn', title: `Review: ${t.name}`, detail: `${t.task_type} task waiting for approval`, to: '/tasks/' + t.ROWID, action: 'Review' }));
	if (reviewTasks.length > SHOW) items.push({ id: 'review-more', tone: 'warn', title: `${reviewTasks.length - SHOW} more tasks waiting for approval`, detail: '', to: '/tasks', action: 'Open board' });

	if (overdueTasks > 0) items.push({ id: 'overdue', tone: 'danger', title: `${plural(overdueTasks, 'task is', 'tasks are')} past the required finish`, detail: '', to: '/tasks', action: 'Open board' });

	const urgent = issues.filter((i) => i.issue_priority === 'High' && !['Completed'].includes(i.issue_status));
	urgent.slice(0, SHOW).forEach((i) => items.push({ id: 'issue-' + i.ROWID, tone: 'danger', title: `${i.issue_priority} issue: ${i.subject}`, detail: `${i.department || 'Management'} · ${i.issue_status}`, to: '/issues', action: 'Open issues' }));
	if (urgent.length > SHOW) items.push({ id: 'issue-more', tone: 'danger', title: `${urgent.length - SHOW} more high priority issues`, detail: '', to: '/issues', action: 'Open issues' });

	const expired = compliance.filter((c) => c.expiry_date && String(c.expiry_date).slice(0, 10) < today).length;
	const soon = compliance.filter((c) => c.expiry_date && String(c.expiry_date).slice(0, 10) >= today).length;
	if (expired) items.push({ id: 'expired', tone: 'danger', title: `${plural(expired, 'compliance item has', 'compliance items have')} expired`, detail: 'Tickets, inductions or company documents', to: '/compliance', action: 'Open compliance' });
	if (soon) items.push({ id: 'soon', tone: 'warn', title: `${plural(soon, 'compliance item expires', 'compliance items expire')} within 30 days`, detail: '', to: '/compliance', action: 'Open compliance' });

	scheduleTasks.slice(0, SHOW).forEach((t) => items.push({ id: 'schedule-' + t.ROWID, tone: 'info', title: `Schedule: ${t.name}`, detail: 'Install task waiting for a date and a crew', to: '/tasks/' + t.ROWID, action: 'Schedule' }));
	if (scheduleTasks.length > SHOW) items.push({ id: 'schedule-more', tone: 'info', title: `${scheduleTasks.length - SHOW} more install tasks to schedule`, detail: '', to: '/tasks', action: 'Open board' });

	return items.map((it, i) => ({ it, i })).sort((a, b) => TONE_ORDER[a.it.tone] - TONE_ORDER[b.it.tone] || a.i - b.i).map((x) => x.it);
}

module.exports = { todoItems, SHOW };
