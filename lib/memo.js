'use strict';

/**
 * Tiny in-process cache with a time limit, for values that change rarely (the signed-in person, the
 * permission matrix, dashboard figures). A warm Catalyst function instance serves many requests, so
 * this turns most per-request Data Store fetches and Cache reads into zero calls, which matters on a
 * plan with small monthly request limits. Another instance may hold a value for up to `ttlMs` longer
 * after a change; that is acceptable for these values. Bounded so it can never grow without limit.
 */
const MAX_ENTRIES = 500;

function createMemo(ttlMs, max = MAX_ENTRIES) {
	const store = new Map();
	return {
		/** The value if present and younger than the time limit, else undefined. */
		get(key, now = Date.now()) {
			const hit = store.get(key);
			if (!hit) return undefined;
			if (now - hit.at > ttlMs) {
				store.delete(key);
				return undefined;
			}
			return hit.value;
		},
		set(key, value, now = Date.now()) {
			if (store.size >= max) store.delete(store.keys().next().value);
			store.set(key, { at: now, value });
			return value;
		},
		delete(key) {
			store.delete(key);
		},
		clear() {
			store.clear();
		},
		get size() {
			return store.size;
		},
	};
}

module.exports = { createMemo };
