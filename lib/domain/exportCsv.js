'use strict';

/**
 * Export formats (FSD 5.14). Pure, no I/O.
 * Only the listed columns leave the system, so a new column never leaks by accident.
 */
const ENTITIES = Object.freeze({
	jobs: ['ROWID', 'name', 'stage', 'crm_deal_id', 'created_date', 'expected_finish', 'percent_fab', 'percent_install', 'percent_job'],
	people: ['ROWID', 'first_name', 'last_name', 'email', 'phone', 'person_kind', 'job_title', 'roles', 'is_active'],
	companies: ['ROWID', 'name', 'kind', 'state', 'is_active', 'notes'],
	issues: ['ROWID', 'subject', 'department', 'issue_status', 'issue_priority', 'CREATEDTIME'],
});

/**
 * One CSV cell. Values that start with = + - @ (or a tab or carriage return) are prefixed with an apostrophe so a spreadsheet
 * never runs them as a formula; quotes, commas and line breaks are escaped.
 */
function cell(value) {
	let s = value === null || value === undefined ? '' : String(value);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows (objects) to CSV text with a header line, using only the whitelisted columns of the entity. */
function toCsv(entity, rows) {
	const cols = ENTITIES[entity];
	const lines = [cols.join(',')];
	for (const r of rows) lines.push(cols.map((c) => cell(r[c])).join(','));
	return lines.join('\r\n') + '\r\n';
}

const pick = (entity, row) => Object.fromEntries(ENTITIES[entity].map((c) => [c, row[c] === undefined ? null : row[c]]));

module.exports = { ENTITIES, cell, toCsv, pick };
