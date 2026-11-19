'use strict';

const { createSession, check } = require('./zoho');

/**
 * ManageEngine MDM (cloud) client: read-only, two calls per sync. MDM Cloud signs in through Zoho accounts, so it uses
 * the same OAuth code as the CRM and WorkDrive (lib/integrations/zoho.js), with its own refresh token because the MDM
 * account can be a different Zoho account from the CRM one (for the POC: our own MDM trial).
 *
 * Settings (function environment variables, never in code):
 *   MDM_REFRESH_TOKEN  required; a refresh token made with the scope MDMOnDemand.MDMInventory.READ
 *   MDM_DC             data center of the MDM account: in (mdm.manageengine.in), com, eu, com.au ... (default ZOHO_DC)
 *   MDM_CLIENT_ID, MDM_CLIENT_SECRET  the OAuth client that made the token (default the ZOHO_ ones)
 *
 * API (https://www.manageengine.com/mobile-device-management/api/devices/):
 *   GET /api/v1/mdm/devices?exclude_removed=true   { devices: [{ device_id, device_name, model, product_name,
 *       platform_type, os_version, serial_number, udid, user: { user_name, user_email } }] }
 *   GET /api/mdm/devices/locations?last_known=true  { deviceLocationMap: { <device_id>: [{ latitude, longitude,
 *       located_time, added_time }] } }   (note: no /v1 in this path)
 */
const settings = (env) => ({
	dc: env.MDM_DC || env.ZOHO_DC,
	clientId: env.MDM_CLIENT_ID || env.ZOHO_CLIENT_ID,
	clientSecret: env.MDM_CLIENT_SECRET || env.ZOHO_CLIENT_SECRET,
	refreshToken: env.MDM_REFRESH_TOKEN,
});

/** Are all the MDM settings present? (Says nothing about whether they work.) */
function isMdmConfigured(env = process.env) {
	const s = settings(env);
	return !!(s.dc && s.clientId && s.clientSecret && s.refreshToken);
}

const mdmHost = (dc) => `https://mdm.manageengine.${dc}`;

/** A time from MDM (milliseconds as a number or text, or a date text) as a Date; null when there is none. */
function mdmTime(v) {
	if (v === null || v === undefined || v === '' || v === -1 || v === '-1') return null;
	const n = Number(v);
	const d = Number.isFinite(n) && String(v).trim() !== '' ? new Date(n) : new Date(String(v));
	return Number.isNaN(d.getTime()) || d.getTime() <= 0 ? null : d;
}

/** The location map, wherever MDM nests it ({ deviceLocationMap } at the top or one level down). */
function locationMapOf(data) {
	if (!data || typeof data !== 'object') return {};
	if (data.deviceLocationMap && typeof data.deviceLocationMap === 'object') return data.deviceLocationMap;
	for (const v of Object.values(data)) if (v && typeof v === 'object' && v.deviceLocationMap) return v.deviceLocationMap;
	return {};
}

/** device_id -> { lat, lng, at (Date or null) }: the newest entry with real coordinates for each device. */
function latestLocations(data) {
	const out = new Map();
	for (const [id, entries] of Object.entries(locationMapOf(data))) {
		let best = null;
		for (const e of Array.isArray(entries) ? entries : [entries]) {
			const lat = Number(e && e.latitude);
			const lng = Number(e && e.longitude);
			if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
			const at = mdmTime(e.located_time) || mdmTime(e.added_time);
			if (!best || (at && (!best.at || at > best.at))) best = { lat, lng, at };
		}
		if (best) out.set(String(id), best);
	}
	return out;
}

function createMdm({ env = process.env, fetchFn = globalThis.fetch, now = () => Date.now() } = {}) {
	if (!isMdmConfigured(env)) return null;
	const s = settings(env);
	const session = createSession({ ...s, fetchFn, now, label: 'ManageEngine MDM' });
	const base = mdmHost(s.dc);
	return {
		host: base,
		/** Cheapest real read: proves the token, its scope and the data center. */
		async ping() {
			const data = await session.request(base, '/api/v1/mdm/devices?exclude_removed=true');
			return { reachable: true, devices: (data.devices || []).length };
		},
		/** Managed devices that are not removed. */
		async listDevices() {
			const data = await session.request(base, '/api/v1/mdm/devices?exclude_removed=true');
			return Array.isArray(data.devices) ? data.devices : [];
		},
		/** The last known location of every managed device, in one call: Map of device_id -> { lat, lng, at }. */
		async lastLocations() {
			return latestLocations(await session.request(base, '/api/mdm/devices/locations?last_known=true'));
		},
	};
}

/** The admin status row for MDM ("Connected" or a short reason; never a secret). */
async function checkMdm(client) {
	return check(client ? { mdm: client } : null, 'mdm');
}

module.exports = { createMdm, isMdmConfigured, checkMdm, mdmHost, mdmTime, latestLocations };
