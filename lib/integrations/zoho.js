'use strict';

const { NotConfigured, safeError } = require('../domain/outbox');

/**
 * Zoho CRM and WorkDrive clients over plain HTTPS (no extra packages).
 * Credentials come only from function environment variables, never from code:
 *   ZOHO_DC (in, com, com.au, eu ...), ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
 *   WORKDRIVE_PARENT_FOLDER_ID (optional, the folder job folders are created in)
 * The access token lasts about an hour and is kept in memory and reused, so a busy period costs one
 * token request, not one per call. Errors never include tokens or secrets.
 */
const TIMEOUT_MS = 15000;
const REFRESH_MARGIN_MS = 60 * 1000;

const hosts = (dc) => ({
	accounts: `https://accounts.zoho.${dc}`,
	crm: `https://www.zohoapis.${dc}/crm/v8`,
	workdrive: `https://workdrive.zoho.${dc}/api/v1`,
});

/** Are all the credentials present? (Says nothing about whether they are valid.) */
function isConfigured(env = process.env) {
	return !!(env.ZOHO_DC && env.ZOHO_CLIENT_ID && env.ZOHO_CLIENT_SECRET && env.ZOHO_REFRESH_TOKEN);
}

function createZoho({ env = process.env, fetchFn = globalThis.fetch, now = () => Date.now() } = {}) {
	if (!isConfigured(env)) return null;
	if (!/^[a-z.]+$/.test(env.ZOHO_DC)) throw new Error('ZOHO_DC must be like in, com, com.au or eu');
	const url = hosts(env.ZOHO_DC);
	let token = null; // { value, expiresAt }

	async function call(fullUrl, init = {}) {
		const ctl = new AbortController();
		const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
		try {
			return await fetchFn(fullUrl, { ...init, signal: ctl.signal });
		} finally {
			clearTimeout(timer);
		}
	}

	async function accessToken(force = false) {
		if (!force && token && token.expiresAt - REFRESH_MARGIN_MS > now()) return token.value;
		const res = await call(`${url.accounts}/oauth/v2/token`, {
			method: 'POST',
			body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: env.ZOHO_REFRESH_TOKEN }),
		});
		const data = await res.json().catch(() => ({}));
		if (!data.access_token) throw new Error(`Zoho refused the credentials (${data.error || res.status}). Check ZOHO_DC and the refresh token.`);
		token = { value: data.access_token, expiresAt: now() + (Number(data.expires_in) || 3600) * 1000 };
		return token.value;
	}

	/** One authorised call; a 401 gets one retry with a fresh token. */
	async function request(base, path, { method = 'GET', body, headers = {} } = {}, retried = false) {
		const res = await call(`${base}${path}`, {
			method,
			headers: { Authorization: `Zoho-oauthtoken ${await accessToken(retried)}`, ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
			body: body ? JSON.stringify(body) : undefined,
		});
		if (res.status === 401 && !retried) return request(base, path, { method, body, headers }, true);
		if (res.status === 204 || res.status === 304) return {}; // nothing (new) to return
		const data = await res.json().catch(() => ({}));
		if (!res.ok) {
			const e = data.errors && data.errors[0];
			const why = (data.data && data.data[0] && data.data[0].message) || data.message || data.code || (e && [e.id, e.title].filter(Boolean).join(' ')) || res.status;
			throw new Error(`Zoho ${method} ${path.split('?')[0]} failed (HTTP ${res.status}): ${why}`);
		}
		return data;
	}

	const crm = {
		/** Cheapest real read: proves the credentials and the CRM data center work. */
		async ping() {
			const data = await request(url.crm, '/Deals?fields=id&per_page=1');
			return { reachable: true, sampleDeals: (data.data || []).length };
		},
		async getDeal(id) {
			const data = await request(url.crm, `/Deals/${encodeURIComponent(id)}`);
			return (data.data && data.data[0]) || null;
		},
		/** Deals changed since a moment in time (ISO text), newest first. Up to 3 pages of 100; empty when nothing changed. */
		async listDealsModifiedSince(sinceIso) {
			const out = [];
			for (let page = 1; page <= 3; page += 1) {
				const data = await request(url.crm, `/Deals?fields=Deal_Name,Stage,Owner,Closing_Date,Description,Modified_Time&sort_by=Modified_Time&sort_order=desc&per_page=100&page=${page}`, { headers: { 'If-Modified-Since': sinceIso } });
				out.push(...(data.data || []));
				if (!(data.info && data.info.more_records)) break;
			}
			return out;
		},
		/** The quotes (with their line items) of one deal; empty when there are none. At most 20. */
		async getQuotesForDeal(dealId) {
			// The deal's own "Quotes" related list. (Searching quotes by their deal did not match; this does.)
			const found = await request(url.crm, `/Deals/${encodeURIComponent(dealId)}/Quotes?fields=id&per_page=20`);
			const ids = (found.data || []).map((q) => q.id).slice(0, 20);
			// The related list leaves out the line items, so read each quote in full.
			const quotes = [];
			for (const id of ids) {
				const one = await request(url.crm, `/Quotes/${encodeURIComponent(id)}`);
				if (one.data && one.data[0]) quotes.push(one.data[0]);
			}
			return quotes;
		},
		/** Set fields on a deal, e.g. { Stage: 'Won' }. Throws if the CRM rejects it. */
		async updateDeal(id, fields) {
			const data = await request(url.crm, `/Deals/${encodeURIComponent(id)}`, { method: 'PUT', body: { data: [fields] } });
			const result = data.data && data.data[0];
			if (result && result.status === 'error') throw new Error(`Zoho CRM rejected the update: ${result.message || result.code}`);
			return result;
		},
	};

	const workdrive = {
		async ping() {
			const data = await request(url.workdrive, '/users/me');
			return { reachable: true, hasUser: !!(data.data && data.data.id) };
		},
		/** Read one folder: proves the folder ID exists and this login may use it. Returns { name, type }. */
		async getFolder(id) {
			const data = await request(url.workdrive, `/files/${encodeURIComponent(id)}`);
			const a = (data.data && data.data.attributes) || {};
			return { name: a.name || null, type: a.type || null, isFolder: a.is_folder === true || a.type === 'folder' };
		},
		/** Create a folder under `parentId`; returns { id, url }. */
		async createFolder(parentId, name) {
			const data = await request(url.workdrive, '/files', {
				method: 'POST',
				body: { data: { attributes: { name: String(name).slice(0, 250), parent_id: parentId }, type: 'files' } },
			});
			const item = data.data;
			return { id: item.id, url: (item.attributes && item.attributes.permalink) || null };
		},
	};

	return { crm, workdrive, parentFolderId: env.WORKDRIVE_PARENT_FOLDER_ID || null };
}

/** Run a ping and turn the outcome into something safe to show an admin. */
async function check(client, which) {
	if (!client) return { configured: false, ok: false, message: 'Credentials are not set on this function.' };
	try {
		await client[which].ping();
		return { configured: true, ok: true, message: 'Connected.' };
	} catch (err) {
		return { configured: true, ok: false, message: safeError(err) };
	}
}

module.exports = { createZoho, isConfigured, check, hosts, NotConfigured };
