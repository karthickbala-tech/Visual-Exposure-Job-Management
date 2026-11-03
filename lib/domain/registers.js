'use strict';

/**
 * Equipment and chemical register rules, and device helpers (FSD EQP-1 to EQP-5).
 * Pure functions, no I/O. Dates are YYYY-MM-DD strings.
 */
const { addDays } = require('./reminders');

const EQUIPMENT_STATUSES = Object.freeze(['In service', 'Off hire', 'Out of service']);
const STALE_HOURS = 24;

/** Next check date: last check plus the interval. Null when either is missing. */
function nextDue(plan) {
	if (!plan || !plan.last_checked || !plan.frequency_days) return null;
	return addDays(plan.last_checked, Number(plan.frequency_days));
}

/** Off-hire and out-of-service equipment is not checked, so it is never overdue. */
function isOverdue(item, today) {
	if (item.status !== 'In service') return false;
	const due = nextDue(item.plan);
	return !!due && due < today;
}

function daysOverdue(item, today) {
	const due = nextDue(item.plan);
	if (!due || due >= today) return 0;
	return Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000);
}

/** Tool codes follow the Creator pattern "VE - n": highest number in use plus one, starting at 101. */
function nextToolCode(codes) {
	const top = Math.max(100, ...codes.map((c) => Number(String(c || '').replace(/\D/g, '')) || 0));
	return `VE - ${top + 1}`;
}

/** Only web addresses may be saved as SDS links, so a pasted "javascript:" link can never be clickable. */
const isWebUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || '').trim());

const sdsMissing = (data) => !data || !data.sds_url;
const sdsReviewDue = (data, today) => !!data && !!data.review_date && data.review_date < today;

/**
 * EQP-2: when an install task is finished on site, hired equipment linked to it that is flagged
 * "off hire required" and still in service goes off hire. Returns the items to switch.
 */
function offHireOnFinish(equipment) {
	return equipment.filter((e) => e.kind === 'equipment' && e.off_hire_required === true && e.status === 'In service');
}

// Devices (EQP-4)
const hasLocation = (d) => d.last_lat !== null && d.last_lat !== undefined && d.last_lat !== '' && d.last_lng !== null && d.last_lng !== undefined && d.last_lng !== '';
const isStale = (d, nowMs) => !d.last_seen_at || nowMs - Date.parse(String(d.last_seen_at).replace(' ', 'T') + 'Z') > STALE_HOURS * 3600000;
const mapLink = (d) => `https://www.openstreetmap.org/?mlat=${d.last_lat}&mlon=${d.last_lng}#map=15/${d.last_lat}/${d.last_lng}`;

module.exports = { EQUIPMENT_STATUSES, STALE_HOURS, nextDue, isOverdue, daysOverdue, nextToolCode, isWebUrl, sdsMissing, sdsReviewDue, offHireOnFinish, hasLocation, isStale, mapLink };
