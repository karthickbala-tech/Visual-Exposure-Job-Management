'use strict';

const { createRouter, parseQuery } = require('./lib/http');
const { projectRow } = require('./lib/authz');
const { withBooleans } = require('./lib/db');
const { listJobs } = require('./lib/services/jobs');

const router = createRouter();

/** Liveness check. Public, reveals nothing about the project. */
router.add('GET', '/health', async () => ({ status: 200, body: { ok: true } }), { public: true });

/** Who am I? Used by the web app right after login. */
router.add('GET', '/me', async ({ actor }) => {
	const person = actor.person
		? projectRow(actor.roles, 'people', withBooleans(actor.person, ['is_active', 'is_internal', 'is_deleted']))
		: null;
	return {
		status: 200,
		body: {
			user: {
				id: actor.user.user_id,
				email: actor.user.email_id,
				firstName: actor.user.first_name,
				lastName: actor.user.last_name,
			},
			roles: actor.roles,
			person,
		},
	};
});

router.add('GET', '/jobs', async ({ actor, url }) => {
	const result = await listJobs(actor, parseQuery(url));
	return { status: 200, body: result };
});

module.exports = { router };
