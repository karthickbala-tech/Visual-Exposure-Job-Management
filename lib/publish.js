'use strict';

const crypto = require('crypto');
const { EVENT_TYPES } = require('./events/registry');
const { AppError } = require('./errors');

/**
 * Publish a domain event.
 *
 * Catalyst Job Scheduling can only start Job-type functions, so an event is
 * delivered by submitting an immediate job to the `jobs` function with
 * params { job: 'dispatch-event', type, payload }. Catalyst queues and retries it.
 * Params are strings and small: pass ids, and let the handler read current state.
 */
const MAX_PAYLOAD_CHARS = 2000;

function jobName() {
	// 1-20 chars, alphanumeric and underscore only.
	return `evt_${crypto.randomBytes(7).toString('hex')}`.slice(0, 20);
}

async function publishEvent(app, type, payload = {}, opts = {}) {
	if (!EVENT_TYPES.includes(type)) {
		throw new AppError(500, 'unknown_event', `Unknown event type: ${type}`);
	}
	const body = JSON.stringify(payload);
	if (body.length > MAX_PAYLOAD_CHARS) {
		throw new AppError(500, 'event_too_large', 'Event payload must carry ids, not data');
	}

	return app.jobScheduling().job().submitJob({
		job_name: jobName(),
		target_type: 'Function',
		target_name: opts.target || 'jobs',
		jobpool_name: opts.pool || process.env.EVENT_JOB_POOL || 've_jobs_pool',
		params: { job: 'dispatch-event', type, payload: body },
		job_config: { number_of_retries: 2, retry_interval: 60 },
	});
}

module.exports = { publishEvent, MAX_PAYLOAD_CHARS };
