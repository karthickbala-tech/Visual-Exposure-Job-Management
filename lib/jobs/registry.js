'use strict';

/**
 * Scheduled / background jobs (see docs/CATALYST_PLAN.md section 8).
 * A Catalyst job is submitted with a parameter `job` naming one of these.
 * Job handlers must be safe to run twice.
 */
const JOB_NAMES = Object.freeze([
	'compliance-due',
	'weekly-hours-report',
	'weekly-issues-report',
	'maintenance-tasks',
	'profit-digest',
	'mdm-sync',
	'drain-outbox',
]);

/** name -> async (params, ctx) => void. Empty until handlers are built. */
const handlers = {};

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
