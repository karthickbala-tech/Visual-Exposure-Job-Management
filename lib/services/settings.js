'use strict';

const { AppError, forbidden, badRequest } = require('../errors');
const { validateMatrix, effectiveMatrix } = require('../domain/matrix');
const { toDbDateTime } = require('../time');

const MATRIX_KEY = 'authz.matrix';
const MATRIX_CACHE_KEY = 'authz.matrix';
const MATRIX_FRESH_MS = 5 * 60 * 1000;
const MAX_JSON = 9000; // column limit is 10,000 characters

/**
 * The permission matrix for this request. Cached for five minutes in the config segment, so most
 * requests cost one cache read and no query. `null` means "use the built-in defaults".
 */
async function loadMatrix({ repos, cache }) {
	const cached = cache ? await cache.get(MATRIX_CACHE_KEY, MATRIX_FRESH_MS) : null;
	if (cached) return cached.override ? effectiveMatrix(cached.override) : undefined;

	const row = await repos.settings.findByKey(MATRIX_KEY);
	let override = null;
	try {
		override = row && row.setting_value ? JSON.parse(row.setting_value) : null;
	} catch {
		override = null; // a damaged value must never lock people out: fall back to defaults
	}
	if (cache) await cache.set(MATRIX_CACHE_KEY, { override });
	return override ? effectiveMatrix(override) : undefined;
}

function requireAdmin(ctx) {
	if (!ctx.actor.roles.includes('admin')) throw forbidden('Only an administrator can change permissions');
}

/** The matrix in force right now, plus whether it has been customised. */
async function getAuthz(ctx) {
	requireAdmin(ctx);
	const row = await ctx.repos.settings.findByKey(MATRIX_KEY);
	let override = null;
	try {
		override = row && row.setting_value ? JSON.parse(row.setting_value) : null;
	} catch {
		override = null;
	}
	return { matrix: effectiveMatrix(override), customised: !!override, version: row ? Number(row.version_no || 0) : 0 };
}

/** Replace the overridden roles. Validated first; the admin role can never be reduced. */
async function setAuthz(ctx, body) {
	requireAdmin(ctx);
	const matrix = body && body.matrix;
	const problems = validateMatrix(matrix);
	if (problems.length) throw badRequest('That permission matrix is not valid', problems);
	const json = JSON.stringify(matrix);
	if (json.length > MAX_JSON) throw new AppError(413, 'value_too_large', 'The matrix is too large');

	const row = await ctx.repos.settings.findByKey(MATRIX_KEY);
	const version = row ? Number(row.version_no || 0) + 1 : 1;
	const by = ctx.actor.person ? ctx.actor.person.ROWID : undefined;
	if (row) await ctx.repos.settings.update({ ROWID: row.ROWID, setting_value: json, version_no: version, updated_by: by });
	else await ctx.repos.settings.insert({ setting_key: MATRIX_KEY, setting_value: json, version_no: version, description: 'Permission matrix overrides', updated_by: by });

	await ctx.repos.activity.insert({
		entity_type: 'setting',
		entity_id: row ? row.ROWID : 0,
		activity_type: 'updated',
		actor_id: by,
		logged_at: toDbDateTime(ctx.now()),
		to_value: MATRIX_KEY,
		payload: JSON.stringify({ version }),
	});
	if (ctx.configCache) await ctx.configCache.clear(MATRIX_CACHE_KEY);
	return { version, matrix: effectiveMatrix(matrix) };
}

module.exports = { loadMatrix, getAuthz, setAuthz, MATRIX_KEY };
