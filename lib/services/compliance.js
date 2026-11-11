'use strict';

const { forbidden, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { complianceStatus, daysUntil, nextReminderDate, normaliseOffsets } = require('../domain/reminders');
const { todayLocal, toDbDateTime } = require('../time');
const { requireGrant } = require('./access');
const { readSettings } = require('./appSettings');
const { TYPES } = require('../seed/complianceTypes');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const STATUSES = ['Valid', 'Expiring', 'Expired', 'No expiry'];

const createInput = z.object({
	type_id: rowId,
	person_id: rowId.optional(),
	company_id: rowId.optional(), // a company document (CMP-1) belongs to a company instead of a person
	reference_no: z.string().trim().max(100).optional(),
	issue_date: date.optional(),
	expiry_date: date.optional(),
}).refine((v) => !!v.person_id !== !!v.company_id, { message: 'Give either a person or a company' });
const updateInput = z
	.object({
		reference_no: z.string().trim().max(100),
		issue_date: date.nullable(),
		expiry_date: date.nullable(),
		is_active: z.boolean(),
	})
	.partial();
const listQuery = schemas.pagination.extend({ person_id: rowId.optional(), company_id: rowId.optional(), status: z.enum(STATUSES).optional() });

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
function present(row, type, personName, today, companyName) {
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
		companyId: r.company_id ? String(r.company_id) : null,
		companyName: companyName || null,
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
	if (grant.scope !== 'all' && q.company_id) throw notFound('Not found');
	if (grant.scope !== 'all') {
		if (!myId(ctx)) return { items: [], count: 0 };
		if (personId && personId !== myId(ctx)) throw notFound('Not found');
		personId = myId(ctx);
	}
	const rows = await ctx.repos.compliance.list({ personId, companyId: q.company_id, limit: q.limit, offset: q.offset });
	const companyIds = [...new Set(rows.map((r) => r.company_id).filter(Boolean))];
	const [types, people, companies] = await Promise.all([
		ctx.repos.complianceTypes.list(),
		ctx.repos.people.findByIds(rows.map((r) => r.person_id).filter(Boolean)),
		companyIds.length ? ctx.repos.companies.findByIds(companyIds) : [],
	]);
	const companyName = new Map(companies.map((c) => [String(c.ROWID), c.name]));
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const nameById = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));

	let items = rows.map((r) => present(r, typeById.get(String(r.type_id)), nameById.get(String(r.person_id)), today, companyName.get(String(r.company_id))));
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
	const [person] = input.person_id ? await ctx.repos.people.findByIds([input.person_id]) : [null];
	if (input.person_id && !person) throw notFound('Person not found');
	const company = input.company_id ? await ctx.repos.companies.findById(input.company_id) : null;
	if (input.company_id && !company) throw notFound('Company not found');
	if (type.compliance_kind === 'company_document' && !company) throw badRequest('A company document belongs to a company');
	if (type.compliance_kind !== 'company_document' && !person) throw badRequest('A ticket or induction belongs to a person');

	const requiresExpiry = withBooleans(type, ['requires_expiry']).requires_expiry === true;
	if (requiresExpiry && !input.expiry_date) throw badRequest(`${type.name} needs an expiry date`);
	if (input.issue_date && input.expiry_date && input.expiry_date < input.issue_date) throw badRequest('The expiry date is before the issue date');

	const settings = await readSettings(ctx.repos);
	const next = requiresExpiry ? nextReminderDate({ expiryDate: input.expiry_date, offsets: type.reminder_offsets || settings.expiry_reminder_days }) : null;
	const row = await ctx.repos.compliance.insert({
		compliance_kind: type.compliance_kind,
		subject_type: person ? 'person' : 'company',
		type_id: type.ROWID,
		person_id: person ? person.ROWID : undefined,
		company_id: company ? company.ROWID : undefined,
		reference_no: input.reference_no,
		issue_date: input.issue_date,
		expiry_date: input.expiry_date,
		is_active: 'true',
		meta: '{}',
		next_reminder_at: asDateTime(next),
	});
	return { item: present(row, type, person && `${person.first_name || ''} ${person.last_name || ''}`.trim(), todayLocal(ctx.now()), company && company.name) };
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

/**
 * The training portal login of a ticket or induction (the Creator Login and Password fields). It lives in the encrypted
 * portal_login column, is for managers only, never appears in a list, and the password is only sent by an explicit reveal,
 * which is logged (who and when, never the value).
 */
const PORTAL_ROLES = ['admin', 'project_manager', 'fab_manager', 'install_coordinator'];
const portalInput = z.object({ login: z.string().trim().max(200), password: z.string().max(200) }).partial().strict();

async function loadPortal(ctx, id, verb) {
	requireGrant(ctx.actor, 'compliance', verb);
	parse(rowId, id);
	if (!(ctx.actor.roles || []).some((r) => PORTAL_ROLES.includes(r))) throw forbidden('Only managers can use training portal logins');
	const row = await ctx.repos.compliance.findById(id);
	if (!row) throw notFound('Item not found');
	return { row, stored: parseJson(row.portal_login, {}) };
}

const logPortal = (ctx, row, what, detail) =>
	ctx.repos.activity.insert({
		entity_type: 'compliance',
		entity_id: row.ROWID,
		activity_type: what,
		actor_id: ctx.actor.person ? ctx.actor.person.ROWID : undefined,
		logged_at: toDbDateTime(ctx.now()),
		...(detail ? { to_value: detail } : {}),
	});

/** The login name, and whether a password is stored. The password itself is not sent. */
async function getPortal(ctx, id) {
	const { row, stored } = await loadPortal(ctx, id, 'view');
	return { itemId: String(row.ROWID), login: stored.login || '', hasPassword: !!stored.password };
}

/** The password, on request. Each reveal is logged. */
async function revealPortalPassword(ctx, id) {
	const { row, stored } = await loadPortal(ctx, id, 'view');
	await logPortal(ctx, row, 'portal_viewed');
	return { itemId: String(row.ROWID), password: stored.password || '' };
}

async function setPortal(ctx, id, raw) {
	const input = parse(portalInput, raw);
	const { row, stored } = await loadPortal(ctx, id, 'edit');
	const merged = { ...stored };
	for (const [k, v] of Object.entries(input)) {
		if (v === '') delete merged[k];
		else merged[k] = v;
	}
	await ctx.repos.compliance.update({ ROWID: row.ROWID, portal_login: JSON.stringify(merged) });
	await logPortal(ctx, row, 'portal_changed', Object.keys(input).join(',')); // field names only
	return { itemId: String(row.ROWID), login: merged.login || '', hasPassword: !!merged.password };
}

module.exports = { listTypes, listItems, createItem, updateItem, seedComplianceTypes, parseJson, getPortal, revealPortalPassword, setPortal };
