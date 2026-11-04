'use strict';

const { ROLES } = require('./config');

/**
 * Default permission matrix: role -> resource -> { verbs, scope }.
 *   scope: 'all'      every row
 *          'assigned' only rows linked to the signed-in person
 *          'own'      only rows the person created / is the subject of
 *
 * This is the SEED. At runtime the matrix is read from the `setting` table
 * (key `authz.matrix`) and cached; this default is used until it is set.
 * Anything not listed is denied.
 */
const ALL = ['view', 'create', 'edit', 'delete'];
const RW = ['view', 'create', 'edit'];
const R = ['view'];

const DEFAULT_MATRIX = Object.freeze({
	admin: { '*': { verbs: ALL, scope: 'all' } },
	project_manager: {
		hours: { verbs: R, scope: 'all' },
		companies: { verbs: RW, scope: 'all' },
		equipment: { verbs: RW, scope: 'all' },
		devices: { verbs: R, scope: 'all' },
		jobs: { verbs: RW, scope: 'all' },
		tasks: { verbs: RW, scope: 'all' },
		sites: { verbs: RW, scope: 'all' },
		signs: { verbs: RW, scope: 'all' },
		people: { verbs: R, scope: 'all' },
		issues: { verbs: RW, scope: 'all' },
		swms: { verbs: RW, scope: 'all' },
		compliance: { verbs: RW, scope: 'all' },
	},
	fab_manager: {
		hours: { verbs: R, scope: 'all' },
		companies: { verbs: R, scope: 'all' },
		equipment: { verbs: RW, scope: 'all' },
		devices: { verbs: R, scope: 'all' },
		jobs: { verbs: RW, scope: 'all' },
		tasks: { verbs: RW, scope: 'all' },
		sites: { verbs: R, scope: 'all' },
		signs: { verbs: R, scope: 'all' },
		people: { verbs: R, scope: 'all' },
		issues: { verbs: RW, scope: 'all' },
		compliance: { verbs: RW, scope: 'all' },
	},
	install_coordinator: {
		hours: { verbs: R, scope: 'all' },
		companies: { verbs: RW, scope: 'all' },
		equipment: { verbs: RW, scope: 'all' },
		devices: { verbs: R, scope: 'all' },
		jobs: { verbs: RW, scope: 'all' },
		tasks: { verbs: RW, scope: 'all' },
		sites: { verbs: RW, scope: 'all' },
		signs: { verbs: R, scope: 'all' },
		people: { verbs: R, scope: 'all' },
		issues: { verbs: RW, scope: 'all' },
		swms: { verbs: RW, scope: 'all' },
		compliance: { verbs: RW, scope: 'all' },
	},
	second_ic: {
		hours: { verbs: R, scope: 'all' },
		equipment: { verbs: R, scope: 'all' },
		jobs: { verbs: ['view', 'edit'], scope: 'all' },
		tasks: { verbs: RW, scope: 'all' },
		sites: { verbs: R, scope: 'all' },
		signs: { verbs: R, scope: 'all' },
		people: { verbs: R, scope: 'all' },
		issues: { verbs: RW, scope: 'all' },
	},
	installer: {
		hours: { verbs: R, scope: 'own' },
		compliance: { verbs: R, scope: 'own' },
		jobs: { verbs: R, scope: 'assigned' },
		tasks: { verbs: ['view', 'edit'], scope: 'assigned' },
		issues: { verbs: ['view', 'create'], scope: 'own' },
		swms: { verbs: ['view', 'edit'], scope: 'assigned' },
	},
	fab_worker: {
		hours: { verbs: R, scope: 'own' },
		equipment: { verbs: R, scope: 'all' },
		compliance: { verbs: R, scope: 'own' },
		jobs: { verbs: R, scope: 'assigned' },
		tasks: { verbs: ['view', 'edit'], scope: 'assigned' },
		issues: { verbs: ['view', 'create'], scope: 'own' },
	},
	workshop: {
		hours: { verbs: R, scope: 'own' },
		equipment: { verbs: ['view', 'edit'], scope: 'all' },
		compliance: { verbs: R, scope: 'own' },
		jobs: { verbs: R, scope: 'assigned' },
		tasks: { verbs: ['view', 'edit'], scope: 'assigned' },
		issues: { verbs: ['view', 'create'], scope: 'own' },
	},
	designer: {
		hours: { verbs: R, scope: 'own' },
		compliance: { verbs: R, scope: 'own' },
		jobs: { verbs: R, scope: 'assigned' },
		tasks: { verbs: ['view', 'edit'], scope: 'assigned' },
		issues: { verbs: ['view', 'create'], scope: 'own' },
	},
	contractor: {
		hours: { verbs: R, scope: 'own' },
		compliance: { verbs: R, scope: 'own' },
		jobs: { verbs: R, scope: 'assigned' },
		tasks: { verbs: ['view', 'edit'], scope: 'assigned' },
		swms: { verbs: ['view', 'edit'], scope: 'assigned' },
	},
	viewer: {
		jobs: { verbs: R, scope: 'all' },
		tasks: { verbs: R, scope: 'all' },
		sites: { verbs: R, scope: 'all' },
		signs: { verbs: R, scope: 'all' },
		issues: { verbs: R, scope: 'all' },
	},
});

/** Fields hidden from everyone except these roles. */
const FINANCIAL_ROLES = Object.freeze(['admin']);
const FINANCIAL_FIELDS = Object.freeze({
	jobs: ['design_cost', 'fab_cost', 'install_cost', 'flags'],
	tasks: ['labour_cost', 'variance'],
	people: ['hourly_rate'],
	time: ['labour_cost'],
});

/** Fields never sent to the browser for anyone. */
const NEVER_FIELDS = Object.freeze({
	people: ['profile_private'],
});

/**
 * Fields hidden from roles that only report or read (ISS-6). A field is hidden only when EVERY role the person holds hides it,
 * so a manager who is also crew still sees everything. Roles not listed (managers, admin) see all fields.
 */
const CREW_ISSUE_HIDDEN = Object.freeze(['crm_deal_id', 'owner_id', 'assigned_to_id', 'source_kind']);
const HIDDEN_FIELDS_BY_ROLE = Object.freeze({
	issues: Object.freeze({
		installer: CREW_ISSUE_HIDDEN,
		fab_worker: CREW_ISSUE_HIDDEN,
		workshop: CREW_ISSUE_HIDDEN,
		designer: CREW_ISSUE_HIDDEN,
		contractor: CREW_ISSUE_HIDDEN,
		viewer: Object.freeze([...CREW_ISSUE_HIDDEN, 'reported_by_id']),
	}),
});

/** Pick a grant for the first of the user's roles that allows the verb. */
function grantFor(matrix, roles, resource, verb) {
	let best = null;
	for (const role of roles) {
		const table = matrix[role];
		if (!table) continue;
		const g = table[resource] || table['*'];
		if (!g || !g.verbs.includes(verb)) continue;
		// Prefer the widest scope when a user holds several roles.
		if (!best || (g.scope === 'all' && best.scope !== 'all')) best = { ...g, role };
	}
	return best;
}

/** Returns { allowed, scope } for a (roles, resource, verb) check. */
function can(roles, resource, verb, matrix = DEFAULT_MATRIX) {
	const known = (roles || []).filter((r) => ROLES.includes(r));
	const g = grantFor(matrix, known, resource, verb);
	return g ? { allowed: true, scope: g.scope, role: g.role } : { allowed: false, scope: null, role: null };
}

/** Remove fields the actor must not see. Works on one row. */
function projectRow(roles, resource, row) {
	const out = { ...row };
	for (const f of NEVER_FIELDS[resource] || []) delete out[f];
	const seesMoney = (roles || []).some((r) => FINANCIAL_ROLES.includes(r));
	if (!seesMoney) {
		for (const f of FINANCIAL_FIELDS[resource] || []) delete out[f];
	}
	const hiddenByRole = HIDDEN_FIELDS_BY_ROLE[resource];
	if (hiddenByRole) {
		const known = (roles || []).filter((r) => ROLES.includes(r));
		if (known.length && known.every((r) => hiddenByRole[r])) {
			const common = known.map((r) => hiddenByRole[r]).reduce((a, b) => a.filter((f) => b.includes(f)));
			for (const f of common) delete out[f];
		}
	}
	return out;
}

/**
 * What the signed-in user may do, for the UI to show or hide controls.
 * Convenience only: the server re-checks every request.
 */
function permissionsFor(roles, matrix) {
	const allowed = (resource, verb) => can(roles, resource, verb, matrix).allowed;
	const scopeAll = (resource, verb) => can(roles, resource, verb, matrix).scope === 'all';
	return {
		createJob: allowed('jobs', 'create'),
		editJob: allowed('jobs', 'edit'),
		createTask: allowed('tasks', 'create'),
		assignPeople: scopeAll('tasks', 'edit'),
	};
}

module.exports = { DEFAULT_MATRIX, can, projectRow, permissionsFor, FINANCIAL_ROLES };
