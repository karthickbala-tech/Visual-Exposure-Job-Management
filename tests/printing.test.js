'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const issues = require('../lib/services/issues');
const printing = require('../lib/services/printing');
const P = require('../lib/domain/print');

const pdfApp = (calls) => ({ smartbrowz: () => ({ convertToPdf: async (html, opts) => (calls.push({ html, opts }), Buffer.from('%PDF-1.4 fake')) }) });

test('the SWMS document escapes everything and shows sign-offs, declarations and PPE', () => {
	const html = P.swmsHtml(
		{ status: 'PM Signed', pcbu: { name: '<b>VE</b>' }, siteAddress: '1 Main St', ppe: ['Hard hat'], tasks: [{ task: 'Fit <sign>', responsible: 'Sam' }], declarations: [{ name: 'Sam', at: '2026-11-02' }], signoff: { pm: { name: 'Rachel', at: '2026-11-02' } } },
		{ jobName: 'Pylon & Co', taskName: 'Fit', workManager: 'Rachel' },
	);
	assert.match(html, /Pylon &amp; Co/);
	assert.ok(!html.includes('<b>VE</b>') && !html.includes('<sign>'), 'no raw markup from data');
	assert.match(html, /Hard hat/);
	assert.match(html, /Rachel \(2026-11-02\)/);
	assert.match(html, /Not signed/, 'team leader has not signed');
});

test('issue layouts: summary has the basics, full adds details and history', () => {
	const issue = { ROWID: '7', subject: 'Wet floor', department: 'Install', issue_status: 'Open', issue_priority: 'High', description: 'Slippery', CREATEDTIME: '2026-11-01' };
	const s = P.issueHtml(issue, [], 'summary');
	assert.match(s, /Wet floor/);
	assert.ok(!/History/.test(s));
	const f = P.issueHtml(issue, [{ at: '2026-11-02', changes: [{ field: 'issue_status', from: 'Open', to: 'Resolved' }] }], 'full');
	assert.match(f, /Slippery/);
	assert.match(f, /issue status/);
	assert.match(f, /Resolved/);
});

test('swmsPdf and issuePdf return a PDF made through SmartBrowz; bad layout is 400; no SmartBrowz is 503', async () => {
	const w = makeWorld();
	const calls = [];
	w.ctx.actor.app = pdfApp(calls);
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon' })).job;
	const task = (await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'install', name: 'Fit', kind: 'VE Install' })).task;
	const swmsId = String(w.db.swms[0].ROWID);

	const out = await printing.swmsPdf(w.ctx, swmsId);
	assert.equal(out.raw.contentType, 'application/pdf');
	assert.equal(out.raw.filename, `swms-${swmsId}.pdf`);
	assert.match(calls[0].html, /Pylon/);
	assert.equal(calls[0].opts.pdf_options.format, 'A4');
	assert.ok(task);

	const issue = (await issues.createIssue(w.ctx, { subject: 'Wet floor', department: 'Install' })).issue;
	const pdf = await printing.issuePdf(w.ctx, String(issue.ROWID), { layout: 'full' });
	assert.match(pdf.raw.filename, /^issue-/);
	assert.match(calls[1].html, /History/);
	await rejects(printing.issuePdf(w.ctx, String(issue.ROWID), { layout: 'wild' }), 400);

	w.ctx.actor.app = {};
	await rejects(printing.swmsPdf(w.ctx, swmsId), 503);
	w.ctx.actor.app = { smartbrowz: () => ({ convertToPdf: async () => { throw new Error('boom'); } }) };
	await rejects(printing.swmsPdf(w.ctx, swmsId), 502);
	await rejects(printing.swmsPdf(w.as(['viewer']), swmsId), 403);
});

test('the PDF can come back as a stream, as the real SDK does, and is read into one file', async () => {
	const { Readable } = require('node:stream');
	const w = makeWorld();
	w.ctx.actor.app = { smartbrowz: () => ({ convertToPdf: async () => Readable.from([Buffer.from('%PDF-1'), Buffer.from('.4 body')]) }) };
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon' })).job;
	await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'install', name: 'Fit', kind: 'VE Install' });
	const out = await printing.swmsPdf(w.ctx, String(w.db.swms[0].ROWID));
	assert.equal(out.raw.buffer.toString(), '%PDF-1.4 body');
	w.ctx.actor.app = { smartbrowz: () => ({ convertToPdf: async () => 42 }) };
	await rejects(printing.swmsPdf(w.ctx, String(w.db.swms[0].ROWID)), 502);
});
