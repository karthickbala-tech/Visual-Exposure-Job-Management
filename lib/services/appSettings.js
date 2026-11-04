'use strict';

const { forbidden, notFound } = require('../errors');
const { z, parse, schemas } = require('../validate');
const { toDbDateTime } = require('../time');

const KEY = 'app.settings';

/** Settings an administrator can change. Anything else is refused, so the row can never fill up with strays. */
const updateInput = z
	.object({
		/** The job that workshop and maintenance tasks are created under (FAB-5). */
		workshop_job_id: schemas.rowId.nullable(),
		/** One pay-period setting for every hours screen (HRS-3): the first day of any period, and how long a period is. */
		pay_period: z.object({ start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'), length_days: z.number().int().min(7).max(31) }).nullable(),
		/**
		 * Who is told about issues of each department (ISS-1): a manager and an inform-also list. A department with no entry
		 * falls back to every project manager.
		 */
		issue_routing: z
			.record(z.string(), z.object({ manager_id: schemas.rowId.nullable().optional(), inform_also: z.array(schemas.rowId).max(20).optional() }))
			.refine((r) => Object.keys(r).every((k) => ['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards'].includes(k)), 'Use these departments: Management, Design, Fabrication, Install, Civic Billboards')
			.nullable(),
		/** Work scheduled before this date is ignored by the hours-not-filled count (HRS-4). */
		hours_cutoff_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').nullable(),
	})
	.partial()
	.strict();

const parseJson = (text) => {
	try {
		const v = text ? JSON.parse(text) : {};
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {};
	}
};

/** The saved settings as a plain object (empty when nothing has been saved). Used by other services. */
async function readSettings(repos) {
	const row = await repos.settings.findByKey(KEY);
	return parseJson(row && row.setting_value);
}

const requireAdmin = (ctx) => {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can use settings');
};

async function getSettings(ctx) {
	requireAdmin(ctx);
	const settings = await readSettings(ctx.repos);
	const job = settings.workshop_job_id ? await ctx.repos.jobs.findById(settings.workshop_job_id) : null;
	return {
		settings: {
			workshop_job_id: settings.workshop_job_id || null,
			pay_period: settings.pay_period || null,
			hours_cutoff_date: settings.hours_cutoff_date || null,
			issue_routing: settings.issue_routing || null,
		},
		workshopJobName: job ? job.name : null,
	};
}

async function updateSettings(ctx, raw) {
	requireAdmin(ctx);
	const input = parse(updateInput, raw);
	if (input.workshop_job_id && !(await ctx.repos.jobs.findById(input.workshop_job_id))) throw notFound('That job does not exist');

	const row = await ctx.repos.settings.findByKey(KEY);
	const next = { ...parseJson(row && row.setting_value), ...input };
	for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
	const value = JSON.stringify(next);
	const by = ctx.actor.person ? ctx.actor.person.ROWID : undefined;
	if (row) await ctx.repos.settings.update({ ROWID: row.ROWID, setting_value: value, updated_by: by });
	else await ctx.repos.settings.insert({ setting_key: KEY, setting_value: value, description: 'Application settings', updated_by: by });
	await ctx.repos.activity.insert({
		entity_type: 'setting',
		entity_id: row ? row.ROWID : 0,
		activity_type: 'updated',
		actor_id: by,
		logged_at: toDbDateTime(ctx.now()),
		to_value: KEY,
		payload: value,
	});
	return getSettings(ctx);
}

module.exports = { readSettings, getSettings, updateSettings, KEY };
