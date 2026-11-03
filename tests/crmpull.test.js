'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const { pullWonDeals, KEY } = require('../lib/services/crmPull');
const { createZoho } = require('../lib/integrations/zoho');

const deal = (over = {}) => ({ id: '1482987000000548225', Deal_Name: 'Benton', Stage: 'Closed Won', Closing_Date: '2026-11-04', Description: 'Pylon', Owner: { name: 'K', email: 'boss@example.test' }, Modified_Time: '2026-11-03T10:00:00+05:30', ...over });
const withZoho = (w, list, seen = []) => ({ ...w.ctx, log: { info() {}, warn(m, d) { seen.push([m, d]); }, error() {} }, zoho: { crm: { listDealsModifiedSince: async (since) => (seen.push(['since', since]), list) } } });

test('only Closed Won deals become jobs, with the owner as project manager; a rerun makes nothing new', async () => {
	const w = makeWorld();
	w.db.people.push({ ROWID: '105747000000900009', first_name: 'Boss', last_name: 'One', email: 'boss@example.test' });
	const list = [deal(), deal({ id: '2', Deal_Name: 'Still negotiating', Stage: 'Negotiation/Review' }), deal({ id: '3', Deal_Name: 'Second win' })];
	const first = await pullWonDeals(withZoho(w, list));
	assert.equal(first.changedDeals, 3);
	assert.equal(first.wonDeals, 2);
	assert.equal(first.created, 2);
	assert.equal(w.db.jobs.length, 2);
	const benton = w.db.jobs.find((j) => j.name === 'Benton');
	assert.equal(benton.crm_deal_id, '1482987000000548225');
	assert.equal(String(benton.pm_id), '105747000000900009', 'the deal owner became the project manager');
	assert.equal(benton.expected_finish, '2026-11-04');
	assert.equal(benton.stage, 'Preparation');

	const again = await pullWonDeals(withZoho(w, list));
	assert.equal(again.created, 0);
	assert.equal(again.alreadyHadJob, 2);
	assert.equal(w.db.jobs.length, 2);
});

test('the time of the last run is remembered, and the first run only looks back one day', async () => {
	const w = makeWorld();
	const seen = [];
	await pullWonDeals(withZoho(w, [], seen));
	const firstSince = seen.find((s) => s[0] === 'since')[1];
	const CLOCK = Date.parse('2026-11-02T10:00:00Z'); // the fixed test clock
	assert.equal(Date.parse(firstSince), CLOCK - 24 * 3600 * 1000, 'one day before now');
	const saved = JSON.parse(w.db.settings.find((s) => s.setting_key === KEY).setting_value).since;
	assert.equal(Date.parse(saved), CLOCK - 2 * 60 * 1000, 'saved with a two minute overlap');

	const seen2 = [];
	await pullWonDeals(withZoho(w, [], seen2));
	assert.equal(seen2.find((s) => s[0] === 'since')[1], saved, 'the next run asks only about newer changes');
	assert.equal(w.db.settings.filter((s) => s.setting_key === KEY).length, 1, 'one setting row, updated');
});

test('a bad deal is skipped and logged; the others still arrive; an invalid owner email does not matter', async () => {
	const w = makeWorld();
	const seen = [];
	const out = await pullWonDeals(withZoho(w, [deal({ id: '7', Deal_Name: 'Good', Owner: { email: 'not-an-email' } }), deal({ id: '8', Deal_Name: '' }), deal({ id: '9', Deal_Name: 'Fine' })], seen));
	assert.equal(out.wonDeals, 2, 'a deal with no name is ignored');
	assert.equal(out.created + out.failed, 2);
	assert.ok(w.db.jobs.some((j) => j.name === 'Fine'));
});

test('not connected: nothing happens and nothing is saved; non-admins are refused', async () => {
	const w = makeWorld();
	const off = await pullWonDeals({ ...w.ctx, zoho: null });
	assert.equal(off.ran, false);
	assert.equal(w.db.settings.length, 0);
	await rejects(pullWonDeals({ ...w.as(['project_manager']), zoho: { crm: {} } }), 403);
});

test('the CRM client asks for deals changed since a moment, sending If-Modified-Since, and treats 304 as nothing new', async () => {
	const calls = [];
	const fetchFn = async (url, init = {}) => {
		const u = String(url);
		calls.push({ u, ims: init.headers && init.headers['If-Modified-Since'] });
		if (u.includes('/oauth/v2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'T', expires_in: 3600 }) };
		return { ok: false, status: 304, json: async () => ({}) };
	};
	const z = createZoho({ env: { ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c' }, fetchFn });
	assert.deepEqual(await z.crm.listDealsModifiedSince('2026-11-03T00:00:00.000Z'), []);
	const dealCall = calls.find((c) => c.u.includes('/crm/v8/Deals?'));
	assert.equal(dealCall.ims, '2026-11-03T00:00:00.000Z');
	assert.match(dealCall.u, /sort_by=Modified_Time/);
});
