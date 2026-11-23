'use strict';

/** Parse JSON text stored in a column; empty or broken text gives `fallback` instead of throwing. */
const parseJson = (text, fallback) => {
	try {
		return text ? JSON.parse(text) : fallback;
	} catch {
		return fallback;
	}
};

module.exports = { parseJson };
