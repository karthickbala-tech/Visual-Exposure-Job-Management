'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { can, projectRow } = require('../lib/authz');
const { ROLES } = require('../lib/config');

test('admin can do everything on any resource', () => {
	for (const verb of ['view', 'create', 'edit', 'delete']) {
		assert.equal(can(['admin'], 'jobs', verb).allowed, true);
		assert.equal(can(['admin'], 'anything', verb).allowed, true);
	}
});

test('unknown roles and empty roles are denied', () => {
	assert.equal(can([], 'jobs', 'view').allowed, false);
	assert.equal(can(['hacker'], 'jobs', 'view').allowed, false);
	assert.equal(can(undefined, 'jobs', 'view').allowed, false);
});

test('unlisted resources and verbs are denied (deny by default)', () => {
	assert.equal(can(['project_manager'], 'jobs', 'delete').allowed, false);
	assert.equal(can(['project_manager'], 'payroll', 'view').allowed, false);
	assert.equal(can(['viewer'], 'jobs', 'edit').allowed, false);
});

test('field crews only see assigned jobs', () => {
	for (const role of ['installer', 'fab_worker', 'workshop', 'designer', 'contractor']) {
		const g = can([role], 'jobs', 'view');
		assert.equal(g.allowed, true, role);
		assert.equal(g.scope, 'assigned', role);
	}
});

test('every defined role has at least one grant', () => {
	for (const role of ROLES) {
		assert.equal(
			can([role], 'jobs', 'view').allowed,
			true,
			`${role} should be able to view jobs in some scope`
		);
	}
});

test('widest scope wins when a user holds several roles', () => {
	assert.equal(can(['installer', 'project_manager'], 'jobs', 'view').scope, 'all');
});

test('costs are hidden from everyone except admin', () => {
	const job = { name: 'J', design_cost: 1, fab_cost: 2, install_cost: 3, flags: '{}' };
	assert.equal('fab_cost' in projectRow(['project_manager'], 'jobs', job), false);
	assert.equal('flags' in projectRow(['project_manager'], 'jobs', job), false);
	assert.equal(projectRow(['admin'], 'jobs', job).fab_cost, 2);
	assert.equal(projectRow(['project_manager'], 'jobs', job).name, 'J');
});

test('private profile and hourly rate never reach non-admins', () => {
	const person = { first_name: 'A', hourly_rate: 55, profile_private: 'secret' };
	const forPm = projectRow(['project_manager'], 'people', person);
	assert.equal('hourly_rate' in forPm, false);
	assert.equal('profile_private' in forPm, false);
	const forAdmin = projectRow(['admin'], 'people', person);
	assert.equal(forAdmin.hourly_rate, 55);
	assert.equal('profile_private' in forAdmin, false, 'profile_private is never sent');
});
