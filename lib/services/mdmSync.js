'use strict';

const { forbidden } = require('../errors');
const { planMdmSync } = require('../domain/mdmSync');
const { safeError } = require('../domain/outbox');

const CHUNK = 100; // rows per insert or update call

/**
 * Pull devices and their last known locations from ManageEngine MDM into the device table (EQP-4).
 * Cost per run, however many devices: 2 MDM reads, 1 person query (by the device users' emails), 1 device read,
 * then one insert and one update call per 100 changed rows. Safe to run again: rows are matched by serial number and
 * only changed fields are written. Administrators (or the scheduled job, which runs as the system) only.
 * `ctx.mdm` is the client from lib/integrations/mdm.js, or null when MDM is not set up.
 */
async function syncDevices(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can sync devices');
	if (!ctx.mdm) return { ran: false, reason: 'ManageEngine MDM is not set up (MDM_REFRESH_TOKEN and its data center are not set on this function).' };

	let devices;
	let locations;
	try {
		[devices, locations] = await Promise.all([ctx.mdm.listDevices(), ctx.mdm.lastLocations()]);
	} catch (err) {
		return { ran: false, reason: `Could not read from MDM: ${safeError(err)}` };
	}

	const emails = devices.map((d) => d.user && d.user.user_email).filter(Boolean);
	const [people, existing] = await Promise.all([ctx.repos.people.findByEmails(emails), ctx.repos.devices.list({ limit: 300 })]);
	const plan = planMdmSync({ devices, locations, people, existing });

	for (let i = 0; i < plan.inserts.length; i += CHUNK) await ctx.repos.devices.insertMany(plan.inserts.slice(i, i + CHUNK));
	for (let i = 0; i < plan.updates.length; i += CHUNK) await ctx.repos.devices.updateMany(plan.updates.slice(i, i + CHUNK));

	return { ran: true, ...plan.counts, skippedUsers: plan.skippedUsers };
}

module.exports = { syncDevices };
