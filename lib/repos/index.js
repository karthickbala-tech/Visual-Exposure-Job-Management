'use strict';

const { TABLES } = require('../config');
const { esc, inList, NOT_DELETED } = require('../db');

const eqId = (id) => `ROWID = '${esc(id)}'`;

/**
 * Data access, one place for SQL. Services depend on this interface, not on ZCQL,
 * so business rules can be tested with an in-memory fake (see tests/helpers.js).
 * Every list is capped and paginated; related rows are fetched in batches.
 */
function createRepos(db) {
	const first = async (promise) => {
		const rows = await promise;
		return Array.isArray(rows) ? rows[0] : rows;
	};

	const jobs = {
		findById: (id) => db.selectOne(TABLES.job, `${eqId(id)} AND ${NOT_DELETED}`),
		list({ stage, ids, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (stage) where.push(`stage = '${esc(stage)}'`);
			if (ids) where.push(`ROWID IN ${inList(ids) || "('0')"}`);
			return db.select(TABLES.job, {
				where: where.join(' AND '),
				orderBy: 'CREATEDTIME DESC',
				limit,
				offset,
			});
		},
		insert: (row) => first(db.insert(TABLES.job, row)),
		update: (row) => db.update(TABLES.job, row),
	};

	const tasks = {
		findById: (id) => db.selectOne(TABLES.task, `${eqId(id)} AND ${NOT_DELETED}`),
		listByJob: (jobId) =>
			db.select(TABLES.task, {
				where: `job_id = '${esc(jobId)}' AND ${NOT_DELETED}`,
				orderBy: 'CREATEDTIME ASC',
				limit: 300,
			}),
		list({ jobId, type, stage, ids, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (jobId) where.push(`job_id = '${esc(jobId)}'`);
			if (type) where.push(`task_type = '${esc(type)}'`);
			if (stage) where.push(`stage = '${esc(stage)}'`);
			if (ids) where.push(`ROWID IN ${inList(ids) || "('0')"}`);
			return db.select(TABLES.task, {
				where: where.join(' AND '),
				orderBy: 'CREATEDTIME DESC',
				limit,
				offset,
			});
		},
		insert: (row) => first(db.insert(TABLES.task, row)),
		update: (row) => db.update(TABLES.task, row),
	};

	const assignees = {
		listForTask: (taskId) =>
			db.select(TABLES.taskAssignee, { where: `task_id = '${esc(taskId)}'`, limit: 300 }),
		listForPerson: (personId) =>
			db.select(TABLES.taskAssignee, { where: `person_id = '${esc(personId)}'`, limit: 300 }),
		add: (row) => first(db.insert(TABLES.taskAssignee, row)),
		remove: (rowIds) => db.remove(TABLES.taskAssignee, rowIds),
	};

	const people = {
		findByIds: async (ids) => {
			const list = inList(ids);
			if (!list) return [];
			return db.select(TABLES.person, { where: `ROWID IN ${list} AND ${NOT_DELETED}`, limit: 300 });
		},
	};

	const activity = {
		insert: (row) => db.insert(TABLES.activity, row),
	};

	const checklists = {
		findById: (id) => db.selectOne(TABLES.checklist, eqId(id)),
		/** The checklist one person has for one task phase (at most one). */
		findMine: ({ taskId, personId, phase }) =>
			db.selectOne(
				TABLES.checklist,
				`task_id = '${esc(taskId)}' AND assignee_id = '${esc(personId)}' AND phase = '${esc(phase)}'`
			),
		listByTask: (taskId) =>
			db.select(TABLES.checklist, { where: `task_id = '${esc(taskId)}'`, orderBy: 'CREATEDTIME ASC', limit: 300 }),
		insert: (row) => first(db.insert(TABLES.checklist, row)),
		update: (row) => db.update(TABLES.checklist, row),
	};

	const templates = {
		findByKey: (key) => db.selectOne(TABLES.checklistTemplate, `template_key = '${esc(key)}'`),
		/** Newest active template for a task type, phase and assignee role. */
		async findLatest({ taskType, phase, role }) {
			const rows = await db.select(TABLES.checklistTemplate, {
				where: `task_type = '${esc(taskType)}' AND phase = '${esc(phase)}' AND assignee_role = '${esc(role)}' AND is_active = 'true'`,
				orderBy: 'version_no DESC',
				limit: 1,
			});
			return rows[0] || null;
		},
	};

	const timeEntries = {
		insert: (row) => first(db.insert(TABLES.timeEntry, row)),
		listByTask: (taskId) => db.select(TABLES.timeEntry, { where: `task_id = '${esc(taskId)}'`, limit: 300 }),
		/** Mark every entry on a task approved (one update call for all rows). */
		async approveForTask(taskId) {
			const rows = await db.select(TABLES.timeEntry, { where: `task_id = '${esc(taskId)}'`, limit: 300 });
			const pending = rows.filter((r) => r.approved !== true && r.approved !== 'true');
			if (pending.length) await db.update(TABLES.timeEntry, pending.map((r) => ({ ROWID: r.ROWID, approved: 'true' })));
			return pending.length;
		},
	};

	return { jobs, tasks, assignees, people, activity, checklists, templates, timeEntries };
}

module.exports = { createRepos };
