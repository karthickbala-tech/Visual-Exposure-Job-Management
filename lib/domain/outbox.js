'use strict';

const crypto = require('node:crypto');

/**
 * Rules for the integration outbox and the inbound webhook. Pure, no I/O.
 * Work for other systems (CRM, WorkDrive, MDM) is queued in the outbox and retried with growing
 * delays; after the last attempt it is parked as Failed for a person to look at.
 * Assumption (not stated in the FSD): retry after 1 min, 5 min, 15 min, 1 h, 6 h, then give up.
 */
const STATUS = Object.freeze({ PENDING: 'Pending', DONE: 'Done', FAILED: 'Failed' });
const RETRY_DELAYS_MINUTES = Object.freeze([1, 5, 15, 60, 360]);
const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;
const MAX_ERROR_CHARS = 2000;

/** What happens after attempt number `attempts` (1-based) has just failed. */
function afterFailure(attempts, now) {
	if (attempts >= MAX_ATTEMPTS) return { status: STATUS.FAILED, nextRunAt: null };
	const minutes = RETRY_DELAYS_MINUTES[attempts - 1];
	return { status: STATUS.PENDING, nextRunAt: new Date(now.getTime() + minutes * 60000) };
}

/** An error text that is safe to store: bounded, and without anything that looks like a secret. */
function safeError(err) {
	const text = String((err && err.message) || err || 'Unknown error')
		.replace(/(token|secret|password|authorization|refresh_token|client_secret)(["'\s:=]+)[^\s"',}]+/gi, '$1$2[hidden]')
		.replace(/\b1000\.[a-f0-9]{20,}\b/gi, '[hidden]');
	return text.slice(0, MAX_ERROR_CHARS);
}

/** A key that makes queuing the same piece of work twice harmless. Fits the 100 character column. */
const idempotencyKey = (...parts) => parts.map((p) => String(p).replace(/[^\w.:@-]/g, '_')).join(':').slice(0, 100);

/** Does the supplied webhook token match the shared secret? Constant time; false if either is missing. */
function tokenMatches(secret, provided) {
	if (!secret || !provided) return false;
	const a = crypto.createHash('sha256').update(String(secret)).digest();
	const b = crypto.createHash('sha256').update(String(provided)).digest();
	return crypto.timingSafeEqual(a, b);
}

/** A thrown error that means "this integration is not set up yet", which must not burn retry attempts. */
class NotConfigured extends Error {
	constructor(what) {
		super(`${what} is not configured`);
		this.name = 'NotConfigured';
	}
}

module.exports = { STATUS, RETRY_DELAYS_MINUTES, MAX_ATTEMPTS, afterFailure, safeError, idempotencyKey, tokenMatches, NotConfigured };
