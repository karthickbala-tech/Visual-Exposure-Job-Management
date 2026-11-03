'use strict';

const { AppError, notFound, badRequest } = require('../errors');
const { parse, schemas } = require('../validate');
const { normaliseQuote, toSignGroupRow, sameAsStored } = require('../domain/quotes');
const { requireGrant } = require('./access');

const rowId = schemas.rowId;
const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

function present(g) {
	const totals = parseJson(g.totals, {});
	return {
		id: String(g.ROWID),
		name: g.name,
		description: g.description || '',
		crmQuoteId: totals.crm_quote_id || null,
		stage: totals.stage || '',
		truncated: totals.truncated === true,
		totals: { subTotal: totals.subTotal || 0, discount: totals.discount || 0, tax: totals.tax || 0, adjustment: totals.adjustment || 0, grandTotal: totals.grandTotal || 0 },
		items: parseJson(g.line_items, []),
	};
}

/** The priced groups on a job (from CRM quotes). */
async function listSignGroups(ctx, jobId) {
	requireGrant(ctx.actor, 'signs', 'view');
	parse(rowId, jobId);
	if (!(await ctx.repos.jobs.findById(jobId))) throw notFound('Job not found');
	const rows = await ctx.repos.signGroups.listByJob(jobId);
	return { items: rows.map(present) };
}

/**
 * Pull the quotes linked to this job's CRM deal and save them as sign groups. Safe to repeat: a quote already saved is
 * updated only if it changed, never duplicated. Needs the Zoho settings; otherwise 503 with a clear message.
 */
async function syncJobQuotes(ctx, jobId) {
	requireGrant(ctx.actor, 'signs', 'create');
	parse(rowId, jobId);
	const job = await ctx.repos.jobs.findById(jobId);
	if (!job) throw notFound('Job not found');
	if (!job.crm_deal_id) throw badRequest('This job did not come from a CRM deal, so there are no quotes to pull.');
	if (!ctx.zoho || !ctx.zoho.crm) throw new AppError(503, 'not_configured', 'Zoho CRM is not connected (see Admin, Integrations).');

	const quotes = (await ctx.zoho.crm.getQuotesForDeal(job.crm_deal_id)).map(normaliseQuote);
	const existing = await ctx.repos.signGroups.listByJob(jobId);
	const byQuote = new Map(existing.map((g) => [parseJson(g.totals, {}).crm_quote_id, g]));

	const toInsert = [];
	const toUpdate = [];
	let unchanged = 0;
	for (const q of quotes) {
		const row = toSignGroupRow(String(job.ROWID), q);
		const stored = byQuote.get(q.crmQuoteId);
		if (!stored) toInsert.push(row);
		else if (sameAsStored(stored, row)) unchanged += 1;
		else toUpdate.push({ ROWID: stored.ROWID, name: row.name, description: row.description, line_items: row.line_items, totals: row.totals });
	}
	// One call for all new groups and one for all changed groups.
	await ctx.repos.signGroups.insertMany(toInsert);
	if (toUpdate.length) await ctx.repos.signGroups.update(toUpdate);
	return { found: quotes.length, created: toInsert.length, updated: toUpdate.length, unchanged };
}

module.exports = { listSignGroups, syncJobQuotes };
