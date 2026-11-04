'use strict';

const { forbidden, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { complianceStatus, daysUntil, nextReminderDate, normaliseOffsets } = require('../domain/reminders');
const { todayLocal } = require('../time');
const { requireGrant } = require('./access');
const { readSettings } = require('./appSettings');
const { TYPES } = require('../seed/complianceTypes');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const STATUSES = ['Valid', 'Expiring', 'Expired', 'No expiry'];

const createInput = z.object({
	type_id: rowId,
	person_id: rowId,
	reference_no: z.string().trim().max(100).optional(),
	issue_date: date.optional(),
	expiry_date: date.optional(),
});
const updateInput = z
	.object({
		reference_no: z.string().trim().max(100),
		issue_date: date.nullable(),
		expiry_date: date.nullable(),
		is_active: z.boolean(),
	})
	.partial();
const listQuery = schemas.pagination.extend({ person_id: rowId.optional(), status: z.enum(STATUSES).optional() });

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};
const myId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const asDateTime = (d) => (d ? `${d} 00:00:00` : null);

/** One item as the screens need it: derived status, days left and the type's name. */
function present(row, type, personName, today) {
	const r = withBooleans(row, ['is_active']);
	const offsets = type ? type.reminder_offsets : null;
	const requiresExpiry = type ? withBooleans(type, ['requires_expiry']).requires_expiry : true;
	return {
		id: String(r.ROWID),
		kind: r.compliance_kind,
		typeId: r.type_id ? String(r.type_id) : null,
		typeName: type ? type.name : null,
		personId: r.person_id ? String(r.person_id) : null,
		personName: personName || null,
		referenceNo: r.reference_no || '',
		issueDate: r.issue_date || null,
		expiryDate: r.expiry_date || null,
		isActive: r.is_active !== false,
		status: complianceStatus({ expiryDate: r.expiry_date, requiresExpiry, offsets }, today),
		daysLeft: r.expiry_date ? daysUntil(r.expiry_date, today) : null,
	};
}

async function listTypes(ctx) {
	requireGrant(ctx.actor, 'compliance', 'view');
	const rows = await ctx.repos.complianceTypes.list();
	return {
		items: rows.map((t) => ({
			id: String(t.ROWID),
			kind: t.compliance_kind,
			name: t.name,
			requiresExpiry: withBooleans(t, ['requires_expiry']).requires_expiry === true,
			mandatory: withBooleans(t, ['is_mandatory_type']).is_mandatory_type === true,
			offsets: normaliseOffsets(t.reminder_offsets),
		})),
	};
}

/** Items for one person or everyone. Crew (scope "own") only ever get their own. */
async function listItems(ctx, rawQuery = {}) {
	const grant = requireGrant(ctx.actor, 'compliance', 'view');
	const q = parse(listQuery, rawQuery);
	const today = todayLocal(ctx.now());

	let personId = q.person_id;
	if (grant.scope !== 'all') {
		if (!myId(ctx)) return { items: [], count: 0 };
		if (personId && personId !== myId(ctx)) throw notFound('Not found');
		personId = myId(ctx);
	}
	const rows = await ctx.repos.compliance.list({ personId, limit: q.limit, offset: q.offset });
	const [types, people] = await Promise.all([
		ctx.repos.complianceTypes.list(),
		ctx.repos.people.findByIds(rows.map((r) => r.person_id).filter(Boolean)),
	]);
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const nameById = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));

	let items = rows.map((r) => present(r, typeById.get(String(r.type_id)), nameById.get(String(r.person_id)), today));
	if (q.status) items = items.filter((i) => i.status === q.status);
	// Soonest expiry first; items with no date last.
	items.sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999'));
	return { items, count: items.length };
}

async function createItem(ctx, raw) {
	requireGrant(ctx.actor, 'compliance', 'create');
	const input = parse(createInput, raw);
	const type = await ctx.repos.complianceTypes.findById(input.type_id);
	if (!type) throw notFound('Compliance type not found');
	const [person] = await ctx.repos.people.findByIds([input.person_id]);
	if (!person) throw notFound('Person not found');

	const requiresExpiry = withBooleans(type, ['requires_expiry']).requires_expiry === true;
	if (requiresExpiry && !input.expiry_date) throw badRequest(`${type.name} needs an expiry date`);
	if (input.issue_date && input.expiry_date && input.expiry_date < input.issue_date) throw badRequest('The expiry date is before the issue date');

	const settings = await readSettings(ctx.repos);
	const next = requiresExpiry ? nextReminderDate({ expiryDate: input.expiry_date, offsets: type.reminder_offsets || settings.expiry_reminder_days }) : null;
	const row = await ctx.repos.compliance.insert({
		compliance_kind: type.compliance_kind,
		subject_type: 'person',
		type_id: type.ROWID,
		person_id: person.ROWID,
		reference_no: input.reference_no,
		issue_date: input.issue_date,
		expiry_date: input.expiry_date,
		is_active: 'true',
		meta: '{}',
		next_reminder_at: asDateTime(next),
	});
	return { item: present(row, type, `${person.first_name || ''} ${person.last_name || ''}`.trim(), todayLocal(ctx.now())) };
}

/** Edit an item. Changing the expiry date (a renewal) starts the reminders again from scratch. */
async function updateItem(ctx, id, raw) {
	requireGrant(ctx.actor, 'compliance', 'edit');
	parse(rowId, id);
	const input = parse(updateInput, raw);
	const row = await ctx.repos.compliance.findById(id);
	if (!row) throw notFound('Item not found');
	const type = await ctx.repos.complianceTypes.findById(row.type_id);

	const patch = { ...input };
	if (patch.is_active !== undefined) patch.is_active = String(patch.is_active);
	const expiry = input.expiry_date !== undefined ? input.expiry_date : row.expiry_date;
	if (input.expiry_date !== undefined) {
		patch.meta = '{}';
		const settings = await readSettings(ctx.repos);
		patch.next_reminder_at = asDateTime(expiry ? nextReminderDate({ expiryDate: expiry, offsets: (type && type.reminder_offsets) || settings.expiry_reminder_days }) : null);
	}
	if (Object.keys(patch).length) await ctx.repos.compliance.update({ ROWID: row.ROWID, ...patch });
	const [person] = await ctx.repos.people.findByIds([row.person_id]);
	return { item: present({ ...row, ...patch, expiry_date: expiry }, type, person && `${person.first_name || ''} ${person.last_name || ''}`.trim(), todayLocal(ctx.now())) };
}

/** Insert any missing seed compliance types. Admin only; safe to repeat. */
async function seedComplianceTypes(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can load compliance types');
	const existing = new Set((await ctx.repos.complianceTypes.list()).map((t) => t.name));
	const missing = TYPES.filter((t) => !existing.has(t.name));
	// One insert call for everything missing.
	await ctx.repos.complianceTypes.insertMany(
		missing.map((t) => ({ ...t, requires_expiry: String(t.requires_expiry), is_mandatory_type: String(t.is_mandatory_type), reminder_offsets: JSON.stringify(t.reminder_offsets) }))
	);
	return { added: missing.map((t) => t.name), skipped: TYPES.length - missing.length };
}

module.exports = { listTypes, listItems, createItem, updateItem, seedComplianceTypes, parseJson };
