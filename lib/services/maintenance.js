'use strict';

const { forbidden } = require('../errors');
const { initialStage } = require('../domain/stages');
const { dueForMaintenance, maintenanceName } = require('../domain/fab');
const { todayLocal } = require('../time');
const { readSettings } = require('./appSettings');
const { recalcJob } = require('./tasks');

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

/**
 * FAB-4: equipment whose next check is due gets a Maintenance task under the configured workshop job, and its next due date
 * moves forward (next due = today + frequency), so running this twice on the same day makes nothing new.
 * Needs the workshop job set in Admin settings. Costs: one read of the settings, the job and the equipment, then one insert
 * for all new tasks and one update for all equipment, however many are due.
 * ctx: { actor (admin), repos, log, now, publish }
 */
async function generateMaintenanceTasks(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can generate maintenance tasks');
	const settings = await readSettings(ctx.repos);
	if (!settings.workshop_job_id) return { ran: false, reason: 'The workshop job is not set (Admin settings).' };
	const job = await ctx.repos.jobs.findById(settings.workshop_job_id);
	if (!job) return { ran: false, reason: 'The workshop job no longer exists.' };
	if (job.stage === 'Completed - Closed') return { ran: false, reason: 'The workshop job is closed.' };

	const today = todayLocal(ctx.now());
	const rows = await ctx.repos.registerItems.list({ kind: 'equipment', limit: 300 });
	const items = rows.map((r) => ({ ...r, plan: parseJson(r.plan, {}) }));
	const due = dueForMaintenance(items, today);
	if (!due.length) return { ran: true, created: 0 };

	await ctx.repos.tasks.insertMany(
		due.map((e) => ({
			task_type: 'fabrication',
			kind: 'Maintenance',
			name: maintenanceName(e),
			description: `Scheduled maintenance for ${e.name} (${e.code}).`,
			stage: initialStage('fabrication'),
			job_id: job.ROWID,
			quoted_hours: 0,
			scheduled_date: today,
			pm_id: job.pm_id || undefined,
			fab_manager_id: job.fab_manager_id || undefined,
			spec: JSON.stringify({ equipment_id: String(e.ROWID) }),
		}))
	);
	await ctx.repos.registerItems.update(due.map((e) => ({ ROWID: e.ROWID, plan: JSON.stringify({ ...e.plan, last_checked: today }) })));
	await recalcJob(ctx, job.ROWID);
	return { ran: true, created: due.length, equipment: due.map((e) => e.code) };
}

module.exports = { generateMaintenanceTasks };
