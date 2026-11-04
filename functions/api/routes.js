'use strict';

const { createRouter, parseQuery, readJson, readLooseBody } = require('./lib/http');
const { projectRow, permissionsFor } = require('./lib/authz');
const { withBooleans } = require('./lib/db');
const { makeContext } = require('./lib/context');
const jobs = require('./lib/services/jobs');
const tasks = require('./lib/services/tasks');
const checklists = require('./lib/services/checklists');
const admin = require('./lib/services/admin');
const issues = require('./lib/services/issues');
const swms = require('./lib/services/swms');
const files = require('./lib/services/files');
const dashboard = require('./lib/services/dashboard');
const settings = require('./lib/services/settings');
const catalyst = require('zcatalyst-sdk-node');
const { createDb } = require('./lib/db');
const crmWebhook = require('./lib/services/crmWebhook');
const people = require('./lib/services/people');
const compliance = require('./lib/services/compliance');
const registers = require('./lib/services/registers');
const outbox = require('./lib/services/outbox');
const directory = require('./lib/services/directory');
const integrations = require('./lib/services/integrations');
const quotes = require('./lib/services/quotes');
const crmPull = require('./lib/services/crmPull');
const { createZoho } = require('./lib/integrations/zoho');

const router = createRouter();

const ok = (body) => ({ status: 200, body });
const created = (body) => ({ status: 201, body });

/** Handlers receive { req, url, params, actor, log }. Build the per-request context once. */
// The Zoho client is built once per warm instance (null when the ZOHO_ settings are not set).
let zohoClient;
let zohoBuilt = false;
const zoho = () => {
	if (!zohoBuilt) {
		zohoClient = createZoho();
		zohoBuilt = true;
	}
	return zohoClient;
};

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
		permissions: permissionsFor(actor.roles, actor.matrix),
		person,
	});
});

// Jobs
router.add('GET', '/jobs', withCtx(async (ctx, { url }) => ok(await jobs.listJobs(ctx, parseQuery(url)))));
router.add('POST', '/jobs', withCtx(async (ctx, { req }) => created(await jobs.createJob(ctx, await readJson(req)))));
router.add('GET', '/jobs/:id', withCtx(async (ctx, { params }) => ok(await jobs.getJob(ctx, params.id))));
router.add('PATCH', '/jobs/:id', withCtx(async (ctx, { req, params }) => ok(await jobs.updateJob(ctx, params.id, await readJson(req)))));
router.add('POST', '/jobs/:id/close', withCtx(async (ctx, { params }) => ok(await jobs.closeJob(ctx, params.id))));
router.add('POST', '/tasks/:id/subtasks', withCtx(async (ctx, { params }) => created(await tasks.createSubtask(ctx, params.id))));
router.add('POST', '/jobs/:id/tasks', withCtx(async (ctx, { req, params }) => created(await tasks.createTask(ctx, params.id, await readJson(req)))));

// Tasks
router.add('GET', '/tasks', withCtx(async (ctx, { url }) => ok(await tasks.listTasks(ctx, parseQuery(url)))));
router.add('GET', '/tasks/:id', withCtx(async (ctx, { params }) => ok(await tasks.getTask(ctx, params.id))));
router.add('PATCH', '/tasks/:id', withCtx(async (ctx, { req, params }) => ok(await tasks.updateTask(ctx, params.id, await readJson(req)))));
router.add('POST', '/tasks/:id/transition', withCtx(async (ctx, { req, params }) => ok(await tasks.transitionTask(ctx, params.id, await readJson(req)))));
router.add('POST', '/tasks/:id/assignees', withCtx(async (ctx, { req, params }) => created(await tasks.addAssignee(ctx, params.id, await readJson(req)))));
router.add('DELETE', '/tasks/:id/assignees/:personId', withCtx(async (ctx, { params }) => ok(await tasks.removeAssignee(ctx, params.id, params.personId))));

// Checklists
router.add('GET', '/tasks/:id/checklists', withCtx(async (ctx, { params }) => ok(await checklists.listForTask(ctx, params.id))));
router.add('POST', '/tasks/:id/checklists', withCtx(async (ctx, { req, params }) => created(await checklists.startChecklist(ctx, params.id, await readJson(req)))));
router.add('GET', '/checklists/:id', withCtx(async (ctx, { params }) => ok(await checklists.getChecklist(ctx, params.id))));
router.add('PATCH', '/checklists/:id/answers', withCtx(async (ctx, { req, params }) => ok(await checklists.saveAnswers(ctx, params.id, await readJson(req)))));
router.add('POST', '/checklists/:id/complete', withCtx(async (ctx, { req, params }) => ok(await checklists.completeChecklist(ctx, params.id, await readJson(req)))));

// Issues
router.add('GET', '/issues', withCtx(async (ctx, { url }) => ok(await issues.listIssues(ctx, parseQuery(url)))));
router.add('POST', '/issues', withCtx(async (ctx, { req }) => created(await issues.createIssue(ctx, await readJson(req)))));
router.add('GET', '/issues/:id', withCtx(async (ctx, { params }) => ok(await issues.getIssue(ctx, params.id))));
router.add('PATCH', '/issues/:id', withCtx(async (ctx, { req, params }) => ok(await issues.updateIssue(ctx, params.id, await readJson(req)))));

// SWMS
router.add('GET', '/swms/:id', withCtx(async (ctx, { params }) => ok(await swms.getSwms(ctx, params.id))));
router.add('PATCH', '/swms/:id', withCtx(async (ctx, { req, params }) => ok(await swms.updateSwms(ctx, params.id, await readJson(req)))));
router.add('POST', '/swms/:id/sign', withCtx(async (ctx, { req, params }) => ok(await swms.signSwms(ctx, params.id, await readJson(req)))));
router.add('POST', '/swms/:id/declare', withCtx(async (ctx, { params }) => created(await swms.declare(ctx, params.id))));

// Files
router.add('GET', '/files', withCtx(async (ctx, { url }) => ok(await files.listFiles(ctx, parseQuery(url)))));
router.add('POST', '/files/upload-url', withCtx(async (ctx, { req }) => created(await files.requestUpload(ctx, await readJson(req)))));
router.add('POST', '/files/:id/confirm', withCtx(async (ctx, { params }) => ok(await files.confirmUpload(ctx, params.id))));
router.add('GET', '/files/:id/download-url', withCtx(async (ctx, { params }) => ok(await files.downloadUrl(ctx, params.id))));

// People and compliance
router.add('GET', '/people', withCtx(async (ctx, { url }) => ok(await people.listPeople(ctx, parseQuery(url)))));
router.add('POST', '/people', withCtx(async (ctx, { req }) => created(await people.createPerson(ctx, await readJson(req)))));
router.add('GET', '/people/:id', withCtx(async (ctx, { params }) => ok(await people.getPerson(ctx, params.id))));
router.add('PATCH', '/people/:id', withCtx(async (ctx, { req, params }) => ok(await people.updatePerson(ctx, params.id, await readJson(req)))));
router.add('GET', '/compliance/types', withCtx(async (ctx) => ok(await compliance.listTypes(ctx))));
router.add('GET', '/compliance', withCtx(async (ctx, { url }) => ok(await compliance.listItems(ctx, parseQuery(url)))));
router.add('POST', '/compliance', withCtx(async (ctx, { req }) => created(await compliance.createItem(ctx, await readJson(req)))));
router.add('PATCH', '/compliance/:id', withCtx(async (ctx, { req, params }) => ok(await compliance.updateItem(ctx, params.id, await readJson(req)))));
// Companies, sites, signs
router.add('GET', '/companies', withCtx(async (ctx, { url }) => ok(await directory.listCompanies(ctx, parseQuery(url)))));
router.add('POST', '/companies', withCtx(async (ctx, { req }) => created(await directory.createCompany(ctx, await readJson(req)))));
router.add('PATCH', '/companies/:id', withCtx(async (ctx, { req, params }) => ok(await directory.updateCompany(ctx, params.id, await readJson(req)))));
router.add('GET', '/sites', withCtx(async (ctx, { url }) => ok(await directory.listSites(ctx, parseQuery(url)))));
router.add('POST', '/sites', withCtx(async (ctx, { req }) => created(await directory.createSite(ctx, await readJson(req)))));
router.add('PATCH', '/sites/:id', withCtx(async (ctx, { req, params }) => ok(await directory.updateSite(ctx, params.id, await readJson(req)))));
router.add('GET', '/jobs/:id/signs', withCtx(async (ctx, { params }) => ok(await directory.listSigns(ctx, params.id))));
router.add('GET', '/jobs/:id/sign-groups', withCtx(async (ctx, { params }) => ok(await quotes.listSignGroups(ctx, params.id))));
router.add('POST', '/jobs/:id/sync-quotes', withCtx(async (ctx, { params }) => ok(await quotes.syncJobQuotes({ ...ctx, zoho: zoho() }, params.id))));
router.add('POST', '/signs', withCtx(async (ctx, { req }) => created(await directory.createSign(ctx, await readJson(req)))));
router.add('PATCH', '/signs/:id', withCtx(async (ctx, { req, params }) => ok(await directory.updateSign(ctx, params.id, await readJson(req)))));

// Equipment, chemicals, workshop locations, devices
router.add('GET', '/equipment', withCtx(async (ctx, { url }) => ok(await registers.listEquipment(ctx, parseQuery(url)))));
router.add('POST', '/equipment', withCtx(async (ctx, { req }) => created(await registers.createEquipment(ctx, await readJson(req)))));
router.add('PATCH', '/equipment/:id', withCtx(async (ctx, { req, params }) => ok(await registers.updateEquipment(ctx, params.id, await readJson(req)))));
router.add('POST', '/equipment/:id/checked', withCtx(async (ctx, { params }) => ok(await registers.markChecked(ctx, params.id))));
router.add('POST', '/equipment/off-hire', withCtx(async (ctx, { req }) => ok(await registers.offHireForFinishedInstall(ctx, (await readJson(req)).equipment_ids))));
router.add('GET', '/chemicals', withCtx(async (ctx, { url }) => ok(await registers.listChemicals(ctx, parseQuery(url)))));
router.add('POST', '/chemicals', withCtx(async (ctx, { req }) => created(await registers.createChemical(ctx, await readJson(req)))));
router.add('PATCH', '/chemicals/:id', withCtx(async (ctx, { req, params }) => ok(await registers.updateChemical(ctx, params.id, await readJson(req)))));
router.add('GET', '/locations', withCtx(async (ctx) => ok(await registers.listLocations(ctx))));
router.add('POST', '/locations', withCtx(async (ctx, { req }) => created(await registers.createLocation(ctx, await readJson(req)))));
router.add('PATCH', '/locations/:id', withCtx(async (ctx, { req, params }) => ok(await registers.updateLocation(ctx, params.id, await readJson(req)))));
router.add('GET', '/devices', withCtx(async (ctx, { url }) => ok(await registers.listDevices(ctx, parseQuery(url)))));


// Dashboard and calendar
router.add('GET', '/dashboard', withCtx(async (ctx) => ok(await dashboard.getDashboard(ctx))));
router.add('GET', '/calendar', withCtx(async (ctx, { url }) => ok(await dashboard.getCalendar(ctx, parseQuery(url)))));

// Inbound CRM webhook. Public (the CRM has no browser session) but guarded by a shared secret, and
// switched off (503) until CRM_WEBHOOK_SECRET is set. Receiving the same deal twice is harmless.
router.add(
	'POST',
	'/webhooks/crm/deal-won',
	async ({ req, log }) => {
		const raw = await readLooseBody(req); // the CRM may send JSON, form fields or address values
		// The secret may be a header (preferred) or a body parameter named x-webhook-token or token.
		const { token, body } = crmWebhook.extractToken(req.headers, raw);
		try {
			crmWebhook.authenticate(process.env.CRM_WEBHOOK_SECRET, { 'x-webhook-token': token });
		} catch (err) {
			// Help diagnose a wrong secret without ever logging it or what was sent: only shapes and lengths.
			log.warn('webhook auth refused', {
				secretArrived: token !== undefined,
				arrivedAs: req.headers['x-webhook-token'] ? 'header' : token !== undefined ? 'body parameter' : 'nowhere',
				sentLength: typeof token === 'string' ? token.length : 0,
				expectedLength: (process.env.CRM_WEBHOOK_SECRET || '').length,
				sentHasQuoteOrSpaceAtEdge: typeof token === 'string' && /^["'s]|["'s]$/.test(token),
				receivedKeys: Object.keys(body),
				contentType: req.headers['content-type'] || null,
				contentLength: req.headers['content-length'] || null,
				bodyBytesRead: req.bodyBytesRead,
				platformBodyType: req.body === undefined ? 'none' : Buffer.isBuffer(req.body) ? 'buffer' : typeof req.body,
				sentIsPrefixOfSecret: typeof token === 'string' && token.length > 0 && (process.env.CRM_WEBHOOK_SECRET || '').startsWith(token),
				sentCharset: typeof token !== 'string' ? 'none' : /^[0-9a-f]+$/i.test(token) ? 'hex' : /^[A-Za-z0-9]+$/.test(token) ? 'alphanumeric' : 'other characters',
				hadAddressValues: String(req.url || '').includes('?'),
				headerNames: Object.keys(req.headers).filter((h) => !/^x-zc-|^x-forwarded|^cf-|^sec-/i.test(h)),
			});
			throw err;
		}
		const app = catalyst.initialize(req, { scope: 'admin' });
		const system = { roles: ['admin'], person: null, user: null, db: createDb(app), app };
		try {
			return ok(await crmWebhook.dealWon(makeContext(system, log), body));
		} catch (err) {
			// Names only, never values: shows what the CRM actually sent and which field was refused.
			log.warn('webhook payload refused', { receivedKeys: Object.keys(body), code: err.code, message: err.message, problems: Array.isArray(err.details) ? err.details.map((d) => ({ field: d.path || d.field, message: d.message })) : undefined });
			throw err;
		}
	},
	{ public: true }
);

// Admin
router.add('POST', '/admin/seed-compliance-types', withCtx(async (ctx) => ok(await compliance.seedComplianceTypes(ctx))));
router.add('GET', '/admin/authz', withCtx(async (ctx) => ok(await settings.getAuthz(ctx))));
router.add('POST', '/admin/crm/pull-won-deals', withCtx(async (ctx) => ok(await crmPull.pullWonDeals({ ...ctx, zoho: zoho() }))));
router.add('GET', '/admin/integrations', withCtx(async (ctx) => ok(await integrations.status(ctx))));
router.add('GET', '/admin/outbox', withCtx(async (ctx, { url }) => ok(await outbox.listOutbox(ctx, parseQuery(url)))));
router.add('POST', '/admin/outbox/:id/retry', withCtx(async (ctx, { params }) => ok(await outbox.retryOutbox(ctx, params.id))));
router.add('PUT', '/admin/authz', withCtx(async (ctx, { req }) => ok(await settings.setAuthz(ctx, await readJson(req)))));
router.add('POST', '/admin/seed-templates', withCtx(async (ctx) => ok(await admin.seedChecklistTemplates(ctx))));

module.exports = { router };
