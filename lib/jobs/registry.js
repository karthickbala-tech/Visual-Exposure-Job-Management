'use strict';

const events = require('../events/registry');
const { createRepos } = require('../repos');
const { createMailer } = require('../mail');
const { runComplianceDue } = require('../services/complianceJob');
const { drainOutbox } = require('../services/outbox');
const { createHandlers } = require('../integrations/handlers');
const { createZoho } = require('../integrations/zoho');
const { pullWonDeals } = require('../services/crmPull');
const { generateMaintenanceTasks } = require('../services/maintenance');
const { runWeeklyHoursReport, runWeeklyIssuesReport } = require('../services/weeklyReports');
const { makeContext } = require('../context');

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
	'crm-sync', // pull won deals from the CRM, then deliver queued work
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
	'drain-outbox': async (params, ctx) => {
		const repos = ctx.repos || createRepos(ctx.db);
		const zoho = ctx.zoho === undefined ? createZoho() : ctx.zoho; // null when the ZOHO_ settings are not set
		const result = await drainOutbox(
			{ repos, log: ctx.log, now: ctx.now || (() => new Date()) },
			createHandlers({ crm: zoho && zoho.crm, workdrive: zoho && zoho.workdrive, parentFolderId: zoho && zoho.parentFolderId, repos })
		);
		ctx.log.info('outbox drained', result);
	},
	/** One hourly job: make jobs for newly won CRM deals, then deliver what is queued for Zoho. */
	'crm-sync': async (params, ctx) => {
		const zoho = ctx.zoho === undefined ? createZoho() : ctx.zoho;
		if (!zoho) {
			ctx.log.info('crm-sync skipped: Zoho settings are not set');
			return;
		}
		const system = ctx.systemCtx || makeContext({ roles: ['admin'], person: null, user: null, db: ctx.db, app: ctx.app }, ctx.log);
		const pulled = await pullWonDeals({ ...system, zoho });
		ctx.log.info('won deals pulled', pulled);
		await handlers['drain-outbox'](params, { ...ctx, zoho });
	},
	/** Wednesday: the weekly hours report to the people chosen in settings. */
	'weekly-hours-report': async (params, ctx) => {
		const system = ctx.systemCtx || makeContext({ roles: ['admin'], person: null, user: null, db: ctx.db, app: ctx.app }, ctx.log);
		ctx.log.info('weekly hours report', await runWeeklyHoursReport(system));
	},
	/** Thursday: one email per department that has open issues. */
	'weekly-issues-report': async (params, ctx) => {
		const system = ctx.systemCtx || makeContext({ roles: ['admin'], person: null, user: null, db: ctx.db, app: ctx.app }, ctx.log);
		ctx.log.info('weekly issues report', await runWeeklyIssuesReport(system));
	},
	/** Daily: equipment that is due for a check gets a Maintenance task under the workshop job. */
	'maintenance-tasks': async (params, ctx) => {
		const system = ctx.systemCtx || makeContext({ roles: ['admin'], person: null, user: null, db: ctx.db, app: ctx.app }, ctx.log);
		ctx.log.info('maintenance tasks', await generateMaintenanceTasks(system));
	},
	'compliance-due': async (params, ctx) => {
		const result = await runComplianceDue({
			repos: ctx.repos || createRepos(ctx.db),
			mailer: ctx.mailer || createMailer(ctx.app),
			log: ctx.log,
			now: ctx.now || (() => new Date()),
		});
		ctx.log.info('compliance reminders', result);
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
