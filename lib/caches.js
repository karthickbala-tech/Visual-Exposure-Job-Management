'use strict';

const { createMemo } = require('./memo');

/** Shared in-process caches (see memo.js). Services clear the one they change. */
const memos = {
	/** email -> person row (or null), 60 s */
	personMemo: createMemo(60 * 1000),
	/** the permission matrix override, 5 min */
	matrixMemo: createMemo(5 * 60 * 1000, 5),
	/** dashboard figures shared by every manager, 60 s */
	figuresMemo: createMemo(60 * 1000, 5),
};

/** Empty every shared cache (used by tests). */
function clearAll() {
	Object.values(memos).forEach((m) => m.clear());
}

module.exports = { ...memos, clearAll };
