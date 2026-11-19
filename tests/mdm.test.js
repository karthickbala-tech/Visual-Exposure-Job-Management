'use strict';

/**
 * ManageEngine MDM device sync (EQP-4): the client (against a fake MDM over fetch), the sync rules, the job, the
 * admin status row and the "In MDM" flag on a person. No real MDM call is made.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld } = require('./helpers');
const { createMdm, isMdmConfigured, latestLocations, mdmTime } = require('../lib/integrations/mdm');
const { planMdmSync, modelOf, osOf } = require('../lib/domain/mdmSync');
const { syncDevices } = require('../lib/services/mdmSync');
const registers = require('../lib/services/registers');
const integrations = require('../lib/services/integrations');
const people = require('../lib/services/people');
const { run } = require('../lib/jobs/registry');

const ENV = { MDM_DC: 'in', ZOHO_CLIENT_ID: 'cid', ZOHO_CLIENT_SECRET: 'sec', MDM_REFRESH_TOKEN: 'rt' };
const T1 = Date.UTC(2026, 10, 19, 1, 30, 0); // 19 Nov 2026 01:30 UTC
const T2 = Date.UTC(2026, 10, 19, 3, 0, 0);

function fakeFetch(routes) {
	const calls = [];
	const fetchFn = async (url, init = {}) => {
		calls.push({ url: String(url), init });
		const u = new URL(String(url));
		const body = routes[u.pathname];
		if (!body) return { ok: false, status: 404, json: async () => ({ error_description: 'not found' }) };
		const value = typeof body === 'function' ? body(u, init) : body;
		return { ok: true, status: 200, json: async () => value };
	};
	return { fetchFn, calls };
}

const phone = (over = {}) => ({ device_id: 111, device_name: 'Karthick-A54', product_name: 'samsung', model: 'SM-A546E', platform_type: 'android', os_version: '14', serial_number: 'R5CW1234', user: { user_name: 'karthick', user_email: 'K.Bala@Example.test' }, ...over });

test('client: signs in through Zoho accounts of the MDM data center, reads devices and last locations', async () => {
	const { fetchFn, calls } = fakeFetch({
		'/oauth/v2/token': { access_token: 'at', expires_in: 3600 },
		'/api/v1/mdm/devices': { devices: [phone()] },
		'/api/mdm/devices/locations': { deviceLocationMap: { 111: [{ latitude: '13.0827', longitude: '80.2707', located_time: String(T1) }, { latitude: 13.1, longitude: 80.3, located_time: T2 }] } },
	});
	const mdm = createMdm({ env: ENV, fetchFn });
	assert.equal(mdm.host, 'https://mdm.manageengine.in');
	assert.equal((await mdm.listDevices()).length, 1);
	const loc = (await mdm.lastLocations()).get('111');
	assert.deepEqual(loc, { lat: 13.1, lng: 80.3, at: new Date(T2) }, 'the newest reading wins');

	assert.match(calls[0].url, /^https:\/\/accounts\.zoho\.in\/oauth\/v2\/token$/);
	assert.match(String(calls[0].init.body), /refresh_token=rt/);
	assert.match(calls[0].init.body.toString(), /client_id=cid/, 'falls back to the ZOHO_ OAuth client');
	assert.equal(calls[1].url, 'https://mdm.manageengine.in/api/v1/mdm/devices?exclude_removed=true');
	assert.equal(calls[1].init.headers.Authorization, 'Zoho-oauthtoken at');
	assert.equal(calls[2].url, 'https://mdm.manageengine.in/api/mdm/devices/locations?last_known=true');
	assert.equal(calls.filter((c) => c.url.includes('/oauth/')).length, 1, 'the token is reused');
});

test('client: not set up without a refresh token; errors carry the MDM reason, never the token', async () => {
	assert.equal(createMdm({ env: { ...ENV, MDM_REFRESH_TOKEN: '' } }), null);
	assert.equal(isMdmConfigured({ ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b' }), false);
	assert.equal(isMdmConfigured({ ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', MDM_REFRESH_TOKEN: 'c' }), true, 'data center and client fall back to ZOHO_');

	const fetchFn = async (url) => (String(url).includes('/oauth/') ? { ok: true, status: 200, json: async () => ({ access_token: 'at' }) } : { ok: false, status: 403, json: async () => ({ error_code: 'COM0013', error_description: 'Scope does not match' }) });
	const err = await createMdm({ env: ENV, fetchFn }).listDevices().catch((e) => e);
	assert.match(err.message, /ManageEngine MDM GET \/api\/v1\/mdm\/devices failed \(HTTP 403\): Scope does not match/);
	assert.ok(!/rt|sec/.test(err.message));
});

test('locations: bad, zero or missing coordinates are ignored; the map may be nested; times in ms or text', () => {
	const m = latestLocations({ data: { deviceLocationMap: { 1: [{ latitude: 0, longitude: 0, located_time: T2 }, { latitude: 'x', longitude: 2 }], 2: [{ latitude: -37.81, longitude: 144.96, located_time: -1 }] } } });
	assert.equal(m.has('1'), false);
	assert.deepEqual(m.get('2'), { lat: -37.81, lng: 144.96, at: null });
	assert.equal(mdmTime('2026-11-19T03:00:00Z').getTime(), T2);
	assert.equal(mdmTime(''), null);
});

test('device names: brand plus model, platform plus version', () => {
	assert.equal(modelOf(phone()), 'samsung SM-A546E');
	assert.equal(modelOf({ product_name: 'Apple', model: 'Apple iPhone 13' }), 'Apple iPhone 13');
	assert.equal(osOf(phone()), 'Android 14');
	assert.equal(osOf({ platform_type: 'ios', os_version: '17.4' }), 'iOS 17.4');
});

test('plan: only people in the app with In MDM ticked; one row per serial; reasons for the rest', () => {
	const ppl = [
		{ ROWID: '10', email: 'k.bala@example.test', mdm_enabled: 'true' },
		{ ROWID: '11', email: 'off@example.test', mdm_enabled: 'false' },
	];
	const devices = [
		phone(),
		phone({ device_id: 112, serial_number: 'R5CW1234' }), // same serial twice
		phone({ device_id: 113, serial_number: 'S2', user: { user_email: 'off@example.test' } }),
		phone({ device_id: 114, serial_number: 'S3', user: { user_email: 'stranger@example.test' } }),
		phone({ device_id: 115, serial_number: '', udid: '' }),
		phone({ device_id: 116, serial_number: 'S4', user: null }),
	];
	const plan = planMdmSync({ devices, locations: new Map([['111', { lat: 13.08, lng: 80.27, at: new Date(T1) }]]), people: ppl, existing: [] });
	assert.equal(plan.inserts.length, 1);
	assert.deepEqual(plan.inserts[0], { serial_number: 'R5CW1234', model: 'samsung SM-A546E', os_name: 'Android 14', person_id: '10', last_lat: 13.08, last_lng: 80.27, last_seen_at: '2026-11-19 01:30:00' });
	assert.deepEqual(
		{ dup: plan.counts.duplicate, notInMdm: plan.counts.notInMdm, notInApp: plan.counts.notInApp, noSerial: plan.counts.noSerial, noUser: plan.counts.noUser },
		{ dup: 1, notInMdm: 1, notInApp: 1, noSerial: 1, noUser: 1 }
	);
	assert.deepEqual(plan.skippedUsers, ['off@example.test', 'stranger@example.test']);
});

function world() {
	const w = makeWorld();
	w.db.people.push({ ROWID: '10', first_name: 'Karthick', last_name: 'Bala', email: 'k.bala@example.test', mdm_enabled: 'true' });
	let locs = new Map([['111', { lat: 13.0827, lng: 80.2707, at: new Date(T1) }]]);
	let devs = [phone()];
	const mdm = { listDevices: async () => devs, lastLocations: async () => locs, ping: async () => ({ reachable: true }) };
	return { w, mdm, setLocations: (m) => (locs = m), setDevices: (d) => (devs = d) };
}

test('sync: adds the device for the person, shows it on the Devices list, and a second run writes nothing', async () => {
	const { w, mdm } = world();
	const out = await syncDevices({ ...w.ctx, mdm });
	assert.equal(out.ran, true);
	assert.equal(out.added, 1);
	assert.equal(out.located, 1);
	const list = (await registers.listDevices(w.ctx)).items;
	assert.equal(list.length, 1);
	assert.equal(list[0].personName, 'Karthick Bala');
	assert.equal(list[0].model, 'samsung SM-A546E');
	assert.equal(list[0].lat, 13.0827);

	const before = JSON.stringify(w.db.devices);
	const again = await syncDevices({ ...w.ctx, mdm });
	assert.deepEqual({ added: again.added, updated: again.updated, unchanged: again.unchanged }, { added: 0, updated: 0, unchanged: 1 });
	assert.equal(JSON.stringify(w.db.devices), before);
});

test('sync: a newer location moves the pin and clears the old address; an older one never moves it back', async () => {
	const { w, mdm, setLocations } = world();
	await syncDevices({ ...w.ctx, mdm });
	w.db.devices[0].last_address = 'Old street';

	setLocations(new Map([['111', { lat: 13.2, lng: 80.4, at: new Date(T2) }]]));
	assert.equal((await syncDevices({ ...w.ctx, mdm })).updated, 1);
	assert.equal(w.db.devices[0].last_lat, 13.2);
	assert.equal(w.db.devices[0].last_seen_at, '2026-11-19 03:00:00');
	assert.equal(w.db.devices[0].last_address, '');

	setLocations(new Map([['111', { lat: 1, lng: 1, at: new Date(T1) }]]));
	await syncDevices({ ...w.ctx, mdm });
	assert.equal(w.db.devices[0].last_lat, 13.2, 'an older reading is ignored');

	setLocations(new Map());
	await syncDevices({ ...w.ctx, mdm });
	assert.equal(w.db.devices[0].last_lat, 13.2, 'no location from MDM keeps the last known one');
});

test('sync: administrators only; says so when MDM is not set up or cannot be read', async () => {
	const { w, mdm } = world();
	const pm = w.as(['project_manager']);
	await assert.rejects(syncDevices({ ...pm, mdm }), (e) => e.status === 403);
	assert.match((await syncDevices({ ...w.ctx, mdm: null })).reason, /not set up/);
	const broken = { listDevices: async () => { throw new Error('ManageEngine MDM GET /api/v1/mdm/devices failed (HTTP 401): invalid token'); }, lastLocations: async () => new Map() };
	const out = await syncDevices({ ...w.ctx, mdm: broken });
	assert.equal(out.ran, false);
	assert.match(out.reason, /Could not read from MDM: .*HTTP 401/);
	assert.equal(w.db.devices.length, 0);
});

test('job: mdm-sync is skipped without MDM and runs as the system with it', async () => {
	const { w, mdm } = world();
	const logged = [];
	const log = { info: (m, d) => logged.push([m, d]), warn: () => {}, error: () => {} };
	const system = { ...w.as(['admin'], null), log };
	assert.deepEqual(await run('mdm-sync', {}, { log, mdm: null, systemCtx: system }), { ran: true });
	assert.ok(logged.some(([m]) => /mdm-sync skipped/.test(m)));
	assert.deepEqual(await run('mdm-sync', {}, { log, mdm, systemCtx: system }), { ran: true });
	assert.equal(logged.find(([m]) => m === 'mdm devices synced')[1].added, 1);
	assert.equal(w.db.devices.length, 1);
});

test('admin status: an MDM row next to CRM and WorkDrive', async () => {
	const { w, mdm } = world();
	const off = await integrations.status({ ...w.ctx, zoho: null, mdm: null });
	assert.deepEqual({ configured: off.mdm.configured, ok: off.mdm.ok }, { configured: false, ok: false });
	const on = await integrations.status({ ...w.ctx, zoho: null, mdm });
	assert.deepEqual(on.mdm, { configured: true, ok: true, message: 'Connected.' });
});

test('person: "In MDM" can be ticked and is stored as Catalyst expects', async () => {
	const w = makeWorld();
	const made = await people.createPerson(w.ctx, { first_name: 'Karthick', email: 'k.bala@example.test', mdm_enabled: true });
	const id = String(made.person.ROWID);
	assert.equal(w.db.people.find((p) => String(p.ROWID) === id).mdm_enabled, 'true');
	const after = await people.updatePerson(w.ctx, id, { mdm_enabled: false });
	assert.equal(after.person.mdm_enabled, false);
});
