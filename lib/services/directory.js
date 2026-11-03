'use strict';

const { notFound } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { requireGrant } = require('./access');

const rowId = schemas.rowId;
const COMPANY_KINDS = ['subcontractor', 'supplier', 'client', 'internal'];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const companyInput = z.object({
	name: z.string().trim().min(1).max(200),
	kind: z.enum(COMPANY_KINDS),
	state: z.string().trim().max(10).optional(),
	contact_name: z.string().trim().max(200).optional(),
	phone: z.string().trim().max(40).optional(),
	email: z.string().trim().email().max(200).optional().or(z.literal('')),
	notes: z.string().trim().max(2000).optional(),
	is_active: z.boolean().optional(),
});
const siteInput = z.object({
	name: z.string().trim().min(1).max(200),
	street: z.string().trim().max(200).optional(),
	suburb: z.string().trim().max(100).optional(),
	state: z.string().trim().max(10).optional(),
	post_code: z.string().trim().max(10).optional(),
	contact_name: z.string().trim().max(200).optional(),
	phone: z.string().trim().max(40).optional(),
	is_active: z.boolean().optional(),
});
const signInput = z.object({
	job_id: rowId,
	name: z.string().trim().min(1).max(200),
	revision: z.string().trim().max(20).optional(),
	qty: z.number().int().min(1).max(100000).optional(),
	medium: z.string().trim().max(100).optional(),
	finishing: z.string().trim().max(100).optional(),
	install_date: date.nullable().optional(),
});
const listQuery = schemas.pagination;

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

function presentCompany(row) {
	const r = withBooleans(row, ['is_active']);
	const contact = parseJson(r.contact, {});
	return {
		id: String(r.ROWID),
		name: r.name,
		kind: r.kind,
		state: r.state || '',
		contactName: contact.owner || '',
		phone: contact.phone || '',
		email: contact.email || '',
		notes: r.notes || '',
		isActive: r.is_active !== false,
	};
}

function presentSite(row) {
	const r = withBooleans(row, ['is_active']);
	const a = parseJson(r.address, {});
	const c = parseJson(r.contact, {});
	return {
		id: String(r.ROWID),
		name: r.name,
		street: a.street || '',
		suburb: a.suburb || '',
		state: a.state || '',
		postCode: a.post_code || '',
		address: [a.street, a.suburb, a.state, a.post_code].filter(Boolean).join(', '),
		contactName: c.name || '',
		phone: c.phone || '',
		isActive: r.is_active !== false,
	};
}

function presentSign(row) {
	return {
		id: String(row.ROWID),
		jobId: String(row.job_id),
		name: row.name,
		revision: row.revision || '',
		qty: Number(row.qty || 1),
		medium: row.medium || '',
		finishing: row.finishing || '',
		installDate: row.install_date || null,
	};
}

const companyContact = (i) => JSON.stringify({ owner: i.contact_name || '', phone: i.phone || '', email: i.email || '' });
const siteAddress = (i) => JSON.stringify({ street: i.street || '', suburb: i.suburb || '', state: i.state || '', post_code: i.post_code || '' });
const siteContact = (i) => JSON.stringify({ name: i.contact_name || '', phone: i.phone || '' });

async function listCompanies(ctx, rawQuery = {}) {
	requireGrant(ctx.actor, 'companies', 'view');
	const q = parse(listQuery, rawQuery);
	const rows = await ctx.repos.companies.list({ limit: q.limit, offset: q.offset });
	return { items: rows.map(presentCompany) };
}

async function createCompany(ctx, raw) {
	requireGrant(ctx.actor, 'companies', 'create');
	const i = parse(companyInput, raw);
	const row = await ctx.repos.companies.insert({ name: i.name, kind: i.kind, state: i.state, contact: companyContact(i), notes: i.notes, is_active: String(i.is_active !== false), do_not_contact: '{}' });
	return { item: presentCompany(row) };
}

async function updateCompany(ctx, id, raw) {
	requireGrant(ctx.actor, 'companies', 'edit');
	parse(rowId, id);
	const i = parse(companyInput.partial(), raw);
	const row = await ctx.repos.companies.findById(id);
	if (!row) throw notFound('Company not found');
	const old = parseJson(row.contact, {});
	const patch = {};
	for (const k of ['name', 'kind', 'state', 'notes']) if (i[k] !== undefined) patch[k] = i[k];
	if (i.is_active !== undefined) patch.is_active = String(i.is_active);
	if (['contact_name', 'phone', 'email'].some((k) => i[k] !== undefined)) {
		patch.contact = companyContact({ contact_name: i.contact_name ?? old.owner, phone: i.phone ?? old.phone, email: i.email ?? old.email });
	}
	if (Object.keys(patch).length) await ctx.repos.companies.update({ ROWID: row.ROWID, ...patch });
	return { item: presentCompany({ ...row, ...patch }) };
}

async function listSites(ctx, rawQuery = {}) {
	requireGrant(ctx.actor, 'sites', 'view');
	const q = parse(listQuery, rawQuery);
	const rows = await ctx.repos.sites.list({ limit: q.limit, offset: q.offset });
	return { items: rows.map(presentSite) };
}

async function createSite(ctx, raw) {
	requireGrant(ctx.actor, 'sites', 'create');
	const i = parse(siteInput, raw);
	const row = await ctx.repos.sites.insert({ name: i.name, address: siteAddress(i), contact: siteContact(i), is_active: String(i.is_active !== false) });
	return { item: presentSite(row) };
}

async function updateSite(ctx, id, raw) {
	requireGrant(ctx.actor, 'sites', 'edit');
	parse(rowId, id);
	const i = parse(siteInput.partial(), raw);
	const row = await ctx.repos.sites.findById(id);
	if (!row) throw notFound('Site not found');
	const a = parseJson(row.address, {});
	const c = parseJson(row.contact, {});
	const patch = {};
	if (i.name !== undefined) patch.name = i.name;
	if (i.is_active !== undefined) patch.is_active = String(i.is_active);
	if (['street', 'suburb', 'state', 'post_code'].some((k) => i[k] !== undefined)) {
		patch.address = siteAddress({ street: i.street ?? a.street, suburb: i.suburb ?? a.suburb, state: i.state ?? a.state, post_code: i.post_code ?? a.post_code });
	}
	if (['contact_name', 'phone'].some((k) => i[k] !== undefined)) patch.contact = siteContact({ contact_name: i.contact_name ?? c.name, phone: i.phone ?? c.phone });
	if (Object.keys(patch).length) await ctx.repos.sites.update({ ROWID: row.ROWID, ...patch });
	return { item: presentSite({ ...row, ...patch }) };
}

/** Signs on one job. Crew with 'assigned' scope only see signs of jobs they work on, checked through the job service. */
async function listSigns(ctx, jobId) {
	requireGrant(ctx.actor, 'signs', 'view');
	parse(rowId, jobId);
	const job = await ctx.repos.jobs.findById(jobId);
	if (!job) throw notFound('Job not found');
	const rows = await ctx.repos.signs.listByJob(jobId);
	return { items: rows.map(presentSign) };
}

async function createSign(ctx, raw) {
	requireGrant(ctx.actor, 'signs', 'create');
	const i = parse(signInput, raw);
	if (!(await ctx.repos.jobs.findById(i.job_id))) throw notFound('Job not found');
	const row = await ctx.repos.signs.insert({
		job_id: i.job_id,
		name: i.name,
		revision: i.revision,
		qty: i.qty || 1,
		medium: i.medium,
		finishing: i.finishing,
		install_date: i.install_date || null,
		stages: '{}',
		details: '{}',
	});
	return { item: presentSign(row) };
}

async function updateSign(ctx, id, raw) {
	requireGrant(ctx.actor, 'signs', 'edit');
	parse(rowId, id);
	const i = parse(signInput.omit({ job_id: true }).partial(), raw);
	const row = await ctx.repos.signs.findById(id);
	if (!row) throw notFound('Sign not found');
	if (Object.keys(i).length) await ctx.repos.signs.update({ ROWID: row.ROWID, ...i });
	return { item: presentSign({ ...row, ...i }) };
}

module.exports = { listCompanies, createCompany, updateCompany, listSites, createSite, updateSite, listSigns, createSign, updateSign };
