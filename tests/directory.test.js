'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const dir = require('../lib/services/directory');
const jobs = require('../lib/services/jobs');

test('companies: create, edit contact, deactivate; a bad kind or email is refused; viewers cannot add', async () => {
	const w = makeWorld();
	const c = await dir.createCompany(w.ctx, { name: 'Acme Signs', kind: 'subcontractor', contact_name: 'Sam', phone: '0400', email: 'sam@acme.test' });
	assert.equal(c.item.contactName, 'Sam');
	const u = await dir.updateCompany(w.ctx, c.item.id, { phone: '0411', is_active: false });
	assert.equal(u.item.phone, '0411');
	assert.equal(u.item.contactName, 'Sam');
	assert.equal(u.item.isActive, false);
	assert.equal((await dir.listCompanies(w.ctx)).items.length, 1);
	await rejects(dir.createCompany(w.ctx, { name: 'x', kind: 'nope' }), 400);
	await rejects(dir.createCompany(w.ctx, { name: 'x', kind: 'client', email: 'not-an-email' }), 400);
	await rejects(dir.createCompany(w.as(['viewer']), { name: 'x', kind: 'client' }), 403);
	await rejects(dir.updateCompany(w.ctx, '105747000009999999', { name: 'y' }), 404);
});

test('sites: address is stored as one object and edits keep the other parts', async () => {
	const w = makeWorld();
	const s = await dir.createSite(w.ctx, { name: 'Harbour Pylon', street: '1 Dock Rd', suburb: 'Docklands', state: 'VIC', post_code: '3008' });
	assert.equal(s.item.address, '1 Dock Rd, Docklands, VIC, 3008');
	const u = await dir.updateSite(w.ctx, s.item.id, { suburb: 'Southbank' });
	assert.equal(u.item.address, '1 Dock Rd, Southbank, VIC, 3008');
	await rejects(dir.createSite(w.as(['fab_manager']), { name: 'x' }), 403);
	assert.equal((await dir.listSites(w.as(['fab_manager']))).items.length, 1);
});

test('signs belong to a job: created, listed, edited; unknown job is a 404', async () => {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh' });
	const jobId = String(job.ROWID || job.id);
	const s = await dir.createSign(w.ctx, { job_id: jobId, name: 'Pylon A', qty: 2, install_date: '2026-12-01' });
	assert.equal(s.item.qty, 2);
	await dir.updateSign(w.ctx, s.item.id, { revision: 'B' });
	const list = await dir.listSigns(w.ctx, jobId);
	assert.equal(list.items[0].revision, 'B');
	await rejects(dir.createSign(w.ctx, { job_id: '105747000009999999', name: 'x' }), 404);
	await rejects(dir.createSign(w.as(['installer']), { job_id: jobId, name: 'x' }), 403);
});

test('companies and sites keep the DS address and contact fields; updating one field keeps the others', async () => {
	const w = makeWorld();
	const c = await dir.createCompany(w.ctx, { name: 'Acme Signs', kind: 'supplier', street: '5 Main St', suburb: 'Footscray', state: 'VIC', post_code: '3011' });
	assert.deepEqual([c.item.street, c.item.suburb, c.item.state, c.item.postCode], ['5 Main St', 'Footscray', 'VIC', '3011']);
	const cu = await dir.updateCompany(w.ctx, c.item.id, { suburb: 'Yarraville' });
	assert.equal(cu.item.suburb, 'Yarraville');
	assert.equal(cu.item.street, '5 Main St', 'other fields are kept');

	const s = await dir.createSite(w.ctx, { name: 'Harbour Pylon', contact_name: 'Pat', phone: '0400', country: 'Australia', notes: 'Loading dock round the back', access_notes: 'Key at security', business_hours: 'Mon-Fri 7-4', tenant_business: 'Dock Cafe', tenant_contact: 'Lee', tenant_email: 'lee@cafe.test', owner_name: 'Port Authority', owner_phone: '0390', site_code: 'VIC-DOCK-01' });
	assert.equal(s.item.siteCode, 'VIC-DOCK-01');
	assert.equal(s.item.notes, 'Loading dock round the back');
	assert.equal(s.item.accessNotes, 'Key at security');
	assert.equal(s.item.tenantBusiness, 'Dock Cafe');
	assert.equal(s.item.ownerName, 'Port Authority');
	assert.equal(s.item.contactName, 'Pat');
	const su = await dir.updateSite(w.ctx, s.item.id, { access_notes: 'Ask at reception' });
	assert.equal(su.item.accessNotes, 'Ask at reception');
	assert.equal(su.item.tenantBusiness, 'Dock Cafe', 'contact fields not sent are kept');
	assert.equal(su.item.contactName, 'Pat');
	assert.equal(su.item.siteCode, 'VIC-DOCK-01', 'the site code is kept too');
	assert.equal(su.item.notes, 'Loading dock round the back');
	await rejects(dir.createSite(w.ctx, { name: 'Bad', tenant_email: 'not-an-email' }), 400);
});

test('companies accept the Creator company types and still accept the older kinds', async () => {
	const w = makeWorld();
	for (const kind of ['Local - Installer', 'Local - Fabricator', 'Local - Supplier', 'Interstate - Installer', 'Interstate - Full Service', 'subcontractor']) {
		assert.equal((await dir.createCompany(w.ctx, { name: 'Co ' + kind, kind })).item.kind, kind);
	}
	await rejects(dir.createCompany(w.ctx, { name: 'Bad', kind: 'Overseas' }), 400);
});

test('company rates are for managers only: seen, saved and kept on a partial update', async () => {
	const w = makeWorld();
	const c = await dir.createCompany(w.ctx, { name: 'Rate Co', kind: 'Local - Installer', rates: { weekday_business: 85, saturday_day: 120, billing_notes: 'Invoice monthly' } });
	assert.equal(c.item.rates.weekday_business, 85);
	const u = await dir.updateCompany(w.ctx, c.item.id, { rates: { public_holiday: 200 } });
	assert.deepEqual([u.item.rates.weekday_business, u.item.rates.public_holiday, u.item.rates.billing_notes], [85, 200, 'Invoice monthly'], 'other rates are kept');
	assert.ok('rates' in (await dir.listCompanies(w.ctx)).items[0], 'a manager sees rates');
	await rejects(dir.createCompany(w.ctx, { name: 'Bad', kind: 'Local - Installer', rates: { weekday_business: -5 } }), 400);
	for (const role of ['viewer', 'second_ic', 'fab_worker']) {
		let list;
		try {
			list = await dir.listCompanies(w.as([role]));
		} catch (e) {
			assert.equal(e.status, 403); // the role cannot view companies at all
			continue;
		}
		assert.equal('rates' in list.items[0], false, role + ' must not get rates');
	}
	const fm = w.as(['fab_manager']);
	assert.ok('rates' in (await dir.listCompanies(fm)).items[0], 'a fab manager sees rates');
});

test('site contact from the CRM: does nothing until the fields are mapped; then fills only mapped, non-empty fields', async () => {
	const crmSite = require('../lib/domain/crmSite');
	assert.deepEqual(crmSite.SITE_CONTACT_FIELDS, {}, 'nothing is read from the CRM until the client sends the field names');
	const map = { contact_name: 'Site_Contact', phone: 'Site_Phone', business_hours: 'Hours', bogus: 'X' };
	assert.deepEqual(crmSite.contactFromCrmSite({ Site_Contact: { name: ' Jo ', id: '9' }, Site_Phone: 400111222, Hours: '', X: 'y' }, map), { contact_name: 'Jo', phone: '400111222' });

	const w = makeWorld();
	const reads = [];
	const zoho = { crm: { getRecord: async (module, id) => (reads.push([module, id]), { Site_Contact: 'Jo Smith', Site_Phone: '0400 111 222', Hours: '' }) } };
	const site = (await dir.createSite(w.ctx, { name: 'Westfield', contact_name: 'Old', business_hours: '9-5' })).item;

	const off = await dir.refreshSiteFromCrm({ ...w.ctx, zoho }, site.id);
	assert.equal(off.updated, false);
	assert.match(off.reason, /not set up/);
	assert.equal(reads.length, 0, 'no CRM call while unmapped');

	await rejects(dir.refreshSiteFromCrm({ ...w.ctx, zoho }, site.id, map), 409, 'no_crm_site');
	w.db.sites[0].crm_site_id = '5550001';
	await rejects(dir.refreshSiteFromCrm({ ...w.ctx, zoho: null }, site.id, map), 503);
	await rejects(dir.refreshSiteFromCrm({ ...w.as(['viewer']), zoho }, site.id, map), 403);

	const out = await dir.refreshSiteFromCrm({ ...w.ctx, zoho }, site.id, map);
	assert.deepEqual(reads.at(-1), ['Sites', '5550001']);
	assert.deepEqual([out.updated, out.fields], [true, ['contact_name', 'phone']]);
	assert.equal(out.item.contactName, 'Jo Smith');
	assert.equal(out.item.phone, '0400 111 222');
	assert.equal(out.item.businessHours, '9-5', 'an empty CRM field keeps what was typed');
	assert.equal((await dir.refreshSiteFromCrm({ ...w.ctx, zoho }, site.id, map)).updated, false, 'nothing new, no write');
});
