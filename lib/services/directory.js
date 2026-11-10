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
	street: z.string().trim().max(200).optional(),
	suburb: z.string().trim().max(100).optional(),
	state: z.string().trim().max(10).optional(),
	post_code: z.string().trim().max(10).optional(),
	contact_name: z.string().trim().max(200).optional(),
	phone: z.string().trim().max(40).optional(),
	email: z.string().trim().email().max(200).optional().or(z.literal('')),
	notes: z.string().trim().max(2000).optional(),
	is_active: z.boolean().optional(),
});
/** The four stages of a sign, with the names from the old Creator form. */
const SIGN_STAGES = Object.freeze({
	deal: ['Early Design', 'Client Review', 'Needs Changes', 'Approved'],
	artwork: ['Not a job yet', 'Design Stage', 'Client Review', 'Needs Changes', 'Client Approved', 'Manual Approval'],
	manufacturing: ['Not required', 'RFQ', 'Quoted', 'Approved', 'In Production', 'QC', 'Completed'],
	install: ['Pre Install planning', 'Ready for Scheduling', 'Scheduled', 'Installed - POP not sent', 'Installed - POP sent', 'Completed'],
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
	sign_number: z.string().trim().max(30).optional(),
	deal_stage: z.enum(SIGN_STAGES.deal).optional(),
	artwork_stage: z.enum(SIGN_STAGES.artwork).optional(),
	manufacturing_stage: z.enum(SIGN_STAGES.manufacturing).optional(),
	install_stage: z.enum(SIGN_STAGES.install).optional(),
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
	return {
		id: String(r.ROWID),
		name: r.name,
		kind: r.kind,
		street: r.street || '',
		suburb: r.suburb || '',
		state: r.state || '',
		postCode: r.post_code || '',
		contactName: r.contact_name || '',
		phone: r.phone || '',
		email: r.email || '',
		notes: r.notes || '',
		isActive: r.is_active !== false,
	};
}

/** A Google Maps search link for an address, so "View in Google Maps" works without a stored link. */
const mapsLink = (text) => (text ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(text) : '');

/** A site row (columns: name, street, suburb, state, post_code, country, maps_url, contacts, crm_site_id, ...) as the screens use it. */
function presentSite(row) {
	const r = withBooleans(row, ['is_active']);
	const c = parseJson(r.contacts, {});
	const address = [r.street, r.suburb, r.state, r.post_code].filter(Boolean).join(', ');
	return {
		id: String(r.ROWID),
		name: r.name,
		street: r.street || '',
		suburb: r.suburb || '',
		state: r.state || '',
		postCode: r.post_code || '',
		address,
		mapUrl: r.maps_url || mapsLink(address),
		crmSiteId: r.crm_site_id || '',
		addedTime: r.CREATEDTIME || null,
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
		signNumber: row.sign_number || '',
		dealStage: row.deal_stage || '',
		artworkStage: row.artwork_stage || '',
		manufacturingStage: row.manufacturing_stage || '',
		installStage: row.install_stage || '',
		installDate: row.install_date || null,
	};
}

const siteContacts = (i) => JSON.stringify({ name: i.contact_name || '', phone: i.phone || '' });

async function listCompanies(ctx, rawQuery = {}) {
	requireGrant(ctx.actor, 'companies', 'view');
	const q = parse(listQuery, rawQuery);
	const rows = await ctx.repos.companies.list({ limit: q.limit, offset: q.offset });
	return { items: rows.map(presentCompany) };
}

async function createCompany(ctx, raw) {
	requireGrant(ctx.actor, 'companies', 'create');
	const i = parse(companyInput, raw);
	const row = await ctx.repos.companies.insert({ name: i.name, kind: i.kind, street: i.street, suburb: i.suburb, state: i.state, post_code: i.post_code, contact_name: i.contact_name, phone: i.phone, email: i.email, notes: i.notes, is_active: String(i.is_active !== false), do_not_contact: '{}' });
	return { item: presentCompany(row) };
}

async function updateCompany(ctx, id, raw) {
	requireGrant(ctx.actor, 'companies', 'edit');
	parse(rowId, id);
	const i = parse(companyInput.partial(), raw);
	const row = await ctx.repos.companies.findById(id);
	if (!row) throw notFound('Company not found');
	const patch = {};
	for (const k of ['name', 'kind', 'street', 'suburb', 'state', 'post_code', 'notes', 'contact_name', 'phone', 'email']) if (i[k] !== undefined) patch[k] = i[k];
	if (i.is_active !== undefined) patch.is_active = String(i.is_active);
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
	const row = await ctx.repos.sites.insert({ name: i.name, street: i.street, suburb: i.suburb, state: i.state, post_code: i.post_code, country: 'Australia', contacts: siteContacts(i), is_active: String(i.is_active !== false) });
	return { item: presentSite(row) };
}

async function updateSite(ctx, id, raw) {
	requireGrant(ctx.actor, 'sites', 'edit');
	parse(rowId, id);
	const i = parse(siteInput.partial(), raw);
	const row = await ctx.repos.sites.findById(id);
	if (!row) throw notFound('Site not found');
	const c = parseJson(row.contacts, {});
	const patch = {};
	if (i.name !== undefined) patch.name = i.name;
	if (i.is_active !== undefined) patch.is_active = String(i.is_active);
	for (const k of ['street', 'suburb', 'state', 'post_code']) if (i[k] !== undefined) patch[k] = i[k];
	if (['contact_name', 'phone'].some((k) => i[k] !== undefined)) patch.contacts = siteContacts({ contact_name: i.contact_name ?? c.name, phone: i.phone ?? c.phone });
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
		sign_number: i.sign_number,
		deal_stage: i.deal_stage,
		artwork_stage: i.artwork_stage,
		manufacturing_stage: i.manufacturing_stage,
		install_stage: i.install_stage,
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

module.exports = { SIGN_STAGES, listCompanies, createCompany, updateCompany, listSites, createSite, updateSite, listSigns, createSign, updateSign };
