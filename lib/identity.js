'use strict';

const catalyst = require('zcatalyst-sdk-node');
const { ROLES, CATALYST_ADMIN_ROLE, TABLES } = require('./config');
const { unauthenticated, forbidden } = require('./errors');
const { createDb, esc, toBool, NOT_DELETED } = require('./db');

/** Map a Catalyst role name to one of our roles (or null). */
function mapCatalystRole(name) {
	if (!name) return null;
	if (name === CATALYST_ADMIN_ROLE) return 'admin';
	return ROLES.includes(name) ? name : null;
}

/**
 * Work out who is calling. Identity comes from Catalyst Authentication (user scope);
 * data is read with an admin-scope app because the tables are closed to browser roles.
 *
 * Returns { user, person, roles, db } or throws 401/403.
 */
async function resolveActor(req) {
	const userApp = catalyst.initialize(req);
	let user;
	try {
		user = await userApp.userManagement().getCurrentUser();
	} catch (err) {
		throw unauthenticated();
	}
	if (!user) throw unauthenticated();

	const catalystRole = mapCatalystRole(user.role_details && user.role_details.role_name);
	if (!catalystRole) throw forbidden('Your account has no role in this application');

	const adminApp = catalyst.initialize(req, { scope: 'admin' });
	const db = createDb(adminApp);

	const email = user.email_id || '';
	const person = email
		? await db.selectOne(TABLES.person, `email = '${esc(email)}' AND ${NOT_DELETED}`)
		: null;

	if (person && !toBool(person.is_active)) throw forbidden('This account is inactive');

	return { user, person, roles: [catalystRole], db, app: adminApp };
}

module.exports = { resolveActor, mapCatalystRole };
