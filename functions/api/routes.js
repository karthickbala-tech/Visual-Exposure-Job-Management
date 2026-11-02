'use strict';

const { createRouter, parseQuery, readJson } = require('./lib/http');
const { projectRow, permissionsFor } = require('./lib/authz');
const { withBooleans } = require('./lib/db');
const { makeContext } = require('./lib/context');
const jobs = require('./lib/services/jobs');
const tasks = require('./lib/services/tasks');

const router = createRouter();

const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });

/** Handlers receive { req, url, params, actor, log }. Build the per-request context once. */
const withCtx = (fn) => (args) => fn(makeContext(args.actor, args.log), args);

/** Liveness check. Public, reveals nothing about the project. */
router.add('GET', '/health', async () => ok({ ok: true }), { public: true });

/** Who am I? Used by the web app right after login. */
router.add('GET', '/me', async ({ actor }) => {
	const person = actor.person
		? projectRow(actor.roles, 'people', withBooleans(actor.person, ['is_active', 'is_internal', 'is_deleted']))
		: null;
	return ok({
		user: {
			id: actor.user.user_id,
			email: actor.user.email_id,
			firstName: actor.user.first_name,
			lastName: actor.user.last_name,
		},
		roles: actor.roles,
		permissions: permissionsFor(actor.roles),
		person,
	});
});

// Jobs
router.add('GET', '/jobs', withCtx(async (ctx, { url }) => ok(await jobs.listJobs(ctx, parseQuery(url)))));
router.add('POST', '/jobs', withCtx(async (ctx, { req }) => created(await jobs.createJob(ctx, await readJson(req)))));
router.add('GET', '/jobs/:id', withCtx(async (ctx, { params }) => ok(await jobs.getJob(ctx, params.id))));
router.add('PATCH', '/jobs/:id', withCtx(async (ctx, { req, params }) => ok(await jobs.updateJob(ctx, params.id, await readJson(req)))));
router.add('POST', '/jobs/:id/tasks', withCtx(async (ctx, { req, params }) => created(await tasks.createTask(ctx, params.id, await readJson(req)))));

// Tasks
router.add('GET', '/tasks', withCtx(async (ctx, { url }) => ok(await tasks.listTasks(ctx, parseQuery(url)))));
router.add('GET', '/tasks/:id', withCtx(async (ctx, { params }) => ok(await tasks.getTask(ctx, params.id))));
router.add('PATCH', '/tasks/:id', withCtx(async (ctx, { req, params }) => ok(await tasks.updateTask(ctx, params.id, await readJson(req)))));
router.add('POST', '/tasks/:id/transition', withCtx(async (ctx, { req, params }) => ok(await tasks.transitionTask(ctx, params.id, await readJson(req)))));
router.add('POST', '/tasks/:id/assignees', withCtx(async (ctx, { req, params }) => created(await tasks.addAssignee(ctx, params.id, await readJson(req)))));
router.add('DELETE', '/tasks/:id/assignees/:personId', withCtx(async (ctx, { params }) => ok(await tasks.removeAssignee(ctx, params.id, params.personId))));

module.exports = { router };
