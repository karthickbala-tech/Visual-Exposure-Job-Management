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
