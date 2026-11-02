'use strict';

const { NotConfigured } = require('../domain/outbox');

/**
 * What each queued piece of outbox work does. `deps` carries the real clients (ctx.crm and so on).
 * Until a client exists the handler says "not configured", and the work waits in the queue instead
 * of failing. The real clients need the rotated Zoho OAuth credentials and are added with them.
 */
function createHandlers(deps = {}) {
	return {
		/** Push fields onto a CRM deal, for example the job stage. */
		'crm.update_deal': async (payload) => {
			if (!deps.crm) throw new NotConfigured('Zoho CRM');
			await deps.crm.updateDeal(payload.dealId, payload.fields);
		},
	};
}

module.exports = { createHandlers };
