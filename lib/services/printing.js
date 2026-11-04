'use strict';

const { AppError } = require('../errors');
const { z, parse } = require('../validate');
const P = require('../domain/print');
const swmsService = require('./swms');
const issueService = require('./issues');

const layoutQuery = z.object({ layout: z.enum(P.ISSUE_LAYOUTS).default('summary') });

/** HTML to PDF with Catalyst SmartBrowz. One call per document, on request only (never in a loop). */
async function toPdf(ctx, html) {
	const app = ctx.actor && ctx.actor.app;
	if (!app || typeof app.smartbrowz !== 'function') throw new AppError(503, 'pdf_unavailable', 'PDF generation is not available');
	let out;
	try {
		out = await app.smartbrowz().convertToPdf(html, { pdf_options: { format: 'A4', print_background: true, margin: { top: '12', bottom: '12', left: '10', right: '10' } }, navigation_options: { wait_until: 'domcontentloaded', timeout: 30000 } });
	} catch (err) {
		if (ctx.log) ctx.log.error('pdf failed', { error: err.message });
		throw new AppError(502, 'pdf_failed', 'The PDF could not be made right now');
	}
	return toBuffer(out);
}

/** The SDK hands back a stream (IncomingMessage); tests and other versions may give bytes. Read whichever it is into one Buffer. */
async function toBuffer(out) {
	if (Buffer.isBuffer(out)) return out;
	if (out instanceof ArrayBuffer || ArrayBuffer.isView(out) || typeof out === 'string') return Buffer.from(out);
	if (out && typeof out[Symbol.asyncIterator] === 'function') {
		const chunks = [];
		for await (const c of out) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
		return Buffer.concat(chunks);
	}
	throw new AppError(502, 'pdf_failed', 'The PDF could not be made right now');
}

const wrap = (buffer, name) => ({ raw: { contentType: 'application/pdf', filename: name, buffer } });

/** SW-4: the SWMS as PDF. Same access as viewing it. */
async function swmsPdf(ctx, id) {
	const { swms, taskId } = await swmsService.getSwms(ctx, id);
	const job = await ctx.repos.jobs.findById(swms.jobId);
	const task = taskId ? await ctx.repos.tasks.findById(taskId) : null;
	const wm = swms.workManagerId ? (await ctx.repos.people.findByIds([swms.workManagerId]))[0] : null;
	const html = P.swmsHtml(swms, { jobName: job && job.name, taskName: task && task.name, workManager: wm ? `${wm.first_name || ''} ${wm.last_name || ''}`.trim() : '' });
	return wrap(await toPdf(ctx, html), `swms-${swms.id}.pdf`);
}

/** ISS-5: an issue as PDF in one of the layouts. Hidden fields stay hidden (it prints what the caller may see). */
async function issuePdf(ctx, id, rawQuery = {}) {
	const { layout } = parse(layoutQuery, rawQuery);
	const { issue } = await issueService.getIssue(ctx, id);
	const history = layout === 'full' ? (await issueService.issueHistory(ctx, id)).items : [];
	return wrap(await toPdf(ctx, P.issueHtml(issue, history, layout)), `issue-${issue.ROWID}.pdf`);
}

module.exports = { swmsPdf, issuePdf };
