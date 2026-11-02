'use strict';

/**
 * Domain events (see docs/CATALYST_PLAN.md section 7). Handlers must be idempotent:
 * the same event may be delivered more than once.
 *
 * Add a handler by putting it in this map. A name with no handler is logged and
 * skipped, so publishing an event before its handler exists never breaks callers.
 */
const EVENT_TYPES = Object.freeze([
	'job.created',
	'task.created',
	'task.assigned',
	'task.stage_changed',
	'task.submitted',
	'task.reviewed',
	'checklist.step_completed',
	'checklist.closed',
	'issue.changed',
	'swms.signed',
	'compliance.due',
	'file.uploaded',
]);

/** type -> async (payload, ctx) => void. Empty until handlers are built. */
const { send: _send, ...emailHandlers } = require('./handlers');
const handlers = { ...emailHandlers };

async function dispatch(type, payload, ctx) {
	if (!EVENT_TYPES.includes(type)) {
		ctx.log.warn('unknown event type', { type });
		return { handled: false, reason: 'unknown_type' };
	}
	const handler = handlers[type];
	if (!handler) {
		ctx.log.info('no handler yet', { type });
		return { handled: false, reason: 'no_handler' };
	}
	await handler(payload, ctx);
	return { handled: true };
}

module.exports = { EVENT_TYPES, handlers, dispatch };
