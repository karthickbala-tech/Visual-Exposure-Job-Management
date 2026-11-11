'use strict';

/**
 * Personal details of a worker (the Creator Employee_Database fields that are not work fields). Pure, no I/O.
 * They are stored as JSON in the encrypted person.profile_private column. Who can see and change which field follows the
 * role hierarchy the owner asked for: admin, then managers, then the person themself. Change it here, in one place.
 */

/** key -> label and kind. The labels are the Creator names. */
const FIELDS = Object.freeze({
	address: { label: 'Address Line 1', kind: 'text', max: 300 },
	date_of_birth: { label: 'Date of Birth', kind: 'date' },
	sex: { label: 'Sex', kind: 'choice', options: ['Male', 'Female', 'They/Them', 'Prefer not to answer'] },
	personal_email: { label: 'Personal Email Address', kind: 'email', max: 200 },
	start_date: { label: 'Start Date', kind: 'date' },
	cessation_date: { label: 'Cessation Date', kind: 'date' },
	skills: { label: 'Skills Etc', kind: 'text', max: 1000 },
	emergency_contact: { label: 'Emergency Contact', kind: 'text', max: 1000 },
});
const KEYS = Object.freeze(Object.keys(FIELDS));

const ADMIN = ['admin'];
const MANAGERS = ['project_manager', 'fab_manager', 'install_coordinator'];

/** What managers may see and change. Everything else is for admin and for the person themself. */
const MANAGER_VIEW = Object.freeze(['start_date', 'cessation_date', 'skills', 'emergency_contact']);
const MANAGER_EDIT = Object.freeze(['start_date', 'cessation_date', 'skills']);

const has = (roles, list) => (roles || []).some((r) => list.includes(r));

/** The fields these roles may see. `isSelf` is true when the profile is the signed-in person's own. */
function viewableFields(roles, isSelf) {
	if (has(roles, ADMIN) || isSelf) return [...KEYS];
	if (has(roles, MANAGERS)) return [...MANAGER_VIEW];
	return [];
}

/** The fields these roles may change. A person cannot change their own record; their manager does. */
function editableFields(roles) {
	if (has(roles, ADMIN)) return [...KEYS];
	if (has(roles, MANAGERS)) return [...MANAGER_EDIT];
	return [];
}

module.exports = { FIELDS, KEYS, viewableFields, editableFields };
