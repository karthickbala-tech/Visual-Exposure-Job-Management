'use strict';

const { AppError } = require('./errors');

/** Send a JSON response. */
function sendJson(res, status, body) {
	const text = JSON.stringify(body);
	res.writeHead(status, {
		'Content-Type': 'application/json; charset=utf-8',
		'Cache-Control': 'no-store',
	});
	res.end(text);
}

/** Success envelope: { success: true, data }. */
function ok(res, status, data) {
	return sendJson(res, status, { success: true, data });
}

/**
 * Convert any thrown value into the error envelope { success: false, error }.
 * Never leaks stack traces; logs unexpected errors through `log`.
 */
function sendError(res, err, log) {
	if (err instanceof AppError) {
		return sendJson(res, err.status, {
			success: false,
			error: { code: err.code, message: err.message, details: err.details },
		});
	}
	if (log) log.error('Unhandled error', err);
	else console.error('Unhandled error:', err && err.stack ? err.stack : err);
	return sendJson(res, 500, {
		success: false,
		error: { code: 'internal', message: 'Something went wrong' },
	});
}

/** Read and parse a JSON body (max 1 MB). Returns {} for an empty body. */
function readJson(req, maxBytes = 1024 * 1024) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (c) => {
			size += c.length;
			if (size > maxBytes) {
				reject(new AppError(413, 'too_large', 'Request body too large'));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on('end', () => {
			if (chunks.length === 0) return resolve({});
			try {
				resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
			} catch (e) {
				reject(new AppError(400, 'bad_json', 'Body is not valid JSON'));
			}
		});
		req.on('error', reject);
	});
}

/**
 * Interpret a request body that may be JSON or form-encoded (key=value&key=value), plus values in the address.
 * Zoho CRM webhooks can send any of these. Body values win over address values. Pure and exported for tests.
 */
function parseLooseBody(raw, contentType = '', url = '') {
	const text = String(raw || '').trim();
	const fromUrl = Object.fromEntries(new URLSearchParams(String(url).split('?')[1] || ''));
	let body = {};
	if (text) {
		const looksJson = /json/i.test(contentType) || text.startsWith('{');
		if (looksJson) {
			try {
				body = JSON.parse(text);
			} catch (e) {
				throw new AppError(400, 'bad_json', 'Body is not valid JSON');
			}
		} else {
			body = Object.fromEntries(new URLSearchParams(text));
		}
	}
	return { ...fromUrl, ...(body && typeof body === 'object' && !Array.isArray(body) ? body : {}) };
}

/** Read a JSON or form-encoded body (max 1 MB) merged with any values in the address. */
function readLooseBody(req, maxBytes = 1024 * 1024) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on('data', (c) => {
			size += c.length;
			if (size > maxBytes) {
				reject(new AppError(413, 'too_large', 'Request body too large'));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on('end', () => {
			try {
				req.bodyBytesRead = size;
				let text = Buffer.concat(chunks).toString('utf8');
				// If the platform already read the stream, use the body it kept.
				if (!text && req.body !== undefined && req.body !== null) text = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : new URLSearchParams(Object.entries(req.body).filter(([, v]) => typeof v === 'string')).toString();
				resolve(parseLooseBody(text, req.headers['content-type'], req.url));
			} catch (e) {
				reject(e);
			}
		});
		req.on('error', reject);
	});
}

/** Minimal router: add(method, '/jobs/:id', handler, { public }) then match(method, path). */
function createRouter() {
	const routes = [];

	function compile(pattern) {
		const keys = [];
		const source = pattern
			.replace(/\/+$/, '')
			.replace(/:([A-Za-z_]+)/g, (_, k) => {
				keys.push(k);
				return '([^/]+)';
			});
		return { regex: new RegExp(`^${source || ''}/?$`), keys };
	}

	return {
		add(method, pattern, handler, opts = {}) {
			routes.push({ method: method.toUpperCase(), ...compile(pattern), handler, opts });
		},
		match(method, path) {
			for (const r of routes) {
				if (r.method !== method.toUpperCase()) continue;
				const m = r.regex.exec(path);
				if (!m) continue;
				const params = {};
				r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
				return { handler: r.handler, params, opts: r.opts };
			}
			return null;
		},
		has(path) {
			return routes.some((r) => r.regex.test(path));
		},
	};
}

/** Strip the function mount prefix and query string: '/server/api/jobs?x=1' -> '/jobs'. */
function normalizePath(url) {
	const [pathOnly] = String(url || '/').split('?');
	return pathOnly.replace(/^\/server\/api(?=\/|$)/, '').replace(/^\/api(?=\/|$)/, '') || '/';
}

function parseQuery(url) {
	const q = String(url || '').split('?')[1] || '';
	return Object.fromEntries(new URLSearchParams(q));
}

module.exports = { sendJson, ok, sendError, readJson, readLooseBody, parseLooseBody, createRouter, normalizePath, parseQuery };
