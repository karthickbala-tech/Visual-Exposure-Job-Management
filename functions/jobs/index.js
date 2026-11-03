'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { createLogger } = require('./lib/logger');
const { createDb } = require('./lib/db');
const { run } = require('./lib/jobs/registry');

/**
 * Job function: scheduled and background work (15 minute limit).
 * Submit a Catalyst job with the parameter `job` set to one of JOB_NAMES.
 */
module.exports = async (jobRequest, context) => {
	const log = createLogger({ fn: 'jobs' });
	try {
		// Job runtime has no user token, so admin scope is required.
		const app = catalyst.initialize(context, { scope: 'admin' });
		const db = createDb(app);

		const params = jobRequest.getAllJobParams ? jobRequest.getAllJobParams() : {};
		const result = await run(params.job, params, { app, db, log });

		log.info('job finished', { job: params.job, ...result });
		context.closeWithSuccess();
	} catch (err) {
		log.error('job failed', err);
		context.closeWithFailure();
	}
};
