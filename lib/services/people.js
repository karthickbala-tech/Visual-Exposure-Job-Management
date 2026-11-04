'use strict';

const { personMemo } = require('../caches');

const { ROLES } = require('../config');
const { projectRow } = require('../authz');
const { AppError, notFound, forbidden } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { requireGrant } = require('./access');

const rowId = schemas.rowId;
const BOOLS = ['is_active', 'is_internal', 'mdm_enabled', 'is_deleted'];

const personFields = {
	first_name: z.string().trim().min(1).max(100),
	last_name: z.string().trim().max(100),
	email: z.string().trim().toLowerCase().email().max(100),
	phone: z.string().trim().max(30),
	person_kind: z.enum(['staff', 'subcontractor']),
	job_title: z.string().trim().max(100),
	company_id: rowId,
	roles: z.array(z.enum(ROLES)).max(11),
	hourly_rate: z.number().min(0).max(1000),
	is_active: z.boolean(),
};
const createInput = z.object({ ...personFields }).partial().required({ first_name: true });
const updateInput = z.object({ ...personFields }).partial();
const listQuery = schemas.pagination.extend({ active: z.enum(['true', 'false']).optional() });

const present = (actor, row) => projectRow(actor.roles, 'people', withBooleans(row, BOOLS));
/** Booleans go to Catalyst as the strings it expects; roles are stored as JSON text. */
const toRow = (input) => {
	const row = { ...input };
	if (row.roles) row.roles = JSON.stringify(row.roles);
	if (row.is_active !== undefined) row.is_active = String(row.is_active);
	return row;
};

async function listPeople(ctx, rawQuery = {}) {
	requireGrant(ctx.actor, 'people', 'view');
	const q = parse(listQuery, rawQuery);
	const rows = await ctx.repos.people.list({ active: q.active === undefined ? undefined : q.active === 'true', limit: q.limit, offset: q.offset });
	return { items: rows.map((r) => present(ctx.actor, r)), count: rows.length };
}

async function getPerson(ctx, id) {
	requireGrant(ctx.actor, 'people', 'view');
	parse(rowId, id);
	const [row] = await ctx.repos.people.findByIds([id]);
	if (!row) throw notFound('Person not found');
	return { person: present(ctx.actor, row) };
}

async function assertEmailFree(ctx, email, exceptId) {
	if (!email) return;
	const existing = await ctx.repos.people.findByEmail(email);
	if (existing && String(existing.ROWID) !== String(exceptId)) {
		throw new AppError(409, 'email_in_use', 'Someone with this email already exists');
	}
}

async function createPerson(ctx, raw) {
	requireGrant(ctx.actor, 'people', 'create');
	const input = parse(createInput, raw);
	if (input.roles && input.roles.length && !ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can give roles');
	await assertEmailFree(ctx, input.email);
	const row = await ctx.repos.people.insert({ is_internal: 'true', ...toRow({ is_active: true, person_kind: 'staff', ...input }) });
	personMemo.clear();
	return { person: present(ctx.actor, row) };
}

/** Role assignment (FSD 5.14): only an administrator changes roles or the active flag, and nobody can lock themselves out. */
function checkRoleChange(ctx, row, input) {
	if (input.roles === undefined && input.is_active === undefined) return;
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can change roles or switch a person on or off');
	const me = ctx.actor.person && String(ctx.actor.person.ROWID) === String(row.ROWID);
	if (me && input.roles && !input.roles.includes('admin')) throw new AppError(409, 'self_lockout', 'You cannot remove your own administrator role');
	if (me && input.is_active === false) throw new AppError(409, 'self_lockout', 'You cannot switch yourself off');
}

async function updatePerson(ctx, id, raw) {
	requireGrant(ctx.actor, 'people', 'edit');
	parse(rowId, id);
	const input = parse(updateInput, raw);
	const [row] = await ctx.repos.people.findByIds([id]);
	if (!row) throw notFound('Person not found');
	checkRoleChange(ctx, row, input);
	await assertEmailFree(ctx, input.email, id);
	if (Object.keys(input).length) await ctx.repos.people.update({ ROWID: row.ROWID, ...toRow(input) });
	personMemo.clear();
	return { person: present(ctx.actor, { ...row, ...toRow(input) }) };
}

/** The roles that can be given (for the role picker). */
async function listRoles(ctx) {
	requireGrant(ctx.actor, 'people', 'view');
	return { items: ROLES.map((r) => ({ key: r, label: r.replace(/_/g, ' ') })) };
}

module.exports = { listRoles, listPeople, getPerson, createPerson, updatePerson };
