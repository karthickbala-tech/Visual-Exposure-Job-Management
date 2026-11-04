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

		/**
		 * Copy an uploaded attachment into the WorkDrive folder of its job (TSK-5). A file that belongs to no job, or whose job has
		 * no folder yet, is tried again later (the folder is made by its own queued job). Running it twice does nothing the second time.
		 */
		'workdrive.upload_file': async (payload) => {
			if (!deps.workdrive || !deps.repos || !deps.storage) throw new NotConfigured('Zoho WorkDrive');
			const file = await deps.repos.files.findById(payload.fileId);
			if (!file || String(file.is_deleted) === 'true') return; // deleted before it was copied
			const job = await jobForFile(deps.repos, file);
			if (!job) return; // nothing to attach it to
			if (!job.workdrive_folder_id) throw new Error('The job folder in WorkDrive is not ready yet');
			const bytes = await deps.storage.getBytes(file.storage_key);
			await deps.workdrive.uploadFile(job.workdrive_folder_id, file.file_name, bytes, file.mime_type);
		},
	};
}

/** The job an attachment belongs to: through its task (task, checklist) or the task of an issue. */
async function jobForFile(repos, file) {
	let taskId = null;
	if (file.entity_type === 'task') taskId = file.entity_id;
	else if (file.entity_type === 'checklist') {
		const c = await repos.checklists.findById(file.entity_id);
		taskId = c && c.task_id;
	} else if (file.entity_type === 'issue') {
		const i = await repos.issues.findById(file.entity_id);
		taskId = i && i.task_id;
	}
	if (!taskId) return null;
	const task = await repos.tasks.findById(taskId);
	return task ? repos.jobs.findById(task.job_id) : null;
}

module.exports = { createHandlers };
