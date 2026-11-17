'use strict';

const { forbidden, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { complianceStatus, contactFlags, daysUntil, nextReminderDate, normaliseOffsets, offsetsFor, ownOffsets, warningDays } = require('../domain/reminders');
const { todayLocal, toDbDateTime } = require('../time');
const { requireGrant } = require('./access');
const { readSettings } = require('./appSettings');
const { TYPES } = require('../seed/complianceTypes');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const STATUSES = ['Valid', 'Expiring', 'Expired', 'No expiry'];
const KINDS = ['ticket', 'induction', 'company_document'];
/** A ticket, induction or document type (CMP-1). No reminder days of its own means it follows the Admin setting. */
const typeInput = z.object({
	compliance_kind: z.enum(KINDS),
	name: z.string().trim().min(1).max(200),
	requires_expiry: z.boolean(),
	is_mandatory_type: z.boolean(),
	reminder_offsets: z.array(z.number().int().min(0).max(365)).max(8),
});

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
		// DS "Do not contact the worker / manager about this": stops those reminder emails for this item only.
		do_not_contact: z.object({ worker: z.boolean(), managers: z.boolean() }).partial().strict(),
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

/** One item as the screens need it: derived status, days left and the type's name. `globalOffsets` is the Admin setting. */
function present(row, type, personName, today, companyName, globalOffsets) {
	const r = withBooleans(row, ['is_active']);
	const offsets = offsetsFor(type && type.reminder_offsets, globalOffsets);
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
		doNotContact: contactFlags(r.do_not_contact),
		daysLeft: r.expiry_date ? daysUntil(r.expiry_date, today) : null,
	};
}

/** One type for the screens. `ownOffsets` is empty when the type follows the Admin setting; `offsets` is what applies by default. */
const presentType = (t) => ({
	id: String(t.ROWID),
	kind: t.compliance_kind,
	name: t.name,
	requiresExpiry: withBooleans(t, ['requires_expiry']).requires_expiry === true,
	mandatory: withBooleans(t, ['is_mandatory_type']).is_mandatory_type === true,
	offsets: normaliseOffsets(t.reminder_offsets),
	ownOffsets: [...new Set(ownOffsets(t.reminder_offsets))].sort((a, b) => b - a),
});

async function listTypes(ctx) {
	requireGrant(ctx.actor, 'compliance', 'view');
	const rows = await ctx.repos.complianceTypes.list();
	return { items: rows.map(presentType) };
}

const asTypeRow = (i) => ({
	...(i.compliance_kind !== undefined ? { compliance_kind: i.compliance_kind } : {}),
	...(i.name !== undefined ? { name: i.name } : {}),
	...(i.requires_expiry !== undefined ? { requires_expiry: String(i.requires_expiry) } : {}),
	...(i.is_mandatory_type !== undefined ? { is_mandatory_type: String(i.is_mandatory_type) } : {}),
	...(i.reminder_offsets !== undefined ? { reminder_offsets: JSON.stringify([...new Set(i.reminder_offsets)].sort((a, b) => b - a)) } : {}),
});
const sameName = (rows, name, exceptId) => rows.some((t) => String(t.ROWID) !== String(exceptId) && String(t.name).trim().toLowerCase() === name.toLowerCase());

/** Add a ticket, induction or document type (CMP-1, FSD 5.14). Administrators only; names are unique. */
async function createType(ctx, raw) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can change compliance types');
	const input = parse(typeInput, raw);
	if (sameName(await ctx.repos.complianceTypes.list(), input.name)) throw badRequest('A compliance type with this name already exists');
	const row = await ctx.repos.complianceTypes.insert(asTypeRow(input));
	return { item: presentType(row) };
}

/** Edit a type. Changing the kind would move existing records between people and companies, so it is refused once in use. */
async function updateType(ctx, id, raw) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can change compliance types');
	parse(rowId, id);
	const input = parse(typeInput.partial(), raw);
	const rows = await ctx.repos.complianceTypes.list();
	const row = rows.find((t) => String(t.ROWID) === String(id));
	if (!row) throw notFound('Compliance type not found');
	if (input.name && sameName(rows, input.name, id)) throw badRequest('A compliance type with this name already exists');
	if (input.compliance_kind && input.compliance_kind !== row.compliance_kind && (await ctx.repos.compliance.list({ typeId: id, limit: 1 })).length) {
		throw badRequest('This type is already used, so its kind cannot change');
	}
	const patch = asTypeRow(input);
	if (Object.keys(patch).length) await ctx.repos.complianceTypes.update({ ROWID: row.ROWID, ...patch });
	return { item: presentType({ ...row, ...patch }) };
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
	const [types, people, companies, settings] = await Promise.all([
		ctx.repos.complianceTypes.list(),
		ctx.repos.people.findByIds(rows.map((r) => r.person_id).filter(Boolean)),
		companyIds.length ? ctx.repos.companies.findByIds(companyIds) : [],
		readSettings(ctx.repos),
	]);
	const companyName = new Map(companies.map((c) => [String(c.ROWID), c.name]));
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const nameById = new Map(people.map((p) => [String(p.ROWID), `${p.first_name || ''} ${p.last_name || ''}`.trim()]));

	let items = rows.map((r) => present(r, typeById.get(String(r.type_id)), nameById.get(String(r.person_id)), today, companyName.get(String(r.company_id)), settings.expiry_reminder_days));
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
	const next = requiresExpiry ? nextReminderDate({ expiryDate: input.expiry_date, offsets: offsetsFor(type.reminder_offsets, settings.expiry_reminder_days) }) : null;
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
	return { item: present(row, type, person && `${person.first_name || ''} ${person.last_name || ''}`.trim(), todayLocal(ctx.now()), company && company.name, settings.expiry_reminder_days) };
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
	if (input.do_not_contact) patch.do_not_contact = JSON.stringify({ ...contactFlags(row.do_not_contact), ...input.do_not_contact });
	const expiry = input.expiry_date !== undefined ? input.expiry_date : row.expiry_date;
	const settings = await readSettings(ctx.repos);
	if (input.expiry_date !== undefined) {
		patch.meta = '{}';
		patch.next_reminder_at = asDateTime(expiry ? nextReminderDate({ expiryDate: expiry, offsets: offsetsFor(type && type.reminder_offsets, settings.expiry_reminder_days) }) : null);
	}
	if (Object.keys(patch).length) await ctx.repos.compliance.update({ ROWID: row.ROWID, ...patch });
	const [person] = await ctx.repos.people.findByIds([row.person_id]);
	return { item: present({ ...row, ...patch, expiry_date: expiry }, type, person && `${person.first_name || ''} ${person.last_name || ''}`.trim(), todayLocal(ctx.now()), undefined, settings.expiry_reminder_days) };
}

/** Insert any missing seed compliance types. Admin only; safe to repeat. */
async function seedComplianceTypes(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can load compliance types');
	const rows = await ctx.repos.complianceTypes.list();
	const existing = new Set(rows.map((t) => t.name));
	const missing = TYPES.filter((t) => !existing.has(t.name));
	// One insert call for everything missing.
	await ctx.repos.complianceTypes.insertMany(
		missing.map((t) => ({ ...t, requires_expiry: String(t.requires_expiry), is_mandatory_type: String(t.is_mandatory_type), reminder_offsets: JSON.stringify(t.reminder_offsets) }))
	);
	// An earlier seed saved company documents with the kind "document"; the app reads "company_document". Repair them in one call.
	const wrongKind = rows.filter((t) => t.compliance_kind === 'document');
	if (wrongKind.length) await ctx.repos.complianceTypes.update(wrongKind.map((t) => ({ ROWID: t.ROWID, compliance_kind: 'company_document' })));
	return { added: missing.map((t) => t.name), skipped: TYPES.length - missing.length, repaired: wrongKind.map((t) => t.name) };
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

/**
 * The warning window of each compliance item (its type's reminder days, else the Admin setting), for counts and the to-do,
 * and the longest window, so one query can fetch everything that might be expiring. Two reads: settings and types.
 */
async function expiryWindows(repos) {
	const [settings, types] = await Promise.all([readSettings(repos), repos.complianceTypes.list()]);
	const global = settings.expiry_reminder_days;
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const windowOf = (item) => warningDays(offsetsFor((typeById.get(String(item.type_id)) || {}).reminder_offsets, global));
	const maxDays = Math.max(warningDays(offsetsFor(null, global)), ...types.map((t) => warningDays(offsetsFor(t.reminder_offsets, global))));
	return { windowOf, maxDays };
}

module.exports = { expiryWindows, listTypes, createType, updateType, listItems, createItem, updateItem, seedComplianceTypes, parseJson, getPortal, revealPortalPassword, setPortal };
