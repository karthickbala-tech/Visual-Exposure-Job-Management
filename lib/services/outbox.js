'use strict';

const { STATUS, afterFailure, safeError, idempotencyKey, NotConfigured } = require('../domain/outbox');
const { toDbDateTime } = require('../time');
const { forbidden, notFound, badRequest } = require('../errors');

const BATCH = 50;
const NOT_CONFIGURED_RETRY_MS = 60 * 60 * 1000;

/**
 * Queue a piece of work for another system. Queuing the same key twice does nothing, so callers can
 * retry freely. Never throws: a queue problem is logged, because it must not break the user's action.
 */
async function enqueue(ctx, { jobType, entityType, entityId, payload, key }) {
	try {
		const idem = Array.isArray(key) ? idempotencyKey(...key) : idempotencyKey(key);
		if (await ctx.repos.outbox.findByKey(idem)) return { queued: false, key: idem };
		await ctx.repos.outbox.insert({
			job_type: jobType,
			entity_type: entityType,
			entity_id: entityId,
			idempotency_key: idem,
			payload: JSON.stringify(payload || {}),
			job_status: STATUS.PENDING,
			attempts: 0,
			next_run_at: toDbDateTime(ctx.now()),
		});
		return { queued: true, key: idem };
	} catch (err) {
		ctx.log.warn('outbox enqueue failed', { jobType, error: safeError(err) });
		return { queued: false, error: true };
	}
}

/**
 * Work through what is due. `handlers` maps job_type to async (payload, row) => void.
 * Success marks Done. A failure counts an attempt and schedules the next one, or parks the row as
 * Failed after the last. "Not configured" is not a failure: the row stays Pending, an hour later,
 * with no attempt counted, so nothing is lost while an integration is still being set up.
 * Safe to run twice at once: a row is only touched while it is still Pending.
 */
async function drainOutbox(ctx, handlers) {
	const now = ctx.now();
	const due = await ctx.repos.outbox.listDue(toDbDateTime(now), BATCH);
	const result = { checked: due.length, done: 0, retried: 0, failed: 0, waiting: 0, unknown: 0 };

	for (const row of due) {
		const handler = handlers[row.job_type];
		if (!handler) {
			result.unknown += 1; // no handler for this type yet; leave it queued
			continue;
		}
		const attempts = Number(row.attempts || 0) + 1;
		try {
			let payload = {};
			try {
				payload = row.payload ? JSON.parse(row.payload) : {};
			} catch {
				payload = {};
			}
			await handler(payload, row);
			await ctx.repos.outbox.update({ ROWID: row.ROWID, job_status: STATUS.DONE, attempts, next_run_at: null, last_error: null });
			result.done += 1;
		} catch (err) {
			if (err instanceof NotConfigured) {
				await ctx.repos.outbox.update({ ROWID: row.ROWID, next_run_at: toDbDateTime(new Date(now.getTime() + NOT_CONFIGURED_RETRY_MS)), last_error: safeError(err) });
				result.waiting += 1;
				continue;
			}
			const next = afterFailure(attempts, now);
			await ctx.repos.outbox.update({
				ROWID: row.ROWID,
				job_status: next.status,
				attempts,
				next_run_at: next.nextRunAt ? toDbDateTime(next.nextRunAt) : null,
				last_error: safeError(err),
			});
			if (next.status === STATUS.FAILED) result.failed += 1;
			else result.retried += 1;
		}
	}
	return result;
}

/** Admin view of the outbox: what is waiting, done or parked as failed. */
async function listOutbox(ctx, query = {}) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can see the outbox');
	const status = Object.values(STATUS).includes(query.status) ? query.status : undefined;
	const rows = await ctx.repos.outbox.list({ status, limit: 100 });
	return {
		items: rows.map((r) => ({
			id: String(r.ROWID),
			jobType: r.job_type,
			entityType: r.entity_type || '',
			entityId: r.entity_id ? String(r.entity_id) : '',
			status: r.job_status,
			attempts: Number(r.attempts || 0),
			nextRunAt: r.next_run_at || null,
			lastError: r.last_error || '',
		})),
	};
}

/** Give a parked (Failed) item a fresh set of attempts, to run on the next drain. */
async function retryOutbox(ctx, id) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can retry outbox items');
	const row = await ctx.repos.outbox.findById(id);
	if (!row) throw notFound('Outbox item not found');
	if (row.job_status !== STATUS.FAILED) throw badRequest('Only failed items can be retried');
	await ctx.repos.outbox.update({ ROWID: row.ROWID, job_status: STATUS.PENDING, attempts: 0, next_run_at: toDbDateTime(ctx.now()) });
	return { id: String(row.ROWID), status: STATUS.PENDING };
}

module.exports = { enqueue, drainOutbox, listOutbox, retryOutbox };
