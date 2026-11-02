'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const jobs = require('../lib/services/jobs');
const tasks = require('../lib/services/tasks');
const files = require('../lib/services/files');
const d = require('../lib/domain/files');

const MB = 1024 * 1024;
const CREW = '105747000000900001';

test('rules: allowed types and sizes, safe names, unique keys', () => {
	assert.deepEqual(d.checkUpload({ mimeType: 'image/jpeg', sizeBytes: 2 * MB }), { ok: true, kind: 'photo' });
	assert.equal(d.checkUpload({ mimeType: 'application/pdf', sizeBytes: 20 * MB }).kind, 'document');
	assert.equal(d.checkUpload({ mimeType: 'image/jpeg', sizeBytes: 16 * MB }).ok, false);
	assert.equal(d.checkUpload({ mimeType: 'application/x-msdownload', sizeBytes: 100 }).ok, false);
	assert.equal(d.checkUpload({ mimeType: 'image/png', sizeBytes: 0 }).ok, false);
	assert.equal(d.safeName('../../etc/passwd'), 'passwd');
	assert.equal(d.safeName('Site photo (1).JPG'), 'Site_photo_1.JPG');
	assert.equal(d.safeName(''), 'file');
	assert.equal(d.storageKey('task', '123', 'ab12', 'a b.png'), 'task/123/ab12-a_b.png');
});

async function setup() {
	const w = makeWorld();
	const { job } = await jobs.createJob(w.ctx, { name: 'Job' });
	const { task } = await tasks.createTask(w.ctx, job.ROWID, { task_type: 'fabrication', name: 'Fab' });
	await tasks.addAssignee(w.ctx, task.ROWID, { person_id: CREW, role: 'lead' });
	return { w, task, crew: w.as(['fab_worker'], CREW) };
}
const photo = (task, extra = {}) => ({ entity_type: 'task', entity_id: String(task.ROWID), file_name: 'front view.jpg', mime_type: 'image/jpeg', size_bytes: 1 * MB, ...extra });

test('upload: a signed link is issued, the file is listed and downloadable only after it is confirmed', async () => {
	const { w, task, crew } = await setup();
	const up = await files.requestUpload(crew, photo(task));
	assert.match(up.uploadUrl, /^https:\/\/put\.test\/task\/\d+\/[0-9a-f]{8}-front_view\.jpg$/);
	assert.equal(up.file.uploaded, false);
	assert.equal(w.db.files[0].file_kind, 'photo');

	assert.deepEqual((await files.listFiles(crew, { entity_type: 'task', entity_id: String(task.ROWID) })).items, []);
	await rejects(files.downloadUrl(crew, up.file.id), 409, 'not_uploaded');

	const done = await files.confirmUpload(crew, up.file.id);
	assert.equal(done.file.uploaded, true);
	assert.ok(w.published.some((p) => p.type === 'file.uploaded'));
	assert.equal((await files.listFiles(crew, { entity_type: 'task', entity_id: String(task.ROWID) })).items.length, 1);
	assert.match((await files.downloadUrl(crew, up.file.id)).url, /^https:\/\/get\.test\//);
});

test('upload: bad types and sizes are refused before any link is issued', async () => {
	const { w, task, crew } = await setup();
	await rejects(files.requestUpload(crew, photo(task, { mime_type: 'application/zip' })), 400);
	await rejects(files.requestUpload(crew, photo(task, { size_bytes: 99 * MB })), 400);
	await rejects(files.requestUpload(crew, photo(task, { entity_type: 'job' })), 400);
	assert.equal(w.db.files.length, 0);
});

test('access follows the task: outsiders get 404; only the uploader confirms', async () => {
	const { task, crew, w } = await setup();
	const outsider = w.as(['fab_worker'], '105747000000900003');
	await rejects(files.requestUpload(outsider, photo(task)), 404);

	const up = await files.requestUpload(crew, photo(task));
	await rejects(files.confirmUpload(outsider, up.file.id), 404);
	await files.confirmUpload(crew, up.file.id);
	await rejects(files.downloadUrl(outsider, up.file.id), 404);
	await rejects(files.listFiles(outsider, { entity_type: 'task', entity_id: String(task.ROWID) }), 404);

	const pm = w.as(['project_manager'], '105747000000900002');
	assert.ok((await files.downloadUrl(pm, up.file.id)).url);
});

test('issue files: a read-only viewer cannot add one, a reporter can add to their own issue only', async () => {
	const w = makeWorld({ roles: ['installer'] });
	const issues = require('../lib/services/issues');
	const { issue } = await issues.createIssue(w.ctx, { subject: 'Mine' });
	w.db.issues.push({ ROWID: '105747000001999555', subject: 'Not mine', reported_by_id: '105747000000900003', issue_status: 'Open' });
	const body = (id) => ({ entity_type: 'issue', entity_id: String(id), file_name: 'a.jpg', mime_type: 'image/jpeg', size_bytes: 1000 });

	// A viewer may see issues but must not attach files to them.
	await rejects(files.requestUpload(w.as(['viewer'], '105747000000900004'), body(issue.ROWID)), 403);
	assert.equal(w.db.files.length, 0, 'no record and no upload link');

	// The reporter can attach to their own issue, but not to someone else's.
	assert.ok((await files.requestUpload(w.ctx, body(issue.ROWID))).uploadUrl);
	await rejects(files.requestUpload(w.ctx, body('105747000001999555')), 404);

	// Viewing files is still allowed for viewers.
	await files.listFiles(w.as(['viewer'], '105747000000900004'), { entity_type: 'issue', entity_id: String(issue.ROWID) });
});
