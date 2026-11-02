'use strict';

const crypto = require('crypto');
const { ok, sendError, normalizePath } = require('./lib/http');
const { resolveActor } = require('./lib/identity');
const { AppError } = require('./lib/errors');
const { createLogger } = require('./lib/logger');
const { router } = require('./routes');

/**
 * Advanced I/O entry point (HTTP). Thin adapter:
 *   1. match the route
 *   2. authenticate (unless the route is public)
 *   3. run the handler, which calls services in lib/
 * No business rules live here. Responses use { success, data } / { success, error }.
 */
module.exports = async (req, res) => {
	const requestId = req.headers['x-request-id'] || crypto.randomUUID();
	const log = createLogger({ fn: 'api', requestId });
	const started = Date.now();

	try {
		const path = normalizePath(req.url);
		const method = req.method || 'GET';
		const matched = router.match(method, path);

		if (!matched) {
			if (router.has(path)) throw new AppError(405, 'method_not_allowed', 'Method not allowed');
			throw new AppError(404, 'not_found', 'No such endpoint');
		}

		const actor = matched.opts.public ? null : await resolveActor(req);
		const out = await matched.handler({ req, url: req.url, params: matched.params, actor, log });
		ok(res, out.status, out.body);
		log.info('request', {
			method,
			path,
			status: out.status,
			ms: Date.now() - started,
			userId: actor && actor.user && actor.user.user_id,
		});
	} catch (err) {
		sendError(res, err, log);
		log.info('request failed', {
			method: req.method,
			status: err && err.status ? err.status : 500,
			ms: Date.now() - started,
		});
	}
};
