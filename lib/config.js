'use strict';

/**
 * Constants shared by the api, events and jobs functions.
 * Environment-specific values (project id, bucket name, etc.) are NOT here:
 * they come from environment variables or the `setting` table.
 */

const ROLES = Object.freeze([
	'admin',
	'project_manager',
	'fab_manager',
	'install_coordinator',
	'second_ic',
	'installer',
	'fab_worker',
	'workshop',
	'designer',
	'contractor',
	'viewer',
]);

/** Catalyst console role that maps to our `admin` role. */
const CATALYST_ADMIN_ROLE = 'App Administrator';

const TASK_TYPES = Object.freeze(['design', 'fabrication', 'install']);

const JOB_STAGES = Object.freeze([
	'Preparation',
	'In Progress',
	'On Hold',
	'Completed',
	'Completed - Closed',
	'Cancelled',
]);

/** Table names. Keep in one place so a rename is a one-line change. */
const TABLES = Object.freeze({
	company: 'company',
	person: 'person',
	site: 'site',
	device: 'device',
	job: 'job',
	signGroup: 'sign_group',
	sign: 'sign',
	swms: 'swms',
	task: 'task',
	taskAssignee: 'task_assignee',
	taskSign: 'task_sign',
	checklistTemplate: 'checklist_template',
	checklist: 'checklist',
	hazardLibrary: 'hazard_library',
	issue: 'issue',
	timeEntry: 'time_entry',
	location: 'location',
	registerItem: 'register_item',
	fileAsset: 'file_asset',
	activity: 'activity',
	complianceType: 'compliance_type',
	complianceItem: 'compliance_item',
	setting: 'setting',
	integrationJob: 'integration_job',
});

/** Tables that have an `is_deleted` column (soft delete). Inserts default it to 'false'. */
const SOFT_DELETE_TABLES = Object.freeze([
	'person', 'company', 'site', 'job', 'sign', 'task', 'issue', 'register_item', 'file_asset',
]);

/** ZCQL returns at most 300 rows per query. */
const ZCQL_MAX_ROWS = 300;

module.exports = {
	ROLES, CATALYST_ADMIN_ROLE, TASK_TYPES, JOB_STAGES, TABLES, SOFT_DELETE_TABLES, ZCQL_MAX_ROWS,
};
