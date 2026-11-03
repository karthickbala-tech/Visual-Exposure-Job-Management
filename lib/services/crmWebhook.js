'use strict';

const { AppError } = require('../errors');
const { z, parse } = require('../validate');
const { tokenMatches } = require('../domain/outbox');
const jobsService = require('./jobs');

/**
 * A CRM webhook sends dates in the account's own format. A clean YYYY-MM-DD (or a datetime starting with one) is used;
 * anything else is ignored rather than refusing the whole deal, because the date is optional.
 */
function toIsoDate(v) {
	if (typeof v !== 'string') return undefined;
	const t = v.trim();
	if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10); // 2026-11-04 or a datetime starting with it
	const us = t.match(/^(\d{2})-(\d{2})-(\d{4})$/); // the CRM's "mm-dd-yyyy" webhook date format
	if (us && Number(us[1]) >= 1 && Number(us[1]) <= 12 && Number(us[2]) >= 1 && Number(us[2]) <= 31) return `${us[3]}-${us[1]}-${us[2]}`;
	return undefined;
}
const date = z.preprocess(toIsoDate, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());
/**
 * What the CRM sends when a deal is won. Field names are an ASSUMPTION until the real CRM webhook is
 * configured: only deal_id and deal_name are required; everything else is optional.
 */
const dealInput = z.object({
	deal_id: z.string().trim().min(1).max(50),
	deal_name: z.string().trim().min(1).max(200),
	owner_email: z.string().trim().toLowerCase().email().optional(),
	description: z.string().max(9000).optional(),
	quote_ref: z.string().max(255).optional(),
	expected_finish: date,
});

/**
 * Check the caller is the CRM: a shared secret in the `x-webhook-token` header. With no secret
 * configured the endpoint is off (503), never open.
 */
/**
 * Where the CRM put the secret: the `x-webhook-token` header (preferred), or a parameter of the same name (or `token`)
 * in the form or JSON body, because Zoho's "Custom Parameters" are sent as form fields, not headers.
 * Returns { token, body } with the secret removed from the body so it is never treated as deal data.
 */
function extractToken(headers, body) {
	const { 'x-webhook-token': inBody, token: alt, ...rest } = body || {};
	const fromHeader = headers && headers['x-webhook-token'];
	return { token: fromHeader || inBody || alt, body: rest };
}

function authenticate(secret, headers) {
	if (!secret) throw new AppError(503, 'webhook_disabled', 'This webhook is not configured');
	if (!tokenMatches(secret, headers['x-webhook-token'])) throw new AppError(401, 'unauthenticated', 'Invalid webhook token');
}

/**
 * A won deal becomes a job in Preparation (WORKFLOWS: a job is only created from a CRM deal).
 * Receiving the same deal twice is harmless: the second call finds the job and returns it.
 * `ctx` must carry a system actor with the admin role (there is no signed-in user here).
 */
async function dealWon(ctx, raw) {
	const deal = parse(dealInput, raw);

	const existing = await ctx.repos.jobs.findByDealId(deal.deal_id);
	if (existing) return { created: false, jobId: String(existing.ROWID) };

	// The deal owner becomes the project manager when we know their email.
	let pmId;
	if (deal.owner_email) {
		const owner = await ctx.repos.people.findByEmail(deal.owner_email);
		if (owner) pmId = owner.ROWID;
	}

	const { job } = await jobsService.createJob(ctx, {
		name: deal.deal_name,
		crm_deal_id: deal.deal_id,
		description: deal.description,
		quote_ref: deal.quote_ref,
		expected_finish: deal.expected_finish,
		pm_id: pmId ? String(pmId) : undefined,
	});
	return { created: true, jobId: String(job.ROWID) };
}

module.exports = { authenticate, extractToken, dealWon, dealInput };
