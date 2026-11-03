'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { createLogger } = require('./lib/logger');
const { createDb } = require('./lib/db');
const { dispatch } = require('./lib/events/registry');

/**
 * Event function: runs domain-event handlers. Event functions get 15 minutes,
 * so slow work (CRM/WorkDrive sync, PDFs, emails) belongs here, not in `api`.
 * The raw event body is JSON: { "type": "task.stage_changed", "payload": { ... } }.
 */
module.exports = async (event, context) => {
	const log = createLogger({ fn: 'events' });
	try {
		const app = catalyst.initialize(context, { scope: 'admin' });
		const db = createDb(app);

		const raw = event.getRawData ? event.getRawData() : event.getArgument();
		const message = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
		const result = await dispatch(message.type, message.payload || {}, { app, db, log });

		log.info('event processed', { type: message.type, ...result });
		context.closeWithSuccess();
	} catch (err) {
		log.error('event failed', err);
		context.closeWithFailure();
	}
};
