'use strict';

const { createRepos } = require('./repos');
const { publishEvent } = require('./publish');
const { createStorage } = require('./storage');
const { createCache } = require('./cache');

/**
 * Per-request context handed to services: { actor, repos, publish, log, now }.
 * Built once per request so the actor is resolved a single time and reused.
 * `publish` is best effort: a failed publish is logged, never fails the request.
 */
function makeContext(actor, log) {
	return {
		actor,
		repos: createRepos(actor.db),
		storage: createStorage(actor.app),
		cache: createCache(actor.app, 'kpi'),
		configCache: createCache(actor.app, 'config'),
		log,
		now: () => new Date(),
		publish: async (type, payload) => {
			try {
				await publishEvent(actor.app, type, payload);
			} catch (err) {
				log.warn('event publish failed', { type, error: err.message });
			}
		},
	};
}

module.exports = { makeContext };
