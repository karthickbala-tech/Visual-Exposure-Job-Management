'use strict';

const { dueOffset, nextReminderDate, daysUntil } = require('../domain/reminders');
const { cleanRecipients } = require('../domain/notifications');
const { composeEmail, sendAndLog } = require('./notifications');
const { readSettings } = require('./appSettings');
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

	const companyIds = [...new Set(items.map((i) => i.company_id).filter(Boolean))];
	const [types, people, managers, companies] = await Promise.all([
		ctx.repos.complianceTypes.list(),
		ctx.repos.people.findByIds(items.map((i) => i.person_id).filter(Boolean)),
		ctx.repos.people.listByRole(MANAGER_ROLE),
		companyIds.length ? ctx.repos.companies.findByIds(companyIds) : [],
	]);
	const companyById = new Map(companies.map((c) => [String(c.ROWID), c]));
	const settings = await readSettings(ctx.repos); // the global default reminder days, for types that set none
	const typeById = new Map(types.map((t) => [String(t.ROWID), t]));
	const personById = new Map(people.map((p) => [String(p.ROWID), p]));
	const managerEmails = managers.map((m) => m.email);

	// Items that only need their next date moved (nothing to send) are updated together in one call at the end.
	const reschedule = [];
	for (const item of items) {
		const type = typeById.get(String(item.type_id));
		const meta = parseJson(item.meta, {});
		const lastSent = Number.isInteger(meta.lastSent) ? meta.lastSent : null;
		const args = { expiryDate: item.expiry_date, offsets: (type && type.reminder_offsets) || settings.expiry_reminder_days, lastSent };
		const offset = dueOffset(args, today);

		try {
			if (offset === null) {
				// Nothing due after all. An expired item has nothing more to send, so it leaves the daily
				// check for good (renewing it sets a new date); otherwise just move the date on.
				const expired = item.expiry_date && daysUntil(item.expiry_date, today) < 0;
				reschedule.push({ ROWID: item.ROWID, next_reminder_at: expired ? null : asDateTime(nextReminderDate(args)) });
				continue;
			}
			const person = personById.get(String(item.person_id));
			const company = item.company_id ? companyById.get(String(item.company_id)) : null;
			const companyEmail = company && !optedOut(company.do_not_contact) ? parseJson(company.contact, {}).email : null;
			const to = cleanRecipients([...(optedOut(item.do_not_contact) ? [] : [person && person.email, companyEmail]), ...managerEmails]);
			const message = await composeEmail(ctx.repos, 'complianceDue', {
				who: company ? company.name : fullName(person),
				what: type ? type.name : item.compliance_kind,
				expiry: item.expiry_date,
				days: daysUntil(item.expiry_date, today),
				link: linkTo('/compliance'),
			});
			const sent = await sendAndLog(ctx, { event: 'compliance.due', to, message });
			if (!sent.sent) {
				// Not sent: leave it due so it goes out later (no sender yet counts as skipped; a real mail failure as failed).
				if (sent.reason === 'failed') result.failed += 1;
				else result.skipped += 1;
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
	if (reschedule.length) {
		try {
			await ctx.repos.compliance.update(reschedule);
		} catch (err) {
			ctx.log.warn('compliance reschedule failed', { count: reschedule.length, error: err.message }); // they stay due and are tried again tomorrow
		}
	}
	return result;
}

module.exports = { runComplianceDue, optedOut };
