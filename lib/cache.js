'use strict';

/**
 * Small JSON cache over Catalyst Cache segments. Fails open: a cache problem is logged by the
 * caller's fallback path, never an error for the user. Entries carry their own timestamp so
 * freshness can be shorter than Catalyst's minimum 1 hour expiry.
 * Segment ids come from environment variables; the development ids are the fallback.
 */
const SEGMENTS = {
	kpi: () => process.env.CACHE_SEGMENT_KPI || '105747000000030376',
	config: () => process.env.CACHE_SEGMENT_CONFIG || '105747000000036097',
};

function createCache(app, segmentName) {
	const segment = () => app.cache().segment(SEGMENTS[segmentName]());
	return {
		/** The cached value if it is younger than maxAgeMs, else null. */
		async get(key, maxAgeMs, now = Date.now()) {
			try {
				const raw = await segment().getValue(key);
				if (!raw) return null;
				const entry = JSON.parse(raw);
				return entry && now - entry.at <= maxAgeMs ? entry.data : null;
			} catch {
				return null;
			}
		},
		async set(key, data, now = Date.now()) {
			try {
				const value = JSON.stringify({ at: now, data });
				const seg = segment();
				try {
					await seg.put(key, value, 1);
				} catch {
					await seg.update(key, value, 1); // key already exists
				}
			} catch {
				/* a missed cache write only costs a slower next request */
			}
		},
		async clear(key) {
			try {
				await segment().delete(key);
			} catch {
				/* nothing cached */
			}
		},
	};
}

module.exports = { createCache, SEGMENTS };
