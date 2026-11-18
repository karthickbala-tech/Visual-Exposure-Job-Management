'use strict';

const { AppError } = require('../errors');

/**
 * Optimistic concurrency for edits (FSD section 10: "optimistic concurrency on edits").
 *
 * A form sends `expected`: the values it first showed for the fields it is changing. If someone else saved a
 * different value in one of those fields since, the edit is refused (409) and nothing is saved. Comparing fields,
 * not the row's MODIFIEDTIME, keeps the check quiet when the server itself touches the row (booked hours, the
 * stage, cached totals) or someone changed a field this form did not touch.
 */

const blank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const DATE = /^\d{4}-\d{2}-\d{2}/;

/** True when two stored values mean the same: '' and null, 5 and '5.00', a date and the same date with a time of 00:00. */
function sameValue(a, b) {
	if (blank(a) && blank(b)) return true;
	if (blank(a) || blank(b)) return false;
	if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
	const x = String(a).trim();
	const y = String(b).trim();
	if (x === y) return true;
	if (!Number.isNaN(Number(x)) && !Number.isNaN(Number(y))) return Number(x) === Number(y);
	if (DATE.test(x) && DATE.test(y) && (x.length === 10 || y.length === 10)) return x.slice(0, 10) === y.slice(0, 10);
	return false;
}

const parseJson = (v) => {
	if (v && typeof v === 'object') return v;
	try {
		return v ? JSON.parse(v) : {};
	} catch {
		return {};
	}
};

/**
 * The fields of `expected` whose stored value in `row` has changed. A plain-object entry (for example a task's spec)
 * is compared key by key against the JSON text column of the same name. Keys in `skip` are not compared.
 */
function changedFields(row, expected, skip = []) {
	const out = [];
	for (const [k, want] of Object.entries(expected || {})) {
		if (skip.includes(k)) continue;
		if (want && typeof want === 'object' && !Array.isArray(want)) {
			const have = parseJson(row[k]);
			for (const [sub, v] of Object.entries(want)) if (!sameValue(have[sub], v)) out.push(`${k}.${sub}`);
		} else if (!sameValue(row[k], want)) out.push(k);
	}
	return out;
}

/** Refuse the edit when another save changed one of the fields this form is changing. `what` names the record ("task", "job"). */
function assertNotChanged(row, expected, what, skip = []) {
	const fields = changedFields(row, expected, skip);
	if (fields.length === 0) return;
	const names = fields.map((f) => f.replace(/^spec\./, '').replace(/_/g, ' ')).join(', ');
	throw new AppError(409, 'changed_elsewhere', `Someone else changed this ${what} (${names}) after you opened it. Reload to see their change, then make yours again.`, { fields });
}

module.exports = { sameValue, changedFields, assertNotChanged };
