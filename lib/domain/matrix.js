'use strict';

const { ROLES } = require('../config');
const { DEFAULT_MATRIX } = require('../authz');

/**
 * Rules for an edited permission matrix. Pure, no I/O.
 * An override may change any role except it can never reduce the admin role (so nobody can lock
 * everyone out). Roles missing from an override keep their built-in permissions.
 */
const VERBS = ['view', 'create', 'edit', 'delete'];
const SCOPES = ['all', 'assigned', 'own'];
const RESOURCES = ['*', 'jobs', 'tasks', 'sites', 'signs', 'people', 'issues', 'swms'];

/** Problems with a proposed matrix (empty list = acceptable). */
function validateMatrix(matrix) {
	if (!matrix || typeof matrix !== 'object' || Array.isArray(matrix)) return ['The matrix must be an object of roles'];
	const problems = [];
	for (const [role, grants] of Object.entries(matrix)) {
		if (!ROLES.includes(role)) {
			problems.push(`Unknown role: ${role}`);
			continue;
		}
		if (!grants || typeof grants !== 'object' || Array.isArray(grants)) {
			problems.push(`${role}: permissions must be an object`);
			continue;
		}
		for (const [resource, g] of Object.entries(grants)) {
			if (!RESOURCES.includes(resource)) problems.push(`${role}: unknown resource ${resource}`);
			if (!g || !Array.isArray(g.verbs) || g.verbs.some((v) => !VERBS.includes(v))) problems.push(`${role}.${resource}: verbs must be from ${VERBS.join(', ')}`);
			if (!g || !SCOPES.includes(g.scope)) problems.push(`${role}.${resource}: scope must be one of ${SCOPES.join(', ')}`);
		}
	}
	const admin = matrix.admin && matrix.admin['*'];
	if (matrix.admin !== undefined && !(admin && admin.scope === 'all' && VERBS.every((v) => admin.verbs.includes(v)))) {
		problems.push('The admin role must keep full access to everything');
	}
	return problems;
}

/** Effective matrix: the built-in defaults with any overridden roles replaced. */
const effectiveMatrix = (override) => ({ ...DEFAULT_MATRIX, ...(override || {}) });

module.exports = { VERBS, SCOPES, RESOURCES, validateMatrix, effectiveMatrix };
