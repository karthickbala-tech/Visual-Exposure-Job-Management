'use strict';

const { forbidden } = require('../errors');
const { dealWon } = require('./crmWebhook');

const KEY = 'crm.won_since';
const FIRST_RUN_LOOKBACK_MS = 24 * 3600 * 1000; // the first run only looks at the last day, so an old CRM does not flood the app
const OVERLAP_MS = 2 * 60 * 1000; // re-check the last two minutes each time, so a deal changed during a run is never missed
const WON = 'Closed Won';

const parseSince = (row) => {
	try {
		const v = row && row.setting_value ? JSON.parse(row.setting_value).since : null;
		return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
	} catch {
		return null;
	}
};

/**
 * Ask the CRM for deals changed since the last run, and make a job for each one that is Closed Won. This does the same
 * job as the CRM webhook but needs nothing set up inside the CRM. Safe to repeat: a deal that already has a job is skipped.
 * ctx: { actor (admin), repos, zoho, now, log, publish }
 */
async function pullWonDeals(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can pull deals from the CRM');
	if (!ctx.zoho || !ctx.zoho.crm) return { ran: false, reason: 'Zoho CRM is not connected' };

	const started = ctx.now();
	const row = await ctx.repos.settings.findByKey(KEY);
	const since = parseSince(row) || new Date(started.getTime() - FIRST_RUN_LOOKBACK_MS).toISOString();

	const deals = await ctx.zoho.crm.listDealsModifiedSince(since);
	const won = deals.filter((d) => d.Stage === WON && d.Deal_Name);
	const result = { ran: true, since, changedDeals: deals.length, wonDeals: won.length, created: 0, alreadyHadJob: 0, failed: 0 };

	for (const d of won) {
		try {
			const r = await dealWon(ctx, {
				deal_id: String(d.id),
				deal_name: String(d.Deal_Name).slice(0, 200),
				owner_email: d.Owner && d.Owner.email ? String(d.Owner.email).toLowerCase() : undefined,
				description: d.Description ? String(d.Description).slice(0, 9000) : undefined,
				expected_finish: d.Closing_Date || undefined,
			});
			if (r.created) result.created += 1;
			else result.alreadyHadJob += 1;
		} catch (err) {
			result.failed += 1; // one bad deal never stops the rest
			ctx.log.warn('could not make a job from a CRM deal', { dealId: String(d.id), error: err.message });
		}
	}

	// Remember where we got to, even when nothing was won, so the next run only asks about newer changes.
	const next = JSON.stringify({ since: new Date(started.getTime() - OVERLAP_MS).toISOString() });
	if (row) await ctx.repos.settings.update({ ROWID: row.ROWID, setting_value: next });
	else await ctx.repos.settings.insert({ setting_key: KEY, setting_value: next, description: 'Last time won deals were pulled from the CRM' });
	return result;
}

module.exports = { pullWonDeals, KEY };
