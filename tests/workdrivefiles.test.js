'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const files = require('../lib/services/files');
const { createHandlers } = require('../lib/integrations/handlers');
const { createZoho } = require('../lib/integrations/zoho');

async function setup() {
	const w = makeWorld();
	w.ctx.storage = { signedPut: async () => 'u', signedGet: async () => 'g' };
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon' })).job;
	const task = (await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'design', name: 'Art' })).task;
	const up = await files.requestUpload(w.ctx, { entity_type: 'task', entity_id: String(task.ROWID), file_name: 'front view.jpg', mime_type: 'image/jpeg', size_bytes: 1000 });
	await files.confirmUpload(w.ctx, up.file.id);
	return { w, job, task, fileId: up.file.id };
}

test('confirming an upload queues one WorkDrive copy, once, however often it is confirmed', async () => {
	const { w, fileId } = await setup();
	await files.confirmUpload(w.ctx, fileId);
	const rows = w.db.outbox.filter((o) => o.job_type === 'workdrive.upload_file');
	assert.equal(rows.length, 1);
	assert.deepEqual(JSON.parse(rows[0].payload), { fileId });
});

test('the copy job uploads the stored bytes into the job folder', async () => {
	const { w, job, fileId } = await setup();
	w.db.jobs.find((j) => String(j.ROWID) === String(job.ROWID)).workdrive_folder_id = 'F123';
	const sent = [];
	const handlers = createHandlers({
		repos: w.ctx.repos,
		workdrive: { uploadFile: async (parent, name, bytes, mime) => sent.push({ parent, name, size: bytes.length, mime }) },
		storage: { getBytes: async () => Buffer.from('abc') },
	});
	await handlers['workdrive.upload_file']({ fileId });
	assert.deepEqual(sent, [{ parent: 'F123', name: 'front view.jpg', size: 3, mime: 'image/jpeg' }]);
});

test('the copy job waits when WorkDrive is off or the job has no folder yet, and skips deleted files', async () => {
	const { w, fileId } = await setup();
	const base = { repos: w.ctx.repos, storage: { getBytes: async () => Buffer.from('x') }, workdrive: { uploadFile: async () => {} } };
	await assert.rejects(createHandlers({ ...base, workdrive: null })['workdrive.upload_file']({ fileId }), /not configured/i);
	await assert.rejects(createHandlers(base)['workdrive.upload_file']({ fileId }), /not ready/);
	w.db.files.find((f) => String(f.ROWID) === String(fileId)).is_deleted = 'true';
	await createHandlers(base)['workdrive.upload_file']({ fileId }); // deleted before it was copied: nothing to do, no error
});

test('the WorkDrive client sends the file as a multipart upload with the folder in the address', async () => {
	const calls = [];
	const fetchFn = async (u, init) => {
		calls.push({ u: String(u), init });
		if (String(u).includes('/oauth/v2/token')) return { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) };
		return { ok: true, status: 200, json: async () => ({ data: [{ attributes: { resource_id: 'R1' } }] }) };
	};
	const zoho = createZoho({ env: { ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c' }, fetchFn });
	const out = await zoho.workdrive.uploadFile('FOLDER9', 'a b.pdf', Buffer.from('%PDF'), 'application/pdf');
	assert.deepEqual(out, { id: 'R1' });
	const up = calls.find((c) => c.u.includes('/upload'));
	assert.match(up.u, /workdrive\.zoho\.in\/api\/v1\/upload\?parent_id=FOLDER9/);
	assert.ok(up.init.body instanceof FormData);
	assert.equal(up.init.headers.Authorization, 'Zoho-oauthtoken t');
});

test('confirming an upload that never reached storage is refused and nothing is queued', async () => {
	const w = makeWorld();
	w.ctx.storage = { signedPut: async () => 'u', signedGet: async () => 'g', exists: async () => false };
	const job = (await jobs.createJob(w.ctx, { name: 'Pylon' })).job;
	const task = (await tasks.createTask(w.ctx, String(job.ROWID), { task_type: 'design', name: 'Art' })).task;
	const up = await files.requestUpload(w.ctx, { entity_type: 'task', entity_id: String(task.ROWID), file_name: 'a.png', mime_type: 'image/png', size_bytes: 10 });
	await assert.rejects(files.confirmUpload(w.ctx, up.file.id), (e) => e.status === 409 && e.code === 'not_uploaded');
	assert.equal(w.db.outbox.filter((o) => o.job_type === 'workdrive.upload_file').length, 0);
	w.ctx.storage.exists = async () => true;
	assert.equal((await files.confirmUpload(w.ctx, up.file.id)).file.uploaded, true);
});
