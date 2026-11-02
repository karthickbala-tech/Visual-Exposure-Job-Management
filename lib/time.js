'use strict';

/** Catalyst datetime columns use 'YYYY-MM-DD HH:mm:ss'; date columns use 'YYYY-MM-DD'. */
const pad = (n) => String(n).padStart(2, '0');

function toDbDateTime(date = new Date()) {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
		date.getUTCHours()
	)}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function toDbDate(date = new Date()) {
	return toDbDateTime(date).slice(0, 10);
}

/** Today's date (YYYY-MM-DD) where the business operates. Melbourne is the default; override with BUSINESS_TZ. */
function todayLocal(date = new Date(), tz = process.env.BUSINESS_TZ || 'Australia/Melbourne') {
	return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

module.exports = { toDbDateTime, toDbDate, todayLocal };
