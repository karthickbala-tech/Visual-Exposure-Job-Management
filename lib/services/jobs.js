'use strict';

const { TABLES, JOB_STAGES } = require('../config');
const { can, projectRow } = require('../authz');
const { forbidden } = require('../errors');
const { esc, inList, withBooleans, NOT_DELETED } = require('../db');
const { z, parse, schemas } = require('../validate');

const BOOL_COLUMNS = ['is_deleted'];

const listQuery = schemas.pagination.extend({
	stage: z.enum(JOB_STAGES).optional(),
});

/**
 * Jobs visible to the actor, newest first.
 * - scope 'all'      every non-deleted job
 * - scope 'assigned' only jobs that have a task assigned to the actor
 * Related rows are fetched in batches (no N+1).
 */
async function listJobs(actor, rawQuery = {}) {
	const grant = can(actor.roles, 'jobs', 'view');
	if (!grant.allowed) throw forbidden();

	const query = parse(listQuery, rawQuery);
	const { db } = actor;
	const filters = [NOT_DELETED];

	if (query.stage) filters.push(`stage = '${esc(query.stage)}'`);

	if (grant.scope === 'assigned') {
		if (!actor.person) return { items: [], count: 0 };
		const links = await db.select(TABLES.taskAssignee, {
			where: `person_id = '${esc(actor.person.ROWID)}'`,
			limit: 300,
		});
		const taskIds = inList(links.map((l) => l.task_id));
		if (!taskIds) return { items: [], count: 0 };
		const tasks = await db.select(TABLES.task, { where: `ROWID IN ${taskIds}`, limit: 300 });
		const jobIds = inList(tasks.map((t) => t.job_id));
		if (!jobIds) return { items: [], count: 0 };
		filters.push(`ROWID IN ${jobIds}`);
	}

	const rows = await db.select(TABLES.job, {
		where: filters.join(' AND '),
		orderBy: 'CREATEDTIME DESC',
		limit: query.limit,
		offset: query.offset,
	});

	const items = rows.map((r) => projectRow(actor.roles, 'jobs', withBooleans(r, BOOL_COLUMNS)));
	return { items, count: items.length };
}

module.exports = { listJobs };
