'use strict';

const { forbidden } = require('../errors');
const { createZoho, check } = require('../integrations/zoho');
const { safeError } = require('../domain/outbox');

/**
 * Admin check: are the Zoho settings present, and do the credentials really work? Each service makes one
 * small read call. Nothing secret is returned, only "Connected" or a short reason. Admin only.
 * `ctx.zoho` can be supplied (tests); otherwise the client is built from the function's settings.
 */
async function status(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can check integrations');
	let zoho;
	try {
		zoho = ctx.zoho === undefined ? createZoho() : ctx.zoho;
	} catch (err) {
		return { crm: { configured: true, ok: false, message: err.message }, workdrive: { configured: true, ok: false, message: err.message }, workdriveFolderSet: false, workdriveFolder: { configured: false, ok: false, message: err.message } };
	}
	const [crm, workdrive, workdriveFolder] = await Promise.all([check(zoho, 'crm'), check(zoho, 'workdrive'), checkFolder(zoho)]);
	return { crm, workdrive, workdriveFolder, workdriveFolderSet: !!(zoho && zoho.parentFolderId) };
}

/** Can this login open the WorkDrive folder that job folders go in? (A wrong ID or missing permission shows here.) */
async function checkFolder(zoho) {
	if (!zoho) return { configured: false, ok: false, message: 'Credentials are not set on this function.' };
	if (!zoho.parentFolderId) return { configured: false, ok: false, message: 'WORKDRIVE_PARENT_FOLDER_ID is not set.' };
	try {
		const f = await zoho.workdrive.getFolder(zoho.parentFolderId);
		if (!f.isFolder) return { configured: true, ok: false, message: 'That ID is not a folder.' };
		return { configured: true, ok: true, message: f.name ? `Folder found: ${f.name}` : 'Folder found.' };
	} catch (err) {
		return { configured: true, ok: false, message: safeError(err) };
	}
}

module.exports = { status };
