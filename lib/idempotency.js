'use strict';

const crypto = require('crypto');
const { AppError } = require('./errors');

/**
 * Create actions run once (FSD section 10: "idempotency key on create-action endpoints").
 *
 * The same person sending the same create (same address, same fields) again within two minutes gets the first
 * answer back instead of a second record: a double tap, or pressing Save again after the phone lost the reply.
 * The key is worked out on the server from who, where and what, so no form has to carry one. A copy still in
 * progress is told to wait. A create that failed leaves no mark, so it can be tried again straight away.
 *
 * Cost: one cache put to claim and one to store the answer; a cache get only when it really is a repeat.
 * If the cache cannot be used, the create simply runs (fail open).
 */
const WINDOW_MS = 2 * 60 * 1000;
const MAX_STORED = 40000; // characters of the stored answer; a larger answer is not replayed, only refused

/** JSON with object keys sorted, so the same fields in another order are the same request. */
function stable(v) {
	if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
	if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
	return JSON.stringify(v === undefined ? null : v);
}

function onceKey(actor, path, body) {
	const who = (actor && ((actor.person && actor.person.ROWID) || (actor.user && actor.user.user_id))) || 'anon';
	return 'once_' + crypto.createHash('sha256').update(`${who}|${path}|${stable(body)}`).digest('hex').slice(0, 40);
}

/** Run `create` unless the same request ran in the last two minutes; then answer as the first one did. */
async function runOnce(ctx, path, body, create) {
	const cache = ctx.cache;
	if (!cache || typeof cache.claim !== 'function') return create();
	const key = onceKey(ctx.actor, path, body);
	const now = ctx.now ? ctx.now().getTime() : Date.now();
	const claim = await cache.claim(key, { state: 'running' }, now);
	if (claim && !claim.claimed) {
		const { at, data } = claim.entry || {};
		if (typeof at === 'number' && now - at <= WINDOW_MS && data) {
			if (data.state === 'done' && data.response !== undefined) return data.response;
			if (data.state === 'done') throw new AppError(409, 'already_saved', 'This was already saved a moment ago. Reload to see it.');
			throw new AppError(409, 'in_progress', 'This is already being saved. Wait a moment, then reload to see it.');
		}
		await cache.set(key, { state: 'running' }, now); // an old entry: this is a new request
	}
	let response;
	try {
		response = await create();
	} catch (err) {
		if (claim) await cache.clear(key); // nothing was made, so the next try must run
		throw err;
	}
	if (claim) {
		const fits = JSON.stringify(response).length <= MAX_STORED;
		await cache.set(key, fits ? { state: 'done', response } : { state: 'done' }, now);
	}
	return response;
}

module.exports = { runOnce, onceKey, stable, WINDOW_MS };
