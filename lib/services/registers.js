'use strict';

const { notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { todayLocal, toDbDateTime } = require('../time');
const { requireGrant } = require('./access');
const R = require('../domain/registers');

const rowId = schemas.rowId;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const url = z.string().trim().max(500).refine(R.isWebUrl, 'Use a web address starting with http:// or https://');

const equipmentInput = z.object({
	name: z.string().trim().min(1).max(200),
	type: z.string().trim().max(100).optional(),
	location_id: rowId.nullable().optional(),
	status: z.enum(R.EQUIPMENT_STATUSES).optional(),
	off_hire_required: z.boolean().optional(),
	frequency_days: z.number().int().min(1).max(3650).nullable().optional(),
	last_checked: date.nullable().optional(),
	// The person responsible for the item (demo E2); kept in the item's data, so no new column.
	responsible_id: rowId.nullable().optional(),
});
const chemicalInput = z.object({
	name: z.string().trim().min(1).max(200),
	location_id: rowId.nullable().optional(),
	sds_url: url.or(z.literal('')).optional(),
	review_date: date.nullable().optional(),
	stock: z.number().min(0).max(1000000).nullable().optional(),
	unit: z.string().trim().max(20).optional(),
	hazard_class: z.string().trim().max(100).optional(),
	supplier: z.string().trim().max(200).optional(), // demo E3; kept in the item's data, so no new column
});
const locationInput = z.object({
	name: z.string().trim().min(1).max(200),
	description: z.string().trim().max(1000).optional(),
	supervisor_id: rowId.nullable().optional(),
});
const listQuery = schemas.pagination.extend({ location_id: rowId.optional() });

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};
const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : null);

async function locationNames(ctx) {
	const rows = await ctx.repos.locations.list();
	return new Map(rows.map((l) => [String(l.ROWID), l.name]));
}

function presentEquipment(row, locs, today, names = new Map()) {
	const r = withBooleans(row, ['off_hire_required']);
	const plan = parseJson(r.plan, {});
	const data = parseJson(r.data, {});
	return {
		responsibleId: data.responsible_id ? String(data.responsible_id) : null,
		responsibleName: data.responsible_id ? names.get(String(data.responsible_id)) || null : null,
		id: String(r.ROWID),
		code: r.code,
		name: r.name,
		type: r.type || '',
		locationId: r.location_id ? String(r.location_id) : null,
		locationName: r.location_id ? locs.get(String(r.location_id)) || null : null,
		status: r.status || 'In service',
		offHireRequired: r.off_hire_required === true,
		frequencyDays: plan.frequency_days || null,
		lastChecked: plan.last_checked || null,
		nextDue: R.nextDue(plan),
		overdue: R.isOverdue({ status: r.status || 'In service', plan }, today),
		daysOverdue: R.daysOverdue({ plan }, today),
	};
}

function presentChemical(row, locs, today) {
	const data = parseJson(row.data, {});
	return {
		id: String(row.ROWID),
		code: row.code,
		name: row.name,
		locationId: row.location_id ? String(row.location_id) : null,
		locationName: row.location_id ? locs.get(String(row.location_id)) || null : null,
		sdsUrl: data.sds_url || '',
		sdsMissing: R.sdsMissing(data),
		reviewDate: data.review_date || null,
		reviewDue: R.sdsReviewDue(data, today),
		stock: data.stock ?? null,
		unit: data.unit || '',
		hazardClass: data.hazard_class || '',
		supplier: data.supplier || '',
	};
}

async function listRegister(ctx, kind, rawQuery, present) {
	requireGrant(ctx.actor, 'equipment', 'view');
	const q = parse(listQuery, rawQuery);
	const today = todayLocal(ctx.now());
	const [rows, locs] = await Promise.all([ctx.repos.registerItems.list({ kind, locationId: q.location_id, limit: q.limit, offset: q.offset }), locationNames(ctx)]);
	// The names of the people responsible, in one query (none when nobody is set).
	const names = await personNames(ctx, rows.map((r) => parseJson(r.data, {}).responsible_id));
	const items = rows.map((r) => present(r, locs, today, names));
	return { items, count: items.length };
}

const listEquipment = (ctx, q = {}) => listRegister(ctx, 'equipment', q, presentEquipment);
const listChemicals = (ctx, q = {}) => listRegister(ctx, 'chemical', q, presentChemical);

async function assertLocation(ctx, id) {
	if (id && !(await ctx.repos.locations.findById(id))) throw notFound('Workshop location not found');
}

async function createEquipment(ctx, raw) {
	requireGrant(ctx.actor, 'equipment', 'create');
	const input = parse(equipmentInput, raw);
	await assertLocation(ctx, input.location_id);
	const existing = await ctx.repos.registerItems.list({ kind: 'equipment', limit: 300 });
	const plan = { frequency_days: input.frequency_days || null, last_checked: input.last_checked || null };
	const row = await ctx.repos.registerItems.insert({
		kind: 'equipment',
		code: R.nextToolCode(existing.map((e) => e.code)),
		name: input.name,
		type: input.type,
		location_id: input.location_id || null,
		status: input.status || 'In service',
		off_hire_required: String(input.off_hire_required === true),
		plan: JSON.stringify(plan),
		data: JSON.stringify(input.responsible_id ? { responsible_id: input.responsible_id } : {}),
	});
	return { item: presentEquipment(row, await locationNames(ctx), todayLocal(ctx.now()), await personNames(ctx, [input.responsible_id])) };
}

/** Names of people by id, in one query (none when there are no ids). */
async function personNames(ctx, ids) {
	const wanted = [...new Set(ids.filter(Boolean).map(String))];
	return new Map((wanted.length ? await ctx.repos.people.findByIds(wanted) : []).map((p) => [String(p.ROWID), fullName(p)]));
}

/** One history row for an equipment item: each changed field with its old and new value (like issue history). */
function logEquipment(ctx, row, changes) {
	if (!changes.length) return null;
	return ctx.repos.activity.insert({
		entity_type: 'equipment',
		entity_id: row.ROWID,
		activity_type: 'equipment_change',
		actor_id: ctx.actor && ctx.actor.person ? String(ctx.actor.person.ROWID) : null,
		logged_at: toDbDateTime(ctx.now()),
		payload: JSON.stringify({ changes }),
	});
}

/** The history of one equipment item, newest first: who changed what, and when. */
async function equipmentHistory(ctx, id) {
	requireGrant(ctx.actor, 'equipment', 'view');
	parse(rowId, id);
	const row = await ctx.repos.registerItems.findById(id);
	if (!row || row.kind !== 'equipment') throw notFound('Equipment not found');
	const rows = await ctx.repos.activity.listByEntity({ entityType: 'equipment', entityId: row.ROWID, activityType: 'equipment_change', limit: 100 });
	const names = await personNames(ctx, rows.map((r) => r.actor_id));
	const items = rows.map((r) => ({ at: r.logged_at || null, by: r.actor_id ? names.get(String(r.actor_id)) || null : null, changes: parseJson(r.payload, {}).changes || [] }));
	return { items, count: items.length };
}

async function updateEquipment(ctx, id, raw) {
	requireGrant(ctx.actor, 'equipment', 'edit');
	parse(rowId, id);
	const input = parse(equipmentInput.partial(), raw);
	const row = await ctx.repos.registerItems.findById(id);
	if (!row || row.kind !== 'equipment') throw notFound('Equipment not found');
	await assertLocation(ctx, input.location_id);
	const plan = parseJson(row.plan, {});
	const oldPlan = { ...plan };
	if (input.frequency_days !== undefined) plan.frequency_days = input.frequency_days;
	if (input.last_checked !== undefined) plan.last_checked = input.last_checked;
	const data = parseJson(row.data, {});
	const oldData = { ...data };
	if (input.responsible_id !== undefined) data.responsible_id = input.responsible_id;
	const patch = { plan: JSON.stringify(plan), data: JSON.stringify(data) };
	for (const k of ['name', 'type', 'location_id', 'status']) if (input[k] !== undefined) patch[k] = input[k];
	if (input.off_hire_required !== undefined) patch.off_hire_required = String(input.off_hire_required);
	await ctx.repos.registerItems.update({ ROWID: row.ROWID, ...patch });

	// History (demo E2): what changed, in words people read. Location and person ids become names.
	const [locs, names] = await Promise.all([locationNames(ctx), personNames(ctx, [oldData.responsible_id, data.responsible_id])]);
	const show = {
		location: (v) => (v ? locs.get(String(v)) || 'Unknown location' : 'None'),
		person: (v) => (v ? names.get(String(v)) || 'Unknown person' : 'Nobody'),
		days: (v) => (v ? `${v} days` : 'Not set'),
		yesNo: (v) => (String(v) === 'true' ? 'Yes' : 'No'),
		text: (v) => (v ? String(v) : 'None'),
	};
	const fields = [
		['Name', row.name, patch.name, show.text],
		['Type', row.type, patch.type, show.text],
		['Location', row.location_id, patch.location_id, show.location],
		['Status', row.status || 'In service', patch.status, show.text],
		['Hired (off hire when the job ends)', row.off_hire_required, patch.off_hire_required, show.yesNo],
		['Check every', oldPlan.frequency_days, input.frequency_days, show.days],
		['Last checked', oldPlan.last_checked, input.last_checked, show.text],
		['Responsible', oldData.responsible_id, input.responsible_id, show.person],
	];
	const changes = fields
		.filter(([, from, to]) => to !== undefined && String(from ?? '') !== String(to ?? ''))
		.map(([label, from, to, fmt]) => ({ label, from: fmt(from), to: fmt(to) }));
	await logEquipment(ctx, row, changes);
	return { item: presentEquipment({ ...row, ...patch }, locs, todayLocal(ctx.now()), names) };
}

/** The same, for the platform: a finished maintenance task counts as the check. No permission check. */
async function touchChecked(ctx, id) {
	const row = await ctx.repos.registerItems.findById(id);
	if (!row || row.kind !== 'equipment') return false;
	const plan = { ...parseJson(row.plan, {}), last_checked: todayLocal(ctx.now()) };
	await ctx.repos.registerItems.update({ ROWID: row.ROWID, plan: JSON.stringify(plan) });
	return true;
}

/** Record that the equipment was checked today; the next due date moves forward by its interval. */
async function markChecked(ctx, id) {
	requireGrant(ctx.actor, 'equipment', 'edit');
	parse(rowId, id);
	const row = await ctx.repos.registerItems.findById(id);
	if (!row || row.kind !== 'equipment') throw notFound('Equipment not found');
	const before = parseJson(row.plan, {}).last_checked || null;
	const plan = { ...parseJson(row.plan, {}), last_checked: todayLocal(ctx.now()) };
	await ctx.repos.registerItems.update({ ROWID: row.ROWID, plan: JSON.stringify(plan) });
	if (before !== plan.last_checked) await logEquipment(ctx, row, [{ label: 'Last checked', from: before || 'Never', to: plan.last_checked }]);
	return { item: presentEquipment({ ...row, plan: JSON.stringify(plan) }, await locationNames(ctx), todayLocal(ctx.now())) };
}

/**
 * EQP-2: an install task finished on site; the hired equipment listed goes off hire if it is flagged for it.
 * Returns what was switched so the caller can tell the equipment managers.
 */
async function offHireForFinishedInstall(ctx, equipmentIds) {
	requireGrant(ctx.actor, 'equipment', 'edit');
	const toSwitch = await switchOffHire(ctx, equipmentIds);
	return { switched: toSwitch.map((e) => ({ id: String(e.ROWID), code: e.code, name: e.name })) };
}

/** The switch itself, with no permission check (the platform does this when a task finishes). Returns the items it switched. */
async function switchOffHire(ctx, equipmentIds) {
	if (!equipmentIds || !equipmentIds.length) return [];
	const rows = (await ctx.repos.registerItems.findByIds(equipmentIds)).map((r) => withBooleans(r, ['off_hire_required']));
	const toSwitch = R.offHireOnFinish(rows);
	if (toSwitch.length) await ctx.repos.registerItems.update(toSwitch.map((e) => ({ ROWID: e.ROWID, status: 'Off hire' }))); // one call
	return toSwitch;
}

/**
 * EQP-2: an install task finished on site. Hired equipment linked to it (task.spec.hired_equipment) that is flagged for it and
 * still in service goes off hire, and the equipment managers are told once (a second call finds nothing left to switch).
 */
async function releaseHiredEquipment(ctx, task) {
	const ids = parseJson(task.spec, {}).hired_equipment;
	const switched = await switchOffHire(ctx, Array.isArray(ids) ? ids : []);
	if (switched.length) await ctx.publish('equipment.off_hire', { taskId: String(task.ROWID), equipment: switched.map((e) => ({ code: e.code, name: e.name })) });
	return switched.length;
}

async function createChemical(ctx, raw) {
	requireGrant(ctx.actor, 'equipment', 'create');
	const input = parse(chemicalInput, raw);
	await assertLocation(ctx, input.location_id);
	const existing = await ctx.repos.registerItems.list({ kind: 'chemical', limit: 300 });
	const row = await ctx.repos.registerItems.insert({
		kind: 'chemical',
		code: `CHEM - ${existing.length + 1}`,
		name: input.name,
		location_id: input.location_id || null,
		status: 'In use',
		off_hire_required: 'false',
		plan: '{}',
		data: JSON.stringify({ sds_url: input.sds_url || '', review_date: input.review_date || null, stock: input.stock ?? null, unit: input.unit || '', hazard_class: input.hazard_class || '', supplier: input.supplier || '' }),
	});
	return { item: presentChemical(row, await locationNames(ctx), todayLocal(ctx.now())) };
}

async function updateChemical(ctx, id, raw) {
	requireGrant(ctx.actor, 'equipment', 'edit');
	parse(rowId, id);
	const input = parse(chemicalInput.partial(), raw);
	const row = await ctx.repos.registerItems.findById(id);
	if (!row || row.kind !== 'chemical') throw notFound('Chemical not found');
	await assertLocation(ctx, input.location_id);
	const data = parseJson(row.data, {});
	for (const k of ['sds_url', 'review_date', 'stock', 'unit', 'hazard_class', 'supplier']) if (input[k] !== undefined) data[k] = input[k];
	const patch = { data: JSON.stringify(data) };
	if (input.name !== undefined) patch.name = input.name;
	if (input.location_id !== undefined) patch.location_id = input.location_id;
	await ctx.repos.registerItems.update({ ROWID: row.ROWID, ...patch });
	return { item: presentChemical({ ...row, ...patch }, await locationNames(ctx), todayLocal(ctx.now())) };
}

async function listLocations(ctx) {
	requireGrant(ctx.actor, 'equipment', 'view');
	const rows = await ctx.repos.locations.list();
	const people = await ctx.repos.people.findByIds(rows.map((l) => l.supervisor_id).filter(Boolean));
	const nameById = new Map(people.map((p) => [String(p.ROWID), fullName(p)]));
	return {
		items: rows.map((l) => ({
			id: String(l.ROWID),
			name: l.name,
			description: l.description || '',
			supervisorId: l.supervisor_id ? String(l.supervisor_id) : null,
			supervisorName: l.supervisor_id ? nameById.get(String(l.supervisor_id)) || null : null,
		})),
	};
}

async function createLocation(ctx, raw) {
	requireGrant(ctx.actor, 'equipment', 'create');
	const input = parse(locationInput, raw);
	if (input.supervisor_id && !(await ctx.repos.people.findByIds([input.supervisor_id])).length) throw badRequest('Supervisor not found');
	const row = await ctx.repos.locations.insert({ name: input.name, description: input.description, supervisor_id: input.supervisor_id || null });
	return { item: { id: String(row.ROWID), name: row.name, description: row.description || '', supervisorId: row.supervisor_id ? String(row.supervisor_id) : null } };
}

async function updateLocation(ctx, id, raw) {
	requireGrant(ctx.actor, 'equipment', 'edit');
	parse(rowId, id);
	const input = parse(locationInput.partial(), raw);
	const row = await ctx.repos.locations.findById(id);
	if (!row) throw notFound('Workshop location not found');
	if (input.supervisor_id && !(await ctx.repos.people.findByIds([input.supervisor_id])).length) throw badRequest('Supervisor not found');
	await ctx.repos.locations.update({ ROWID: row.ROWID, ...input });
	return { item: { id: String(row.ROWID), name: input.name ?? row.name, description: input.description ?? row.description ?? '', supervisorId: input.supervisor_id === undefined ? row.supervisor_id || null : input.supervisor_id } };
}

/** Devices with their last known place. Serial numbers and positions are sensitive, so this needs its own grant. */
async function listDevices(ctx, rawQuery = {}) {
	requireGrant(ctx.actor, 'devices', 'view');
	const q = parse(schemas.pagination, rawQuery);
	const rows = await ctx.repos.devices.list({ limit: q.limit, offset: q.offset });
	const people = await ctx.repos.people.findByIds(rows.map((d) => d.person_id).filter(Boolean));
	const nameById = new Map(people.map((p) => [String(p.ROWID), fullName(p)]));
	const now = ctx.now().getTime();
	return {
		items: rows.map((d) => ({
			id: String(d.ROWID),
			personName: d.person_id ? nameById.get(String(d.person_id)) || null : null,
			model: d.model || '',
			os: d.os_name || d.os || '',
			lat: R.hasLocation(d) ? Number(d.last_lat) : null,
			lng: R.hasLocation(d) ? Number(d.last_lng) : null,
			address: d.last_address || '',
			lastSeenAt: d.last_seen_at || null,
			stale: R.isStale(d, now),
			mapUrl: R.hasLocation(d) ? R.mapLink(d) : null,
		})),
	};
}

module.exports = { equipmentHistory, touchChecked, switchOffHire, releaseHiredEquipment, listEquipment, createEquipment, updateEquipment, markChecked, offHireForFinishedInstall, listChemicals, createChemical, updateChemical, listLocations, createLocation, updateLocation, listDevices };
