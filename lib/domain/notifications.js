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
			`Priority: ${issue.issue_priority || 'Normal'}`,
			issue.source_kind === 'checklist' ? 'Raised from a checklist answer.' : 'Raised manually.',
			issue.description,
		], link),

	complianceDue: ({ who, what, expiry, days, link }) =>
		wrap(`${what} ${days <= 0 ? 'expires today' : 'expires in ' + days + ' days'}: ${who}`, [
			`${who}'s ${what} expires on ${expiry}.`,
			'Please arrange a renewal and update the record in the app.',
		], link),

	equipmentOffHire: ({ taskName, equipment, link }) =>
		wrap(`Equipment off hire: ${equipment.map((e) => e.code).join(', ')}`, [
			taskName ? `The install "${taskName}" has finished on site.` : 'An install has finished on site.',
			'These hired items are now marked off hire, so please arrange their return:',
			...equipment.map((e) => `${e.code} - ${e.name}`),
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

module.exports = { render, cleanRecipients, escapeHtml };
