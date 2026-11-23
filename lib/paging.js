'use strict';

const { ZCQL_MAX_ROWS } = require('./config');

/**
 * Read every row of a list, page by page. A ZCQL SELECT returns at most 300 rows, so code that read once with limit 300
 * silently worked on "the newest 300" once a table grew past that (jobs list, hours totals, a person's tasks).
 *
 * `fetchPage({ limit, offset })` is a repo list call with the filters already bound. Each page is one Data Store fetch, and
 * reading stops at the first short page, so a list under 300 rows still costs one fetch. `maxPages` is a safety ceiling
 * (default 10 pages = 3,000 rows); `truncated` says it was reached, so callers can tell the user instead of being silently wrong.
 */
async function fetchAll(fetchPage, { maxPages = 10 } = {}) {
	const rows = [];
	for (let page = 0; page < maxPages; page++) {
		const batch = (await fetchPage({ limit: ZCQL_MAX_ROWS, offset: page * ZCQL_MAX_ROWS })) || [];
		rows.push(...batch);
		if (batch.length < ZCQL_MAX_ROWS) return { rows, truncated: false };
	}
	return { rows, truncated: true };
}

module.exports = { fetchAll };
