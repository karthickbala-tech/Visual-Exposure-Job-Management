'use strict';

/**
 * Expiry reminders for tickets, inductions and documents. Pure: dates are YYYY-MM-DD strings,
 * no clock, no I/O.
 *
 * An item has an expiry date and a list of offsets (days before expiry, for example [30, 14, 7, 0]).
 * Each offset fires at most once: the last offset sent is remembered, and an offset only fires when
 * it is due AND smaller than the one already sent. If several are overdue at once (the job missed
 * days), only the most urgent one fires, never a burst of old ones.
 * Assumption (not stated in the FSD): default offsets are 30, 14, 7 and 0 days.
 */
const DEFAULT_OFFSETS = Object.freeze([30, 14, 7, 0]);
const DAY = 86400000;

const toMs = (iso) => Date.parse(`${iso}T00:00:00Z`);
const fromMs = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (iso, n) => fromMs(toMs(iso) + n * DAY);

/** Whole days from `today` to `expiry` (negative once expired). */
const daysUntil = (expiry, today) => Math.round((toMs(expiry) - toMs(today)) / DAY);

/** Clean an offsets list: whole days >= 0, unique, biggest first. Falls back to the defaults. */
function normaliseOffsets(raw) {
	let list = raw;
	if (typeof raw === 'string') {
		try {
			list = JSON.parse(raw);
		} catch {
			list = null;
		}
	}
	if (!Array.isArray(list)) return [...DEFAULT_OFFSETS];
	const clean = [...new Set(list.filter((n) => Number.isInteger(n) && n >= 0 && n <= 365))].sort((a, b) => b - a);
	return clean.length ? clean : [...DEFAULT_OFFSETS];
}

/**
 * Where an item stands today.
 *  'No expiry' (type does not expire), 'Valid', 'Expiring' (inside the earliest warning window), 'Expired'.
 */
function complianceStatus({ expiryDate, requiresExpiry = true, offsets = DEFAULT_OFFSETS }, today) {
	if (!requiresExpiry || !expiryDate) return 'No expiry';
	const days = daysUntil(expiryDate, today);
	if (days < 0) return 'Expired';
	return days <= Math.max(...normaliseOffsets(offsets)) ? 'Expiring' : 'Valid';
}

/**
 * The offset to send today, or null. `lastSent` is the smallest offset already sent (null if none).
 * Nothing is sent once the item has expired more than a day ago (the item itself shows "Expired").
 */
function dueOffset({ expiryDate, offsets, lastSent = null }, today) {
	if (!expiryDate) return null;
	const days = daysUntil(expiryDate, today);
	if (days < 0) return null;
	const due = normaliseOffsets(offsets).filter((o) => days <= o && (lastSent === null || o < lastSent));
	return due.length ? Math.min(...due) : null;
}

/** The next date a reminder could fire (YYYY-MM-DD), or null when nothing more will be sent. */
function nextReminderDate({ expiryDate, offsets, lastSent = null }) {
	if (!expiryDate) return null;
	const pending = normaliseOffsets(offsets).filter((o) => lastSent === null || o < lastSent);
	if (!pending.length) return null;
	return addDays(expiryDate, -Math.max(...pending));
}

module.exports = { DEFAULT_OFFSETS, daysUntil, addDays, normaliseOffsets, complianceStatus, dueOffset, nextReminderDate };
