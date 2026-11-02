'use strict';

const events = require('../events/registry');

/**
 * Scheduled / background jobs (see docs/CATALYST_PLAN.md section 8).
 * A Catalyst job is submitted with a parameter `job` naming one of these.
 * Job handlers must be safe to run twice. All params arrive as strings.
 */
const JOB_NAMES = Object.freeze([
	'dispatch-event', // delivers a domain event published by lib/publish.js
	'compliance-due',
	'weekly-hours-report',
	'weekly-issues-report',
	'maintenance-tasks',
	'profit-digest',
	'mdm-sync',
	'drain-outbox',
]);

/** name -> async (params, ctx) => void. Fill in as each feature is built. */
const handlers = {
	'dispatch-event': async (params, ctx) => {
		let payload = {};
		try {
			payload = JSON.parse(params.payload || '{}');
		} catch (e) {
			ctx.log.warn('bad event payload', { type: params.type });
		}
		await events.dispatch(params.type, payload, ctx);
	},
};

async function run(name, params, ctx) {
	if (!JOB_NAMES.includes(name)) {
		ctx.log.warn('unknown job', { name });
		return { ran: false, reason: 'unknown_job' };
	}
	const handler = handlers[name];
	if (!handler) {
		ctx.log.info('no handler yet', { name });
		return { ran: false, reason: 'no_handler' };
	}
	await handler(params, ctx);
	return { ran: true };
}

module.exports = { JOB_NAMES, handlers, run };
