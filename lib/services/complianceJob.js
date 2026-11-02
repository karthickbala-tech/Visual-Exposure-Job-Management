'use strict';

const { dueOffset, nextReminderDate, daysUntil } = require('../domain/reminders');
const { render, cleanRecipients } = require('../domain/notifications');
const { linkTo } = require('../mail');
const { todayLocal } = require('../time');

const BATCH = 300;
const MANAGER_ROLE = 'project_manager';

const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};
const asDateTime = (d) => (d ? `${d} 00:00:00` : null);
const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Someone');

/** A person who asked not to be emailed (any non-empty "do not contact" note other than false or empty). */
const optedOut = (value) => {
	const v = String(value || '').trim().toLowerCase();
	return v !== '' && v !== 'false' && v !== '[]' && v !== '{}' && v !== 'null';
};

/**
 * Send today's reminders. Safe to run twice: an offset is recorded as sent only after the email
 * went out, and the next reminder date moves forward, so a rerun finds nothing due. If email is not
 * set up (no sender), nothing is recorded, so the reminders go out once it is.
 * ctx: { repos, mailer, log, now }
 */
async function runComplianceDue(ctx) {
	const today = todayLocal(ctx.now());
	const items = await ctx.repos.compliance.listDue(`${today} 23:59:59`, BATCH);
	const result = { checked: items.length, sent: 0, skipped: 0, failed: 0 };
	if (!items.length) return result;

	const [types, people, managers] = await Promise.all([
		ctx.repos.complianceTypes.list(),
		ctx.repos.people.findByIds(items.map((i) => i.person_id).filter(Boolean)),
		ctx.repos.people.listByRole(MANAGER_ROLE),
	]);
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const personById = new Map(people.map((p) => [String(p.ROWID), p]));
	const managerEmails = managers.map((m) => m.email);

	for (const item of items) {
		const type = typeById.get(String(item.type_id));
		const meta = parseJson(item.meta, {});
		const lastSent = Number.isInteger(meta.lastSent) ? meta.lastSent : null;
		const args = { expiryDate: item.expiry_date, offsets: type && type.reminder_offsets, lastSent };
		const offset = dueOffset(args, today);

		try {
			if (offset === null) {
				// Nothing due after all (for example renewed or expired): just move the date on.
				await ctx.repos.compliance.update({ ROWID: item.ROWID, next_reminder_at: asDateTime(nextReminderDate(args)) });
				continue;
			}
			const person = personById.get(String(item.person_id));
			const to = cleanRecipients([...(optedOut(item.do_not_contact) ? [] : [person && person.email]), ...managerEmails]);
			const message = render('complianceDue', {
				who: fullName(person),
				what: type ? type.name : item.compliance_kind,
				expiry: item.expiry_date,
				days: daysUntil(item.expiry_date, today),
				link: linkTo('/compliance'),
			});
			const sent = await ctx.mailer.send({ to, subject: message.subject, html: message.html });
			if (!sent.sent) {
				result.skipped += 1; // email not ready: leave it due so it goes out later
				continue;
			}
			const next = nextReminderDate({ ...args, lastSent: offset });
			await ctx.repos.compliance.update({ ROWID: item.ROWID, meta: JSON.stringify({ ...meta, lastSent: offset }), next_reminder_at: asDateTime(next) });
			result.sent += 1;
		} catch (err) {
			result.failed += 1; // leave this one due; the others still go out
			ctx.log.warn('compliance reminder failed', { itemId: String(item.ROWID), error: err.message });
		}
	}
	return result;
}

module.exports = { runComplianceDue, optedOut };
