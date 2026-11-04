'use strict';

const { AppError, forbidden, notFound } = require('../errors');
const { z, parse, schemas } = require('../validate');
const { STATUS, checkSign, mergePpe } = require('../domain/swms');
const { toDbDateTime } = require('../time');
const { requireGrant, taskAccess } = require('./access');
const { readSettings } = require('./appSettings');

const rowId = schemas.rowId;
const MAX_JSON = 9000; // column limit is 10,000 characters

const updateInput = z
	.object({
		pcbu: z.record(z.string(), z.string().max(500)),
		site_address: z.string().max(2000),
		ppe: z.array(z.string().trim().min(1).max(60)).max(40),
		swms_tasks: z.array(z.object({ task: z.string().trim().min(1).max(500), responsible: z.string().trim().max(200).optional() })).max(40),
		work_manager_id: rowId.nullable(),
	})
	.partial();
const signInput = z.object({ as: z.enum(['pm', 'tl']) });

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};
const actorId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const personName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : null);

function view(row) {
	return {
		id: String(row.ROWID),
		jobId: String(row.job_id),
		status: row.swms_status,
		pcbu: parseJson(row.pcbu, {}),
		siteAddress: row.site_address || '',
		ppe: parseJson(row.ppe, []),
		tasks: parseJson(row.swms_tasks, []),
		declarations: parseJson(row.declarations, []),
		signoff: parseJson(row.signoff, {}),
		workManagerId: row.work_manager_id ? String(row.work_manager_id) : null,
	};
}

/** Create the SWMS for a new install task and link it (SW-1). */
async function createForTask(ctx, task, job) {
	const settings = await readSettings(ctx.repos); // the company (PCBU) details to start from
	const row = await ctx.repos.swms.insert({
		job_id: job.ROWID,
		swms_status: STATUS.CREATED,
		pcbu: JSON.stringify(settings.pcbu_defaults || {}),
		site_address: '',
		ppe: '[]',
		swms_tasks: '[]',
		declarations: '[]',
		signoff: '{}',
		work_manager_id: job.pm_id || undefined,
	});
	await ctx.repos.tasks.update({ ROWID: task.ROWID, swms_id: row.ROWID });
	return row;
}

/** Load a SWMS plus the install task that owns it, checking the caller may see it. */
async function load(ctx, id, verb) {
	parse(rowId, id);
	const row = await ctx.repos.swms.findById(id);
	if (!row) throw notFound('SWMS not found');
	const task = await ctx.repos.tasks.findBySwms(row.ROWID);
	if (task) {
		const access = await taskAccess(ctx, task, verb === 'view' ? 'view' : 'edit');
		return { row, task, ...access };
	}
	const grant = requireGrant(ctx.actor, 'swms', verb);
	if (grant.scope !== 'all') throw notFound('SWMS not found');
	return { row, task: null, grant, isAssignee: false, assigneeLinks: [] };
}

async function getSwms(ctx, id) {
	requireGrant(ctx.actor, 'swms', 'view');
	const { row, task } = await load(ctx, id, 'view');
	return { swms: view(row), taskId: task ? String(task.ROWID) : null };
}

/** Edit the statement. Managers only; PPE can only grow; signed statements are locked. */
async function updateSwms(ctx, id, raw) {
	requireGrant(ctx.actor, 'swms', 'edit');
	const { row, grant } = await load(ctx, id, 'edit');
	if (grant.scope !== 'all') throw forbidden('Only managers can edit a SWMS');
	if ([STATUS.TL_SIGNED, STATUS.NOT_REQUIRED].includes(row.swms_status)) {
		throw new AppError(409, 'swms_locked', `A SWMS that is ${row.swms_status} cannot be edited`);
	}
	const input = parse(updateInput, raw);

	const patch = {};
	if (input.pcbu) patch.pcbu = JSON.stringify(input.pcbu);
	if (input.site_address !== undefined) patch.site_address = input.site_address;
	if (input.ppe) patch.ppe = JSON.stringify(mergePpe(parseJson(row.ppe, []), input.ppe));
	if (input.swms_tasks) patch.swms_tasks = JSON.stringify(input.swms_tasks);
	if (input.work_manager_id !== undefined) patch.work_manager_id = input.work_manager_id;
	for (const [k, v] of Object.entries(patch)) {
		if (typeof v === 'string' && v.length > MAX_JSON) throw new AppError(413, 'value_too_large', `${k} is too long`);
	}

	if (Object.keys(patch).length) await ctx.repos.swms.update({ ROWID: row.ROWID, ...patch });
	return { swms: view({ ...row, ...patch }) };
}

/** Sign as the project manager or as the team leader. Each signing is logged with who and when. */
async function signSwms(ctx, id, raw) {
	requireGrant(ctx.actor, 'swms', 'edit');
	const { as } = parse(signInput, raw);
	const { row, task, assigneeLinks } = await load(ctx, id, 'edit');

	const me = actorId(ctx);
	const isLead = !!me && assigneeLinks.some((l) => String(l.person_id) === me && l.assignee_role === 'lead');
	const check = checkSign(row.swms_status, as, { roles: ctx.actor.roles, isLead });
	if (!check.ok) {
		throw check.code === 'not_allowed' ? forbidden(check.reason) : new AppError(409, 'invalid_state', check.reason);
	}

	const [person] = me ? await ctx.repos.people.findByIds([me]) : [];
	const signoff = parseJson(row.signoff, {});
	signoff[as] = { personId: me, name: personName(person), at: toDbDateTime(ctx.now()) };

	await ctx.repos.swms.update({ ROWID: row.ROWID, swms_status: check.to, signoff: JSON.stringify(signoff) });
	await ctx.repos.activity.insert({
		entity_type: 'swms',
		entity_id: row.ROWID,
		activity_type: 'signed',
		actor_id: me || undefined,
		logged_at: toDbDateTime(ctx.now()),
		from_value: row.swms_status,
		to_value: check.to,
	});
	await ctx.publish('swms.signed', { swmsId: String(row.ROWID), taskId: task ? String(task.ROWID) : null, status: check.to });
	return { swms: view({ ...row, swms_status: check.to, signoff: JSON.stringify(signoff) }) };
}

/** A crew member on the task adds their own declaration (SW-3). Safe to repeat. */
async function declare(ctx, id) {
	const { row, isAssignee } = await load(ctx, id, 'edit');
	if (!isAssignee) throw forbidden('Only people on this task can add a declaration');
	if ([STATUS.TL_SIGNED, STATUS.NOT_REQUIRED].includes(row.swms_status)) {
		throw new AppError(409, 'swms_locked', `A SWMS that is ${row.swms_status} cannot take new declarations`);
	}
	const me = actorId(ctx);
	const list = parseJson(row.declarations, []);
	if (!list.some((d) => d.personId === me)) {
		const [person] = await ctx.repos.people.findByIds([me]);
		list.push({ personId: me, name: personName(person), at: toDbDateTime(ctx.now()) });
		await ctx.repos.swms.update({ ROWID: row.ROWID, declarations: JSON.stringify(list) });
	}
	return { swms: view({ ...row, declarations: JSON.stringify(list) }) };
}

/** An install task that is not used no longer needs its SWMS. */
async function markNotRequired(ctx, task) {
	if (!task.swms_id) return;
	const row = await ctx.repos.swms.findById(task.swms_id);
	if (row && row.swms_status === STATUS.CREATED) {
		await ctx.repos.swms.update({ ROWID: row.ROWID, swms_status: STATUS.NOT_REQUIRED });
	}
}

module.exports = { createForTask, getSwms, updateSwms, signSwms, declare, markNotRequired };
