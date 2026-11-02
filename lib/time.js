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

module.exports = { toDbDateTime, toDbDate };
