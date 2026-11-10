'use strict';

/**
 * Email content for the events we notify on. Pure: data in, { subject, html, text } out.
 * User-entered text is always escaped; nothing here builds links (the app URL is added by the caller).
 */
const escapeHtml = (s) =>
	String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const wrap = (title, lines, link) => {
	const body = lines.filter(Boolean);
	return {
		subject: title,
		text: [...body, link ? `Open: ${link}` : ''].filter(Boolean).join('\n'),
		html:
			`<div style="font-family:Raleway,Arial,sans-serif;color:#1b1b1e"><h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>` +
			body.map((l) => `<p style="margin:0 0 8px">${escapeHtml(l)}</p>`).join('') +
			(link ? `<p><a href="${escapeHtml(link)}" style="color:#4e5ac3">Open in Visual Exposure</a></p>` : '') +
			'</div>',
	};
};

const TEMPLATES = {
	issueRaised: ({ issue, link }) =>
		wrap(`New issue: ${issue.subject}`, [
			`Department: ${issue.department || 'Management'}`,
			`Priority: ${issue.issue_priority || 'Medium'}`,
			issue.source_kind === 'checklist' ? 'Raised from a checklist answer.' : 'Raised manually.',
			issue.description,
		], link),

	complianceDue: ({ who, what, expiry, days, link }) =>
		wrap(`${what} ${days <= 0 ? 'expires today' : 'expires in ' + days + ' days'}: ${who}`, [
			`${who}'s ${what} expires on ${expiry}.`,
			'Please arrange a renewal and update the record in the app.',
		], link),

	/** An issue was changed: every changed field with its old and new value (ISS-2). */
	issueUpdated: ({ issue, changes, link }) =>
		wrap(`Issue updated: ${issue.subject}`, [
			`Department: ${issue.department || 'Management'}`,
			...changes.map((c) => (c.long ? `${c.label} was changed.` : `${c.label}: ${c.from || 'none'} -> ${c.to || 'none'}`)),
		], link),

	/** The weekly hours report (Wednesday): one line per person with the week's hours. Hours only, never cost. */
	weeklyHours: ({ weekStart, weekEnd, rows, totals, link }) =>
		wrap(`Weekly hours report: ${weekStart} to ${weekEnd}`, [
			rows.length ? `Hours worked by ${rows.length} ${rows.length === 1 ? 'person' : 'people'}:` : 'No hours were booked this week.',
			...rows.map((r) => `${r.name || 'Unknown'}: fab ${r.totals.fab}, install ${r.totals.install}, workshop ${r.totals.workshop}, design ${r.totals.design}, unbilled ${r.totals.unbilled}, total ${r.totals.total}, final ${r.totals.final}`),
			rows.length ? `Everyone: total ${totals.total}, final ${totals.final}.` : '',
		], link),

	/** The weekly issues report (Thursday): the open issues of one department. */
	weeklyIssues: ({ department, issues, link }) =>
		wrap(`Open issues this week: ${department} (${issues.length})`, [
			`${issues.length} open ${issues.length === 1 ? 'issue' : 'issues'} in ${department}:`,
			...issues.map((i) => `${i.subject} - ${i.priority}, ${i.status}, open ${i.ageDays} ${i.ageDays === 1 ? 'day' : 'days'}${i.assignee ? `, assigned to ${i.assignee}` : ', not assigned'}`),
		], link),

	equipmentOffHire: ({ taskName, equipment, link }) =>
		wrap(`Equipment off hire: ${equipment.map((e) => e.code).join(', ')}`, [
			taskName ? `The install "${taskName}" has finished on site.` : 'An install has finished on site.',
			'These hired items are now marked off hire, so please arrange their return:',
			...equipment.map((e) => `${e.code} - ${e.name}`),
		], link),

	/** DS workflow "Send Email to PM (Finished On Site)": the team has finished an install on site. */
	installFinished: ({ taskName, jobName, who, link }) =>
		wrap(`Install finished on site: ${taskName}`, [
			`${who || 'The team'} has finished on site for the install "${taskName}"${jobName ? ` (job: ${jobName})` : ''}.`,
			'Please review the details in the app.',
		], link),

	/** DS workflow "Send Email to Fab Manager": a team member has completed a fabrication task's post-job checklist. */
	fabChecklistSubmitted: ({ taskName, jobName, who, link }) =>
		wrap(`Fab checklist submitted: ${taskName}`, [
			`${who || 'The staff member'} has marked the fabrication task "${taskName}" as complete${jobName ? ` (job: ${jobName})` : ''}.`,
			'Please review the checklist and any issues raised.',
		], link),

	jobClosed: ({ job, link }) =>
		wrap(`Job closed: ${job.name}`, [
			`Every task on "${job.name}" is finished and the job is now closed.`,
			job.completed_date ? `Completed on ${job.completed_date}.` : '',
		], link),

	taskSentBack: ({ task, stage, jobName, link }) =>
		wrap(`Task needs more work: ${task.name}`, [
			jobName ? `Job: ${jobName}` : '',
			`The manager moved this task to "${stage}". Please check the notes in the app, fix it, and submit again.`,
		], link),
};

/** Render a template by name. Unknown names throw so a typo is caught in tests, not in production. */
function render(name, data) {
	if (!TEMPLATES[name]) throw new Error(`Unknown email template: ${name}`);
	return TEMPLATES[name](data);
}

/** Only real, de-duplicated email addresses. */
function cleanRecipients(list) {
	const seen = new Set();
	for (const e of list || []) {
		const v = String(e || '').trim().toLowerCase();
		if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) seen.add(v);
	}
	return [...seen];
}

/**
 * What an administrator can edit in each email (FSD section 8): the subject, an intro paragraph before the details, and a
 * footer after them. Edits can use {placeholders}, listed here per template, which are filled in when the email is built.
 * `vars` turns the data a handler passes into those placeholders; `sample` is used for previews.
 */
const TEMPLATE_INFO = {
	issueRaised: {
		label: 'New issue',
		vars: ({ issue }) => ({ subject: issue.subject, department: issue.department || 'Management', priority: issue.issue_priority || 'Normal' }),
		sample: { issue: { subject: 'Loose bracket on pylon', department: 'Install', issue_priority: 'High', source_kind: 'manual', description: 'Found during the site walk.' }, link: 'https://example.test/app' },
	},
	issueUpdated: {
		label: 'Issue updated',
		vars: ({ issue }) => ({ subject: issue.subject, department: issue.department || 'Management' }),
		sample: { issue: { subject: 'Loose bracket on pylon', department: 'Install' }, changes: [{ label: 'Status', from: 'Open', to: 'In Progress' }], link: 'https://example.test/app' },
	},
	complianceDue: {
		label: 'Ticket or document expiring',
		vars: ({ who, what, expiry, days }) => ({ who, what, expiry, days: String(days) }),
		sample: { who: 'Sam Installer', what: 'Working at Heights', expiry: '2026-12-01', days: 14, link: 'https://example.test/app' },
	},
	taskSentBack: {
		label: 'Task sent back for more work',
		vars: ({ task, stage, jobName }) => ({ task: task.name, stage, job: jobName || '' }),
		sample: { task: { name: 'Install pylon' }, stage: 'Rejected', jobName: 'Pylon refresh', link: 'https://example.test/app' },
	},
	jobClosed: {
		label: 'Job closed',
		vars: ({ job }) => ({ job: job.name, completed: job.completed_date || '' }),
		sample: { job: { name: 'Pylon refresh', completed_date: '2026-11-04' }, link: 'https://example.test/app' },
	},
	weeklyHours: {
		label: 'Weekly hours report',
		vars: ({ weekStart, weekEnd, rows }) => ({ from: weekStart, to: weekEnd, people: String(rows.length) }),
		sample: { weekStart: '2026-10-26', weekEnd: '2026-11-01', rows: [{ name: 'Sam Installer', totals: { fab: 10, install: 20, workshop: 2, design: 0, unbilled: 1, total: 32, final: 31 } }], totals: { total: 32, final: 31 }, link: 'https://example.test/app' },
	},
	weeklyIssues: {
		label: 'Weekly open issues',
		vars: ({ department, issues }) => ({ department, count: String(issues.length) }),
		sample: { department: 'Install', issues: [{ subject: 'Loose bracket on pylon', priority: 'High', status: 'Open', ageDays: 3, assignee: 'Sam Installer' }], link: 'https://example.test/app' },
	},
	equipmentOffHire: {
		label: 'Hired equipment off hire',
		vars: ({ taskName, equipment }) => ({ task: taskName || '', equipment: equipment.map((e) => e.code).join(', ') }),
		sample: { taskName: 'Install pylon', equipment: [{ code: 'VE - 101', name: 'Scissor lift' }], link: 'https://example.test/app' },
	},
	installFinished: {
		label: 'Install finished on site',
		vars: ({ taskName, jobName, who }) => ({ task: taskName || '', job: jobName || '', who: who || '' }),
		sample: { taskName: 'Install pylon', jobName: 'Pylon refresh', who: 'Sam Installer', link: 'https://example.test/app' },
	},
	fabChecklistSubmitted: {
		label: 'Fabrication checklist submitted',
		vars: ({ taskName, jobName, who }) => ({ task: taskName || '', job: jobName || '', who: who || '' }),
		sample: { taskName: 'Cut panels', jobName: 'Pylon refresh', who: 'Sam Fabricator', link: 'https://example.test/app' },
	},
};

const placeholdersOf = (name) => Object.keys(TEMPLATE_INFO[name].vars(TEMPLATE_INFO[name].sample));
const fill = (text, vars, escape) => String(text).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? escape(vars[k]) : ''));

/** The unknown {placeholders} in a piece of text (so a typo is refused when saving, not shown to a customer). */
function unknownPlaceholders(text, name) {
	const known = new Set(placeholdersOf(name));
	return [...new Set([...String(text || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].filter((k) => !known.has(k));
}

/**
 * Apply an administrator's edits to an email built by `render`. The subject replaces the original (also shown as the heading);
 * the intro goes under the heading and the footer at the end. Values are escaped in the HTML, so edits cannot inject markup.
 */
function applyOverrides(message, override, name, data) {
	if (!override || !TEMPLATE_INFO[name]) return message;
	const vars = TEMPLATE_INFO[name].vars(data);
	let { subject, html, text } = message;
	if (override.subject) {
		const heading = `<h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>`;
		subject = fill(override.subject, vars, String);
		html = html.replace(heading, `<h2 style="margin:0 0 12px">${escapeHtml(subject)}</h2>`);
		text = text.replace(message.subject, subject);
	}
	if (override.intro) {
		const para = (t) => `<p style="margin:0 0 8px">${fill(t, vars, escapeHtml)}</p>`;
		html = html.replace('</h2>', `</h2>${para(override.intro)}`);
		text = `${fill(override.intro, vars, String)}\n${text}`;
	}
	if (override.footer) {
		html = html.replace(/<\/div>$/, `<p style="margin:12px 0 0;color:#5f6368">${fill(override.footer, vars, escapeHtml)}</p></div>`);
		text = `${text}\n${fill(override.footer, vars, String)}`;
	}
	return { subject, html, text };
}

module.exports = { render, cleanRecipients, escapeHtml, TEMPLATE_INFO, placeholdersOf, unknownPlaceholders, applyOverrides };
