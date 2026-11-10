'use strict';

const { escapeHtml: h } = require('./notifications');
const { HAZARDS } = require('./swms');

/** Printable documents (SW-4, ISS-5) as plain HTML, turned into PDF by SmartBrowz. Pure: no I/O. Every value is escaped. */

const CSS =
	'body{font-family:Raleway,Arial,sans-serif;color:#1b1b1e;font-size:11px;margin:0}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #68b04d;padding-bottom:2px}' +
	'table{width:100%;border-collapse:collapse}th,td{border:1px solid #c9ccd1;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f1f3f4;width:28%}.muted{color:#5f6368}.sig{height:34px}';

const page = (title, body) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${h(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
const rows = (pairs) => `<table>${pairs.map(([k, v]) => `<tr><th>${h(k)}</th><td>${h(v === null || v === undefined || v === '' ? '-' : v)}</td></tr>`).join('')}</table>`;
const list = (items) => (items.length ? `<ul>${items.map((i) => `<li>${h(i)}</li>`).join('')}</ul>` : '<p class="muted">None</p>');

/** The SWMS: company details, site, PPE, tasks, who declared and the sign-offs. */
function swmsHtml(swms, ctx = {}) {
	const signoff = swms.signoff || {};
	const sign = (key, label) => {
		const s = signoff[key];
		return [label, s ? `${s.name || ''} (${s.at || ''})` : 'Not signed'];
	};
	const decl = (swms.declarations || []).map((d) => `<tr><td>${h(d.name || '')}</td><td>${h(d.at || '')}</td><td class="sig"></td></tr>`).join('');
	const tasks = (swms.tasks || []).map((t) => `<tr><td>${h(t.task)}</td><td>${h(t.responsible || '-')}</td></tr>`).join('');
	return page(
		`SWMS ${ctx.jobName || ''}`,
		`<h1>Safe Work Method Statement</h1><p class="muted">${h(ctx.jobName || '')} - status ${h(swms.status)}</p>` +
			`<h2>Company (PCBU)</h2>${rows(Object.entries(swms.pcbu || {}))}` +
			`<h2>Site</h2>${rows([['Address', swms.siteAddress], ['Work manager', ctx.workManager], ['Install task', ctx.taskName]])}` +
			`<h2>High-risk work</h2>${list((swms.hazards || []).map((k) => (HAZARDS.find((x) => x.key === k) || { label: k }).label))}` +
			`<h2>PPE</h2>${list(swms.ppe || [])}` +
			`<h2>Tasks</h2><table><tr><th>Task</th><th>Responsible</th></tr>${tasks || '<tr><td colspan="2" class="muted">None</td></tr>'}</table>` +
			`<h2>Declarations</h2><table><tr><th>Worker</th><th>Date</th><th>Signature</th></tr>${decl || '<tr><td colspan="3" class="muted">None yet</td></tr>'}</table>` +
			`<h2>Sign-off</h2>${rows([sign('pm', 'Project manager'), sign('tl', 'Team leader')])}`,
	);
}

/** The layouts an issue can be printed in. ASSUMPTION: two layouts until the client confirms the seven from Creator (FSD question 7). */
const ISSUE_LAYOUTS = ['summary', 'full'];

function issueHtml(issue, history = [], layout = 'summary') {
	const label = (f) => f.replace(/_/g, ' ');
	const base = rows([
		['Subject', issue.subject],
		['Department', issue.department],
		['Status', issue.issue_status],
		['Priority', issue.issue_priority],
		['Reported', issue.CREATEDTIME],
	]);
	let body = `<h1>Issue ${h(issue.ROWID)}</h1>${base}`;
	if (layout === 'full') {
		body += `<h2>Details</h2><p>${h(issue.description || '-')}</p>`;
		const changes = history.flatMap((e) => (e.changes || []).map((c) => `<tr><td>${h(e.at || '')}</td><td>${h(label(c.field))}</td><td>${h(c.from)}</td><td>${h(c.to)}</td></tr>`)).join('');
		body += `<h2>History</h2><table><tr><th>When</th><th>Field</th><th>From</th><th>To</th></tr>${changes || '<tr><td colspan="4" class="muted">No changes</td></tr>'}</table>`;
	}
	return page(`Issue ${issue.ROWID}`, body);
}

module.exports = { swmsHtml, issueHtml, ISSUE_LAYOUTS };
