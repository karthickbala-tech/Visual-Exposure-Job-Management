'use strict';

const { NotConfigured } = require('../domain/outbox');

/**
 * What each queued piece of outbox work does. `deps` carries the real clients (ctx.crm and so on).
 * Until a client exists the handler says "not configured", and the work waits in the queue instead
 * of failing. The real clients are in zoho.js and need the ZOHO_ function settings.
 * deps: { crm, workdrive, parentFolderId, repos }
 */
function createHandlers(deps = {}) {
	return {
		/** Push fields onto a CRM deal, for example the job stage. */
		'crm.update_deal': async (payload) => {
			if (!deps.crm) throw new NotConfigured('Zoho CRM');
			await deps.crm.updateDeal(payload.dealId, payload.fields);
		},

		/** Create the job's WorkDrive folder once and remember where it is. Running it twice does nothing the second time. */
		'workdrive.create_job_folder': async (payload) => {
			if (!deps.workdrive || !deps.parentFolderId || !deps.repos) throw new NotConfigured('Zoho WorkDrive');
			const job = await deps.repos.jobs.findById(payload.jobId);
			if (!job || job.workdrive_folder_id) return;
			const folder = await deps.workdrive.createFolder(deps.parentFolderId, payload.jobName || job.name);
			await deps.repos.jobs.update({ ROWID: job.ROWID, workdrive_folder_id: folder.id, workdrive_url: folder.url || undefined });
		},
	};
}

module.exports = { createHandlers };
