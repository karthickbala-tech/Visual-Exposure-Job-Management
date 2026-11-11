'use strict';

const { forbidden, badRequest } = require('../errors');
const { ROLES } = require('../config');
const { z, parse } = require('../validate');
const X = require('../domain/exportCsv');
const { personMemo } = require('../caches');
const { COMPANY_KINDS } = require('./directory');

const requireAdmin = (ctx) => {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can import or export data');
};

const exportQuery = z.object({
	format: z.enum(['csv', 'json']).default('csv'),
	limit: z.coerce.number().int().min(1).max(300).default(300),
	offset: z.coerce.number().int().min(0).max(100000).default(0),
});

/**
 * Export one kind of record as CSV or JSON, up to 300 rows per request (ask for the next page with `offset`). Administrators only.
 * One query per request. Pay rates and other private columns are not in the export.
 */
async function exportEntity(ctx, entity, rawQuery = {}) {
	requireAdmin(ctx);
	if (!X.ENTITIES[entity]) throw badRequest(`Choose one of: ${Object.keys(X.ENTITIES).join(', ')}`);
	const q = parse(exportQuery, rawQuery);
	const page = { limit: q.limit, offset: q.offset };
	const repo = { jobs: ctx.repos.jobs, people: ctx.repos.people, companies: ctx.repos.companies, issues: ctx.repos.issues }[entity];
	const rows = await repo.list(page);
	const items = rows.map((r) => X.pick(entity, r));
	if (q.format === 'json') return { entity, count: items.length, offset: q.offset, items, hasMore: items.length >= q.limit };
	return { raw: { contentType: 'text/csv; charset=utf-8', filename: `${entity}.csv`, download: true, buffer: Buffer.from('﻿' + X.toCsv(entity, items), 'utf8') } };
}

const MAX_IMPORT = 50;
const personRow = z.object({
	first_name: z.string().trim().min(1).max(100),
	last_name: z.string().trim().max(100).optional(),
	email: z.string().trim().toLowerCase().email().max(100).optional(),
	phone: z.string().trim().max(30).optional(),
	person_kind: z.enum(['staff', 'subcontractor']).optional(),
	job_title: z.string().trim().max(100).optional(),
	roles: z.array(z.enum(ROLES)).max(11).optional(),
});
const companyRow = z.object({
	name: z.string().trim().min(1).max(200),
	kind: z.enum(COMPANY_KINDS).optional(),
	state: z.string().trim().max(10).optional(),
	notes: z.string().max(2000).optional(),
});
const body = (item) => z.object({ rows: z.array(item).min(1).max(MAX_IMPORT) });

/** Check each row on its own, so one bad row never blocks the others; returns the good rows and the problems. */
function checkRows(schema, rows) {
	const good = [];
	const skipped = [];
	rows.forEach((raw, i) => {
		const r = schema.safeParse(raw);
		if (r.success) good.push({ n: i + 1, row: r.data });
		else skipped.push({ row: i + 1, reason: r.error.issues.map((x) => `${x.path.join('.') || 'row'}: ${x.message}`).join('; ') });
	});
	return { good, skipped };
}

/**
 * Add people in bulk (up to 50 per request), for the move from the old system. A person whose email already exists is skipped,
 * not changed. Returns how many were created and which rows were skipped and why. Administrators only.
 */
async function importPeople(ctx, raw) {
	requireAdmin(ctx);
	const input = parse(body(z.any()), raw);
	const { good, skipped } = checkRows(personRow, input.rows);
	const existing = new Set((await ctx.repos.people.list({ limit: 300 })).map((p) => String(p.email || '').toLowerCase()).filter(Boolean));
	let created = 0;
	for (const { n, row } of good) {
		if (row.email && existing.has(row.email)) {
			skipped.push({ row: n, reason: 'A person with this email already exists' });
			continue;
		}
		await ctx.repos.people.insert({ is_internal: String((row.person_kind || 'staff') === 'staff'), is_active: 'true', person_kind: 'staff', ...row, roles: JSON.stringify(row.roles || []) });
		if (row.email) existing.add(row.email);
		created += 1;
	}
	personMemo.clear();
	return { created, skipped: skipped.sort((a, b) => a.row - b.row) };
}

/** Add companies in bulk (up to 50 per request). A company with the same name (any capitals) is skipped. Administrators only. */
async function importCompanies(ctx, raw) {
	requireAdmin(ctx);
	const input = parse(body(z.any()), raw);
	const { good, skipped } = checkRows(companyRow, input.rows);
	const existing = new Set((await ctx.repos.companies.list({ limit: 300 })).map((c) => String(c.name || '').trim().toLowerCase()));
	let created = 0;
	for (const { n, row } of good) {
		const key = row.name.toLowerCase();
		if (existing.has(key)) {
			skipped.push({ row: n, reason: 'A company with this name already exists' });
			continue;
		}
		await ctx.repos.companies.insert({ name: row.name, kind: row.kind || 'subcontractor', state: row.state, notes: row.notes, is_active: 'true', do_not_contact: '{}' });
		existing.add(key);
		created += 1;
	}
	return { created, skipped: skipped.sort((a, b) => a.row - b.row) };
}

module.exports = { exportEntity, importPeople, importCompanies };
