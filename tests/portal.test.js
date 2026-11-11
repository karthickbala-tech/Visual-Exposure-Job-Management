'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const compliance = require('../lib/services/compliance');

const ME = '105747000000900001';

test('training portal logins: managers only, the password is only sent on a logged reveal, and no list or edit returns it', async () => {
	const w = makeWorld();
	w.db.ctypes.push({ ROWID: '105747000001500001', name: 'Working at Heights', compliance_kind: 'ticket', requires_expiry: 'true', reminder_offsets: '[30,14,7,0]' });
	const made = await compliance.createItem(w.ctx, { type_id: '105747000001500001', person_id: ME, reference_no: 'WAH-1', expiry_date: '2027-06-01' });
	const id = String(made.item.id);
	const pm = w.as(['project_manager'], '105747000000900002');

	const set = await compliance.setPortal(pm, id, { login: 'sam.installer', password: 'S3cret-pass' });
	assert.deepEqual(set, { itemId: id, login: 'sam.installer', hasPassword: true });
	assert.equal(JSON.stringify(set).includes('S3cret'), false, 'the password is never in the response to a change');

	const got = await compliance.getPortal(pm, id);
	assert.deepEqual([got.login, got.hasPassword], ['sam.installer', true]);
	assert.equal('password' in got, false, 'a normal read does not send the password');

	const before = w.db.activity.length;
	assert.equal((await compliance.revealPortalPassword(pm, id)).password, 'S3cret-pass');
	assert.equal(w.db.activity.length, before + 1);
	assert.equal(w.db.activity.at(-1).activity_type, 'portal_viewed', 'a reveal is logged');
	assert.equal(JSON.stringify(w.db.activity).includes('S3cret'), false, 'no value in the activity log');

	// the item itself and the lists never carry the login
	assert.equal('portal_login' in (await compliance.updateItem(pm, id, { reference_no: 'WAH-2' })).item, false);
	assert.equal(JSON.stringify(await compliance.listItems(w.ctx)).includes('sam.installer'), false);

	// partial change keeps the other part; an empty value clears it
	await compliance.setPortal(pm, id, { login: 'sam.new' });
	assert.equal((await compliance.revealPortalPassword(pm, id)).password, 'S3cret-pass');
	await compliance.setPortal(pm, id, { password: '' });
	assert.equal((await compliance.getPortal(pm, id)).hasPassword, false);

	// only managers: crew and viewers are refused everywhere; unknown fields are refused
	for (const role of ['installer', 'fab_worker', 'viewer']) {
		const c = w.as([role], ME);
		await rejects(compliance.getPortal(c, id), 403);
		await rejects(compliance.revealPortalPassword(c, id), 403);
		await rejects(compliance.setPortal(c, id, { login: 'x' }), 403);
	}
	await rejects(compliance.setPortal(pm, id, { note: 'x' }), 400);
	await rejects(compliance.getPortal(pm, '105747000009999999'), 404);
});
