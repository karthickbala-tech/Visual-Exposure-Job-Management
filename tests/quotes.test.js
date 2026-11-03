'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const { normaliseQuote, toSignGroupRow, fitItems, sameAsStored } = require('../lib/domain/quotes');
const quotes = require('../lib/services/quotes');
const jobs = require('../lib/services/jobs');
const { createZoho } = require('../lib/integrations/zoho');

// A quote shaped like Zoho CRM v8 returns it.
const crmQuote = (over = {}) => ({
	id: '1482987000000600001',
	Quote_Number: '1001',
	Subject: 'Pylon refresh',
	Quote_Stage: 'Delivered',
	Valid_Till: '2026-12-31',
	Sub_Total: 1000,
	Discount: 100,
	Tax: 90,
	Adjustment: 0,
	Grand_Total: 990,
	Quoted_Items: [
		{ Product_Name: { name: 'Pylon sign', id: '1' }, Quantity: 2, List_Price: 400, Discount: 100, Net_Total: 700, Description: 'Double sided' },
		{ Product_Name: { name: 'Install' }, Quantity: 1, List_Price: 200, Total: 200 },
	],
	...over,
});

test('a CRM quote is normalised: product names, numbers, totals; missing parts do not break it', () => {
	const q = normaliseQuote(crmQuote());
	assert.equal(q.crmQuoteId, '1482987000000600001');
	assert.equal(q.number, '1001');
	assert.deepEqual(q.items[0], { product: 'Pylon sign', description: 'Double sided', qty: 2, unitPrice: 400, discount: 100, total: 700 });
	assert.equal(q.items[1].total, 200, 'falls back to Total when there is no Net_Total');
	assert.equal(q.totals.grandTotal, 990);
	const bare = normaliseQuote({ id: 5 });
	assert.deepEqual(bare.items, []);
	assert.equal(bare.totals.grandTotal, 0);
});

test('the sign group row keeps the CRM quote id and stays inside the column limit', () => {
	const row = toSignGroupRow('77', normaliseQuote(crmQuote()));
	assert.equal(row.job_id, '77');
	assert.equal(row.name, '#1001 Pylon refresh');
	assert.equal(row.legacy_id, 'crm:1482987000000600001');
	assert.equal(row.legacy_id.length <= 30, true, 'fits the legacy_id column');
	assert.equal(row.grand_total, 990);
	assert.equal(JSON.parse(row.line_items).items.length, 2);
	const many = Array.from({ length: 200 }, (_, i) => ({ product: 'P' + i, description: 'x'.repeat(300), qty: 1, unitPrice: 1, discount: 0, total: 1 }));
	const fit = fitItems(many);
	assert.ok(JSON.stringify(fit.items).length <= 9000 - 400);
	assert.equal(fit.truncated, true);
	const big = toSignGroupRow('1', { ...normaliseQuote(crmQuote()), items: many });
	assert.equal(JSON.parse(big.line_items).truncated, true);
	assert.ok(big.line_items.length <= 10000, 'fits the column');
	assert.equal(sameAsStored(row, { ...row }), true);
	assert.equal(sameAsStored(row, { ...row, name: 'other' }), false);
});

async function jobFromDeal(w, dealId = '1482987000000548231') {
	const { job } = await jobs.createJob(w.ctx, { name: 'Morlong Associates', crm_deal_id: dealId });
	return String(job.ROWID);
}
const fakeZoho = (list) => ({ crm: { getQuotesForDeal: async () => list } });

test('sync: new quotes become sign groups; a rerun changes nothing; a changed quote updates in place', async () => {
	const w = makeWorld();
	const jobId = await jobFromDeal(w);
	const first = await quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([crmQuote()]) }, jobId);
	assert.deepEqual(first, { found: 1, created: 1, updated: 0, unchanged: 0 });
	const again = await quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([crmQuote()]) }, jobId);
	assert.deepEqual(again, { found: 1, created: 0, updated: 0, unchanged: 1 });
	assert.equal(w.db.signGroups.length, 1);

	const changed = crmQuote({ Grand_Total: 1200, Quote_Stage: 'Accepted' });
	const third = await quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([changed, crmQuote({ id: '1482987000000600002', Quote_Number: '1002', Subject: 'Extra' })]) }, jobId);
	assert.deepEqual(third, { found: 2, created: 1, updated: 1, unchanged: 0 });
	assert.equal(w.db.signGroups.length, 2);

	const list = await quotes.listSignGroups(w.ctx, jobId);
	assert.equal(list.items.length, 2);
	const first1 = list.items.find((g) => g.crmQuoteId === '1482987000000600001');
	assert.equal(first1.totals.grandTotal, 1200);
	assert.equal(first1.stage, 'Accepted');
	assert.equal(first1.items.length, 2);
});

test('sync: refused for a job without a CRM deal, when Zoho is not connected, for crew, and for an unknown job', async () => {
	const w = makeWorld();
	const manual = String((await jobs.createJob(w.ctx, { name: 'Manual job' })).job.ROWID);
	await rejects(quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([]) }, manual), 400);
	const dealJob = await jobFromDeal(w);
	await rejects(quotes.syncJobQuotes({ ...w.ctx, zoho: null }, dealJob), 503, 'not_configured');
	await rejects(quotes.syncJobQuotes({ ...w.as(['installer']), zoho: fakeZoho([]) }, dealJob), 403);
	await rejects(quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([]) }, '105747000009999999'), 404);
	const none = await quotes.syncJobQuotes({ ...w.ctx, zoho: fakeZoho([]) }, dealJob);
	assert.deepEqual(none, { found: 0, created: 0, updated: 0, unchanged: 0 });
});

test('the CRM client reads a deal\'s quotes from its related list, then each one in full', async () => {
	const calls = [];
	const fetchFn = async (url, init = {}) => {
		const u = String(url);
		calls.push(u);
		const ok = (body) => ({ ok: true, status: 200, json: async () => body });
		if (u.includes('/oauth/v2/token')) return ok({ access_token: 'T', expires_in: 3600 });
		if (u.includes('/Deals/555/Quotes')) return ok({ data: [{ id: 'q1' }, { id: 'q2' }] });
		if (u.includes('/Quotes/q1')) return ok({ data: [crmQuote({ id: 'q1' })] });
		if (u.includes('/Quotes/q2')) return ok({ data: [crmQuote({ id: 'q2' })] });
		return { ok: false, status: 404, json: async () => ({}) };
	};
	const z = createZoho({ env: { ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c' }, fetchFn });
	const list = await z.crm.getQuotesForDeal('555');
	assert.deepEqual(list.map((q) => q.id), ['q1', 'q2']);
	assert.ok(calls.some((u) => u.includes('/crm/v8/Deals/555/Quotes')));
});

test('contract: a sign group row only uses columns that exist in the real sign_group table', () => {
	// Copied from the live Development table (read through the Catalyst API on 3 Nov 2026). Update it if the table changes.
	const REAL_COLUMNS = ['name', 'description', 'line_items', 'sub_total', 'total_cost', 'profit_margin', 'tax', 'grand_total', 'legacy_id', 'job_id', 'site_id'];
	const row = toSignGroupRow('77', normaliseQuote(crmQuote()));
	for (const key of Object.keys(row)) assert.ok(REAL_COLUMNS.includes(key), `sign_group has no column "${key}"`);
	assert.ok(row.name.length <= 200 && row.legacy_id.length <= 30);
	assert.ok(row.description.length <= 10000 && row.line_items.length <= 10000);
});
