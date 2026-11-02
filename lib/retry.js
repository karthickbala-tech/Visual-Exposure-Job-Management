'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying with exponential backoff (baseMs, 2x, 4x ...) on failure.
 * Use for calls to CRM, WorkDrive and MDM. `shouldRetry(err)` can veto a retry
 * (for example on a 4xx that will never succeed). Inside a 30 s Advanced I/O
 * function keep retries tiny; real retries belong in `events` / `jobs`.
 */
async function withRetry(fn, { retries = 3, baseMs = 1000, shouldRetry = () => true, wait = sleep } = {}) {
	let lastError;
	for (let attempt = 0; attempt < retries; attempt++) {
		try {
			return await fn(attempt);
		} catch (err) {
			lastError = err;
			if (attempt === retries - 1 || !shouldRetry(err)) break;
			await wait(baseMs * 2 ** attempt);
		}
	}
	throw lastError;
}

module.exports = { withRetry };
