'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const people = require('../lib/services/people');
const P = require('../lib/domain/profile');

test('rules: admin sees and edits everything, managers see four fields and edit three, the person sees their own', () => {
	assert.equal(P.viewableFields(['admin'], false).length, P.KEYS.length);
	assert.deepEqual(P.viewableFields(['project_manager'], false).sort(), ['cessation_date', 'emergency_contact', 'skills', 'start_date']);
	assert.deepEqual(P.editableFields(['fab_manager']).sort(), ['cessation_date', 'skills', 'start_date']);
	assert.equal(P.viewableFields(['installer'], true).length, P.KEYS.length, 'a person sees their own');
	assert.deepEqual(P.editableFields(['installer']), [], 'but cannot change them');
	assert.deepEqual(P.viewableFields(['installer'], false), []);
	assert.deepEqual(P.viewableFields(['viewer'], false), []);
});

test('personal details: stored by role, validated, cleared, and never leaked', async () => {
	const w = makeWorld();
	const sam = String((await people.createPerson(w.ctx, { first_name: 'Sam', email: 'sam@example.test', roles: ['installer'] })).person.ROWID);
	const other = String((await people.createPerson(w.ctx, { first_name: 'Olly', email: 'olly@example.test', roles: ['installer'] })).person.ROWID);
	const pm = w.as(['project_manager'], '105747000000900002');
	const self = w.as(['installer'], sam);
	const stranger = w.as(['installer'], other);

	const saved = await people.updateProfile(w.ctx, sam, { address: '1 Dock Rd, Docklands', date_of_birth: '1990-05-17', sex: 'Prefer not to answer', personal_email: 'sam@home.test', start_date: '2024-02-01', skills: 'Working at heights', emergency_contact: 'Alex 0400 000 000' });
	assert.equal(saved.fields.length, 8);
	assert.equal(saved.fields.find((f) => f.key === 'address').value, '1 Dock Rd, Docklands');

	// a manager sees four fields and can change the work ones
	const asPm = await people.getProfile(pm, sam);
	assert.deepEqual(asPm.fields.map((f) => f.key).sort(), ['cessation_date', 'emergency_contact', 'skills', 'start_date']);
	assert.deepEqual(asPm.fields.filter((f) => f.editable).map((f) => f.key).sort(), ['cessation_date', 'skills', 'start_date']);
	await people.updateProfile(pm, sam, { cessation_date: '2026-12-01', skills: 'Heights, EWP' });
	await rejects(people.updateProfile(pm, sam, { address: 'x' }), 403);
	await rejects(people.updateProfile(pm, sam, { sex: 'Male' }), 403);

	// the person sees all of their own, cannot change them; someone else sees nothing
	assert.equal((await people.getProfile(self, sam)).fields.length, 8);
	await rejects(people.updateProfile(self, sam, { skills: 'x' }), 403);
	await rejects(people.getProfile(stranger, sam), 403);
	await rejects(people.updateProfile(stranger, sam, { skills: 'x' }), 403);

	// validation
	await rejects(people.updateProfile(w.ctx, sam, { date_of_birth: '17/05/1990' }), 400);
	await rejects(people.updateProfile(w.ctx, sam, { sex: 'Unknown' }), 400);
	await rejects(people.updateProfile(w.ctx, sam, { personal_email: 'not-an-email' }), 400);
	await rejects(people.updateProfile(w.ctx, sam, { favourite_colour: 'green' }), 400);

	// an empty value clears the field; other fields are kept
	const cleared = await people.updateProfile(w.ctx, sam, { skills: '' });
	assert.equal(cleared.fields.find((f) => f.key === 'skills').value, '');
	assert.equal(cleared.fields.find((f) => f.key === 'address').value, '1 Dock Rd, Docklands');

	// the raw column never comes back from the people API, and the log holds field names, not values
	assert.equal('profile_private' in (await people.getPerson(w.ctx, sam)).person, false);
	assert.equal('profile_private' in (await people.listPeople(w.ctx)).items[0], false);
	const logged = JSON.stringify(w.db.activity.filter((a) => a.activity_type === 'profile_changed'));
	assert.match(logged, /address/);
	assert.equal(/Docklands|1990-05-17|0400/.test(logged), false, 'no values in the activity log');
});
