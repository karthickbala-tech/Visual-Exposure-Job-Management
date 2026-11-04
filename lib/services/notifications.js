'use strict';

const { AppError, forbidden, notFound, badRequest } = require('../errors');
const { z, parse, schemas } = require('../validate');
const { safeError } = require('../domain/outbox');
const N = require('../domain/notifications');
const { createMailer } = require('../mail');
const { toDbDateTime } = require('../time');
const { readSettings } = require('./appSettings');

const TEMPLATES_KEY = 'mail.templates';
const MAX_TEMPLATES_JSON = 9000; // the column holds 10,000 characters
const MAX_FAILED_HTML = 6000; // a failed email keeps its body so it can be sent again

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};
const requireAdmin = (ctx) => {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can use notifications');
};
const mailerFor = (ctx) => ctx.mailer || createMailer(ctx.app || (ctx.actor && ctx.actor.app));

// ---- editable templates ----

async function readOverrides(repos) {
	const row = await repos.settings.findByKey(TEMPLATES_KEY);
	return parseJson(row && row.setting_value, {});
}

/** Build an email from a template, with the administrator's edits (if any) applied. One read of the saved edits. */
async function composeEmail(repos, name, data) {
	const message = N.render(name, data);
	const overrides = await readOverrides(repos);
	return N.applyOverrides(message, overrides[name], name, data);
}

const overrideInput = z
	.object({
		subject: z.string().trim().max(150).nullable(),
		intro: z.string().trim().max(600).nullable(),
		footer: z.string().trim().max(600).nullable(),
	})
	.partial()
	.strict();

const item = (name, override) => ({
	name,
	label: N.TEMPLATE_INFO[name].label,
	placeholders: N.placeholdersOf(name),
	override: override || null,
});

async function listTemplates(ctx) {
	requireAdmin(ctx);
	const overrides = await readOverrides(ctx.repos);
	return { items: Object.keys(N.TEMPLATE_INFO).map((name) => item(name, overrides[name])) };
}

/** Change an email: a new subject, intro and footer (empty or null clears that part; clearing all resets the email). */
async function updateTemplate(ctx, name, raw) {
	requireAdmin(ctx);
	if (!N.TEMPLATE_INFO[name]) throw notFound('No such email template');
	const input = parse(overrideInput, raw);
	for (const [field, value] of Object.entries(input)) {
		const bad = N.unknownPlaceholders(value, name);
		if (bad.length) throw badRequest(`${field} uses unknown placeholders: ${bad.map((b) => `{${b}}`).join(', ')}. Use: ${N.placeholdersOf(name).map((p) => `{${p}}`).join(', ')}`);
	}

	const row = await ctx.repos.settings.findByKey(TEMPLATES_KEY);
	const all = parseJson(row && row.setting_value, {});
	const merged = { ...(all[name] || {}), ...input };
	for (const k of Object.keys(merged)) if (!merged[k]) delete merged[k];
	if (Object.keys(merged).length) all[name] = merged;
	else delete all[name];

	const json = JSON.stringify(all);
	if (json.length > MAX_TEMPLATES_JSON) throw new AppError(413, 'value_too_large', 'The email edits are too long in total');
	const by = ctx.actor.person ? ctx.actor.person.ROWID : undefined;
	if (row) await ctx.repos.settings.update({ ROWID: row.ROWID, setting_value: json, updated_by: by });
	else await ctx.repos.settings.insert({ setting_key: TEMPLATES_KEY, setting_value: json, description: 'Email template edits', updated_by: by });
	return { template: item(name, all[name]) };
}

/** What an email looks like with the current edits, using sample data. Nothing is sent. */
async function previewTemplate(ctx, name) {
	requireAdmin(ctx);
	if (!N.TEMPLATE_INFO[name]) throw notFound('No such email template');
	const message = await composeEmail(ctx.repos, name, N.TEMPLATE_INFO[name].sample);
	return { subject: message.subject, html: message.html, text: message.text };
}

// ---- the notification log ----

/**
 * Send an email and write one log row for it (FSD section 8): the event, the recipients and the outcome. Never throws: a
 * mail problem is logged ("failed", with the body kept so it can be sent again) and the caller carries on.
 * Outcomes: sent, skipped (no sender or no recipients, nothing was attempted) and failed.
 */
async function sendAndLog(ctx, { event, to, message }) {
	const recipients = N.cleanRecipients(to);
	let result;
	try {
		result = await mailerFor(ctx).send({ to: recipients, subject: message.subject, html: message.html });
	} catch (err) {
		result = { sent: false, reason: 'failed', error: safeError(err) };
	}
	const status = result.sent ? 'sent' : result.reason === 'failed' ? 'failed' : 'skipped';
	const payload = { to: recipients, ...(status !== 'sent' ? { reason: result.reason, error: result.error } : {}) };
	if (status === 'failed') payload.html = String(message.html || '').slice(0, MAX_FAILED_HTML);
	try {
		await ctx.repos.activity.insert({
			entity_type: 'notification',
			entity_id: 0,
			activity_type: 'email',
			from_value: String(event || 'unknown').slice(0, 100),
			to_value: status,
			comment_text: message.subject,
			payload: JSON.stringify(payload).slice(0, 9000),
			logged_at: toDbDateTime(ctx.now ? ctx.now() : new Date()),
		});
	} catch (err) {
		if (ctx.log) ctx.log.warn('could not log a notification', { event, error: err.message });
	}
	return result;
}

const shape = (r) => {
	const p = parseJson(r.payload, {});
	return { id: String(r.ROWID), event: r.from_value, status: r.to_value, subject: r.comment_text || '', recipients: p.to || [], reason: p.reason || null, error: p.error || null, retryOf: p.retryOf || null, at: r.logged_at || null };
};

const logQuery = schemas.pagination.extend({ status: z.enum(['sent', 'skipped', 'failed', 'retried']).optional(), event: z.string().max(100).optional() });

/** The newest notifications first. Administrators only (they list people's email addresses). */
async function listNotifications(ctx, rawQuery = {}) {
	requireAdmin(ctx);
	const q = parse(logQuery, rawQuery);
	const rows = await ctx.repos.activity.listByEntity({ entityType: 'notification', entityId: '0', activityType: 'email', limit: Math.min(q.limit || 50, 200) });
	const items = rows.map(shape).filter((i) => (!q.status || i.status === q.status) && (!q.event || i.event === q.event));
	return { items, count: items.length };
}

/** Send a failed notification again. On success the original is marked "retried" and a new "sent" row is written. */
async function retryNotification(ctx, id) {
	requireAdmin(ctx);
	parse(schemas.rowId, id);
	const row = await ctx.repos.activity.findById(id);
	if (!row || row.entity_type !== 'notification') throw notFound('Notification not found');
	if (row.to_value !== 'failed') throw new AppError(409, 'not_failed', 'Only failed notifications can be sent again');
	const p = parseJson(row.payload, {});
	if (!p.html || !Array.isArray(p.to) || !p.to.length) throw new AppError(409, 'cannot_retry', 'This notification no longer has what is needed to send it again');

	const result = await sendAndLog(ctx, { event: row.from_value, to: p.to, message: { subject: row.comment_text, html: p.html } });
	if (result.sent) await ctx.repos.activity.update({ ROWID: row.ROWID, to_value: 'retried' });
	return { sent: !!result.sent, reason: result.reason || null };
}

module.exports = { composeEmail, listTemplates, updateTemplate, previewTemplate, sendAndLog, listNotifications, retryNotification, readSettings };
