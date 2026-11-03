'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const { createZoho, isConfigured } = require('../lib/integrations/zoho');
const { createHandlers } = require('../lib/integrations/handlers');
const { drainOutbox } = require('../lib/services/outbox');
const { NotConfigured } = require('../lib/domain/outbox');
const integrations = require('../lib/services/integrations');
const jobs = require('../lib/services/jobs');

const ENV = { ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'id', ZOHO_CLIENT_SECRET: 'SECRET-VALUE', ZOHO_REFRESH_TOKEN: 'REFRESH-VALUE', WORKDRIVE_PARENT_FOLDER_ID: 'parent1' };

/** A fake network: records every call and answers from a list of handlers. */
function fakeNet(routes) {
	const calls = [];
	const fetchFn = async (url, init = {}) => {
		const u = String(url);
		calls.push({ url: u, method: init.method || 'GET', body: init.body && String(init.body), auth: init.headers && init.headers.Authorization });
		const r = routes(u, init, calls.length);
		return { ok: r.status < 400, status: r.status, json: async () => r.body };
	};
	return { fetchFn, calls };
}
const tokenOk = { status: 200, body: { access_token: 'ACCESS-1', expires_in: 3600 } };

test('it is off unless every setting is present', () => {
	assert.equal(isConfigured({}), false);
	assert.equal(isConfigured({ ...ENV, ZOHO_REFRESH_TOKEN: '' }), false);
	assert.equal(createZoho({ env: {} }), null);
	assert.ok(createZoho({ env: ENV }));
	assert.throws(() => createZoho({ env: { ...ENV, ZOHO_DC: 'in/evil' } }), /ZOHO_DC/);
});

test('the access token is fetched once and reused; calls go to the right data center', async () => {
	const net = fakeNet((u) => (u.includes('/oauth/v2/token') ? tokenOk : { status: 200, body: { data: [{ id: '1' }] } }));
	const z = createZoho({ env: ENV, fetchFn: net.fetchFn });
	await z.crm.ping();
	await z.crm.getDeal('42');
	assert.equal(net.calls.filter((c) => c.url.includes('/oauth/v2/token')).length, 1, 'one token request for two calls');
	assert.ok(net.calls[0].url.startsWith('https://accounts.zoho.in/'));
	assert.ok(net.calls[1].url.startsWith('https://www.zohoapis.in/crm/v8/'));
	assert.equal(net.calls[1].auth, 'Zoho-oauthtoken ACCESS-1');
});

test('a 401 refreshes the token once and retries', async () => {
	let first = true;
	const net = fakeNet((u) => {
		if (u.includes('/oauth/v2/token')) return tokenOk;
		if (first) {
			first = false;
			return { status: 401, body: {} };
		}
		return { status: 200, body: { data: [{ id: '9' }] } };
	});
	const z = createZoho({ env: ENV, fetchFn: net.fetchFn });
	assert.equal((await z.crm.getDeal('9')).id, '9');
	assert.equal(net.calls.filter((c) => c.url.includes('/oauth/v2/token')).length, 2);
});

test('updating a deal sends the fields; a rejection from the CRM is an error without any secret in it', async () => {
	const net = fakeNet((u, init) => (u.includes('/oauth/v2/token') ? tokenOk : { status: 200, body: { data: [{ status: 'error', message: 'INVALID_DATA' }] } }));
	const z = createZoho({ env: ENV, fetchFn: net.fetchFn });
	await assert.rejects(z.crm.updateDeal('42', { Stage: 'Won' }), /INVALID_DATA/);
	assert.deepEqual(JSON.parse(net.calls.at(-1).body), { data: [{ Stage: 'Won' }] });
	assert.equal(net.calls.at(-1).method, 'PUT');
});

test('bad credentials give a clear message that never contains the secret', async () => {
	const net = fakeNet(() => ({ status: 400, body: { error: 'invalid_client' } }));
	const z = createZoho({ env: ENV, fetchFn: net.fetchFn });
	try {
		await z.crm.ping();
		assert.fail('should have thrown');
	} catch (e) {
		assert.match(e.message, /invalid_client/);
		assert.ok(!e.message.includes('SECRET-VALUE') && !e.message.includes('REFRESH-VALUE'));
	}
});

test('WorkDrive: folder is created in the parent and its id and link returned', async () => {
	const net = fakeNet((u) => (u.includes('/oauth/v2/token') ? tokenOk : { status: 201, body: { data: { id: 'f1', attributes: { permalink: 'https://workdrive.zoho.in/folder/f1' } } } }));
	const z = createZoho({ env: ENV, fetchFn: net.fetchFn });
	const folder = await z.workdrive.createFolder('parent1', 'Pylon refresh');
	assert.deepEqual(folder, { id: 'f1', url: 'https://workdrive.zoho.in/folder/f1' });
	assert.equal(JSON.parse(net.calls.at(-1).body).data.attributes.parent_id, 'parent1');
});

test('the job folder handler: waits when not connected, creates once, and a rerun does nothing', async () => {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Pylon refresh' });
	const jobId = String(job.ROWID);
	const payload = { jobId, jobName: 'Pylon refresh' };

	await assert.rejects(createHandlers({ repos: w.ctx.repos })['workdrive.create_job_folder'](payload), NotConfigured);

	let made = 0;
	const deps = { repos: w.ctx.repos, parentFolderId: 'parent1', workdrive: { createFolder: async () => (made++, { id: 'f1', url: 'https://x/f1' }) } };
	const handler = createHandlers(deps)['workdrive.create_job_folder'];
	await handler(payload);
	await handler(payload);
	assert.equal(made, 1);
	assert.equal(w.db.jobs[0].workdrive_folder_id, 'f1');
});

test('creating a job queues its folder once; draining while not connected keeps it waiting', async () => {
	const w = makeWorld();
	await jobs.createJob(w.ctx, { name: 'Pylon refresh' });
	assert.equal(w.db.outbox.length, 1);
	assert.equal(w.db.outbox[0].job_type, 'workdrive.create_job_folder');
	const out = await drainOutbox(w.ctx, createHandlers({ repos: w.ctx.repos }));
	assert.equal(out.waiting, 1);
	assert.equal(w.db.outbox[0].job_status, 'Pending');
});

test('the admin check reports not-configured, connected, and failures; only admins may call it', async () => {
	const w = makeWorld();
	const none = await integrations.status({ ...w.ctx, zoho: null });
	assert.equal(none.crm.configured, false);

	const ok = { crm: { ping: async () => ({}) }, workdrive: { ping: async () => ({}) }, parentFolderId: 'p' };
	const good = await integrations.status({ ...w.ctx, zoho: ok });
	assert.equal(good.crm.ok, true);
	assert.equal(good.workdriveFolderSet, true);

	const bad = { crm: { ping: async () => { throw new Error('boom token=abc123'); } }, workdrive: ok.workdrive, parentFolderId: null };
	const mixed = await integrations.status({ ...w.ctx, zoho: bad });
	assert.equal(mixed.crm.ok, false);
	assert.ok(!mixed.crm.message.includes('abc123'), 'secrets are hidden');
	assert.equal(mixed.workdrive.ok, true);

	await rejects(integrations.status({ ...w.as(['project_manager']), zoho: ok }), 403);
});

test('the folder check: found, not a folder, refused, and not set', async () => {
	const w = makeWorld();
	const mk = (folder) => ({ crm: { ping: async () => ({}) }, workdrive: { ping: async () => ({}), getFolder: folder }, parentFolderId: 'p' });
	const found = await integrations.status({ ...w.ctx, zoho: mk(async () => ({ name: 'Jobs', isFolder: true })) });
	assert.equal(found.workdriveFolder.ok, true);
	assert.match(found.workdriveFolder.message, /Jobs/);
	assert.equal((await integrations.status({ ...w.ctx, zoho: mk(async () => ({ name: 'x', isFolder: false })) })).workdriveFolder.ok, false);
	const refused = await integrations.status({ ...w.ctx, zoho: mk(async () => { throw new Error('Zoho GET /files/p failed (HTTP 401): F7003 Unauthorized access'); }) });
	assert.equal(refused.workdriveFolder.ok, false);
	assert.match(refused.workdriveFolder.message, /F7003/);
	const unset = await integrations.status({ ...w.ctx, zoho: { ...mk(async () => ({})), parentFolderId: null } });
	assert.equal(unset.workdriveFolder.configured, false);
});

test('WorkDrive getFolder reads the folder and a refusal carries the HTTP status and Zoho error id', async () => {
	const ok = fakeNet((u) => (u.includes('/oauth/v2/token') ? tokenOk : { status: 200, body: { data: { attributes: { name: 'Jobs', is_folder: true } } } }));
	assert.deepEqual(await createZoho({ env: ENV, fetchFn: ok.fetchFn }).workdrive.getFolder('abc'), { name: 'Jobs', type: null, isFolder: true });
	const no = fakeNet((u) => (u.includes('/oauth/v2/token') ? tokenOk : { status: 401, body: { errors: [{ id: 'F7003', title: 'Unauthorized access' }] } }));
	await assert.rejects(createZoho({ env: ENV, fetchFn: no.fetchFn }).workdrive.getFolder('abc'), /HTTP 401.*F7003 Unauthorized access/);
});
