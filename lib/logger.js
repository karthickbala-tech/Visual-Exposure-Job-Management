'use strict';

/**
 * Structured JSON logger. One line per entry so Catalyst Logs can filter on fields.
 * Never log personal data (emails, names, phone, rates): log ids only.
 */
function createLogger(base = {}) {
	function emit(level, message, context) {
		console.log(
			JSON.stringify({ timestamp: new Date().toISOString(), level, message, ...base, ...context })
		);
	}
	return {
		info: (message, context) => emit('info', message, context),
		warn: (message, context) => emit('warn', message, context),
		error: (message, err, context) =>
			emit('error', message, {
				...context,
				error: err && err.message,
				stack: err && err.stack,
			}),
		child: (extra) => createLogger({ ...base, ...extra }),
	};
}

module.exports = { createLogger };
