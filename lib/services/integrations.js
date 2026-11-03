'use strict';

const { forbidden } = require('../errors');
const { createZoho, check } = require('../integrations/zoho');

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
		return { crm: { configured: true, ok: false, message: err.message }, workdrive: { configured: true, ok: false, message: err.message }, workdriveFolderSet: false };
	}
	const [crm, workdrive] = await Promise.all([check(zoho, 'crm'), check(zoho, 'workdrive')]);
	return { crm, workdrive, workdriveFolderSet: !!(zoho && zoho.parentFolderId) };
}

module.exports = { status };
