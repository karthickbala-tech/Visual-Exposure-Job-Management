'use strict';

const { TABLES } = require('../config');
const { esc, inList, NOT_DELETED, unwrap } = require('../db');

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
		findByDealId: (dealId) => db.selectOne(TABLES.job, `crm_deal_id = '${esc(dealId)}' AND ${NOT_DELETED}`),
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
		/** { stage: count } in one grouped query. */
		async countByStage() {
			const rows = unwrap(await db.run(`SELECT stage, COUNT(ROWID) FROM job WHERE ${NOT_DELETED} GROUP BY stage`), 'job');
			return Object.fromEntries(rows.map((r) => [r.stage, Number(r['COUNT(ROWID)'])]));
		},
		insert: (row) => first(db.insert(TABLES.job, row)),
		update: (row) => db.update(TABLES.job, row),
	};

	const tasks = {
		findById: (id) => db.selectOne(TABLES.task, `${eqId(id)} AND ${NOT_DELETED}`),
		/** How many unfinished tasks were due before `today`. */
		async countOverdue(today, terminalStages) {
			const rows = unwrap(
				await db.run(`SELECT COUNT(ROWID) FROM task WHERE ${NOT_DELETED} AND required_finish < '${esc(today)}' AND stage NOT IN ${inList(terminalStages)}`),
				'task'
			);
			return Number((rows[0] || {})['COUNT(ROWID)'] || 0);
		},
		findBySwms: (swmsId) => db.selectOne(TABLES.task, `swms_id = '${esc(swmsId)}' AND ${NOT_DELETED}`),
		listByJob: (jobId) =>
			db.select(TABLES.task, {
				where: `job_id = '${esc(jobId)}' AND ${NOT_DELETED}`,
				orderBy: 'CREATEDTIME ASC',
				limit: 300,
			}),
		list({ jobId, type, stage, ids, excludeStages, from, to, orderBy, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (jobId) where.push(`job_id = '${esc(jobId)}'`);
			if (excludeStages && excludeStages.length) where.push(`stage NOT IN ${inList(excludeStages)}`);
			if (from) where.push(`scheduled_date >= '${esc(from)}'`);
			if (to) where.push(`scheduled_date <= '${esc(to)}'`);
			if (type) where.push(`task_type = '${esc(type)}'`);
			if (stage) where.push(`stage = '${esc(stage)}'`);
			if (ids) where.push(`ROWID IN ${inList(ids) || "('0')"}`);
			return db.select(TABLES.task, {
				where: where.join(' AND '),
				orderBy: orderBy || 'CREATEDTIME DESC',
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
		findByEmail: (email) => db.selectOne(TABLES.person, `email = '${esc(email)}' AND ${NOT_DELETED}`),
		list({ active, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (active !== undefined) where.push(`is_active = '${active}'`);
			return db.select(TABLES.person, { where: where.join(' AND '), orderBy: 'first_name ASC', limit, offset });
		},
		insert: (row) => first(db.insert(TABLES.person, row)),
		update: (row) => db.update(TABLES.person, row),
		/** Active people who hold a role (roles is stored as JSON text, so match on the quoted name). */
		listByRole: (role) =>
			db.select(TABLES.person, { where: `roles LIKE '%"${esc(role)}"%' AND is_active = 'true' AND ${NOT_DELETED}`, limit: 300 }),
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
		/** Send finished post-job checklists on a task back to their owners (after a reject or reopen). */
		async reopenPostForTask(taskId) {
			const rows = await db.select(TABLES.checklist, {
				where: `task_id = '${esc(taskId)}' AND phase = 'post' AND checklist_status = 'Completed'`,
				limit: 300,
			});
			if (rows.length) await db.update(TABLES.checklist, rows.map((r) => ({ ROWID: r.ROWID, checklist_status: 'In Progress' })));
			return rows.length;
		},
	};

	const templates = {
		findByKey: (key) => db.selectOne(TABLES.checklistTemplate, `template_key = '${esc(key)}'`),
		insert: (row) => first(db.insert(TABLES.checklistTemplate, row)),
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
		update: (row) => db.update(TABLES.timeEntry, row),
		findByChecklist: (checklistId) => db.selectOne(TABLES.timeEntry, `checklist_id = '${esc(checklistId)}'`),
		/** Hours need approving again after a reject or reopen. */
		async unapproveForTask(taskId) {
			const rows = await db.select(TABLES.timeEntry, { where: `task_id = '${esc(taskId)}'`, limit: 300 });
			const approved = rows.filter((r) => r.approved === true || r.approved === 'true');
			if (approved.length) await db.update(TABLES.timeEntry, approved.map((r) => ({ ROWID: r.ROWID, approved: 'false' })));
			return approved.length;
		},
		listByTask: (taskId) => db.select(TABLES.timeEntry, { where: `task_id = '${esc(taskId)}'`, limit: 300 }),
		/** Mark every entry on a task approved (one update call for all rows). */
		async approveForTask(taskId) {
			const rows = await db.select(TABLES.timeEntry, { where: `task_id = '${esc(taskId)}'`, limit: 300 });
			const pending = rows.filter((r) => r.approved !== true && r.approved !== 'true');
			if (pending.length) await db.update(TABLES.timeEntry, pending.map((r) => ({ ROWID: r.ROWID, approved: 'true' })));
			return pending.length;
		},
	};

	const complianceTypes = {
		findById: (id) => db.selectOne(TABLES.complianceType, eqId(id)),
		list: () => db.select(TABLES.complianceType, { orderBy: 'name ASC', limit: 300 }),
		insert: (row) => first(db.insert(TABLES.complianceType, row)),
	};

	const compliance = {
		findById: (id) => db.selectOne(TABLES.complianceItem, eqId(id)),
		list: ({ personId, limit, offset } = {}) =>
			db.select(TABLES.complianceItem, {
				where: personId ? `person_id = '${esc(personId)}' AND is_active = 'true'` : "is_active = 'true'",
				orderBy: 'expiry_date ASC',
				limit,
				offset,
			}),
		/** Active items whose next reminder date has arrived. */
		listDue: (untilDateTime, limit) =>
			db.select(TABLES.complianceItem, {
				where: `is_active = 'true' AND next_reminder_at <= '${esc(untilDateTime)}'`,
				orderBy: 'next_reminder_at ASC',
				limit,
			}),
		insert: (row) => first(db.insert(TABLES.complianceItem, row)),
		update: (row) => db.update(TABLES.complianceItem, row),
	};

	const outbox = {
		findByKey: (key) => db.selectOne(TABLES.integrationJob, `idempotency_key = '${esc(key)}'`),
		/** Pending work whose time has come, oldest first. */
		listDue: (untilDateTime, limit) =>
			db.select(TABLES.integrationJob, {
				where: `job_status = 'Pending' AND next_run_at <= '${esc(untilDateTime)}'`,
				orderBy: 'next_run_at ASC',
				limit,
			}),
		insert: (row) => first(db.insert(TABLES.integrationJob, row)),
		update: (row) => db.update(TABLES.integrationJob, row),
	};

	const settings = {
		findByKey: (key) => db.selectOne(TABLES.setting, `setting_key = '${esc(key)}'`),
		insert: (row) => first(db.insert(TABLES.setting, row)),
		update: (row) => db.update(TABLES.setting, row),
	};

	const files = {
		findById: (id) => db.selectOne(TABLES.fileAsset, `${eqId(id)} AND ${NOT_DELETED}`),
		listForEntity: (type, id) =>
			db.select(TABLES.fileAsset, {
				where: `entity_type = '${esc(type)}' AND entity_id = '${esc(id)}' AND ${NOT_DELETED}`,
				orderBy: 'CREATEDTIME DESC',
				limit: 300,
			}),
		insert: (row) => first(db.insert(TABLES.fileAsset, row)),
		update: (row) => db.update(TABLES.fileAsset, row),
	};

	const swms = {
		findById: (id) => db.selectOne(TABLES.swms, eqId(id)),
		/** SWMS still waiting for a signature. */
		async countAwaiting() {
			const rows = unwrap(await db.run("SELECT COUNT(ROWID) FROM swms WHERE swms_status IN ('Created', 'PM Signed')"), 'swms');
			return Number((rows[0] || {})['COUNT(ROWID)'] || 0);
		},
		insert: (row) => first(db.insert(TABLES.swms, row)),
		update: (row) => db.update(TABLES.swms, row),
	};

	const issues = {
		findById: (id) => db.selectOne(TABLES.issue, `${eqId(id)} AND ${NOT_DELETED}`),
		list({ status, taskId, reportedBy, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (status) where.push(`issue_status = '${esc(status)}'`);
			if (taskId) where.push(`task_id = '${esc(taskId)}'`);
			if (reportedBy) where.push(`reported_by_id = '${esc(reportedBy)}'`);
			return db.select(TABLES.issue, { where: where.join(' AND '), orderBy: 'CREATEDTIME DESC', limit, offset });
		},
		/** An unresolved issue the same checklist question already raised on this task. */
		findOpenBySubject: (taskId, subject) =>
			db.selectOne(
				TABLES.issue,
				`task_id = '${esc(taskId)}' AND subject = '${esc(subject.slice(0, 255))}' AND source_kind = 'checklist' AND issue_status IN ('Open', 'In Progress') AND ${NOT_DELETED}`
			),
		/** { status: count } in one grouped query. */
		async countByStatus() {
			const rows = unwrap(await db.run(`SELECT issue_status, COUNT(ROWID) FROM issue WHERE ${NOT_DELETED} GROUP BY issue_status`), 'issue');
			return Object.fromEntries(rows.map((r) => [r.issue_status, Number(r['COUNT(ROWID)'])]));
		},
		insert: (row) => first(db.insert(TABLES.issue, row)),
		update: (row) => db.update(TABLES.issue, row),
	};

	const registerItems = {
		findById: (id) => db.selectOne(TABLES.registerItem, `${eqId(id)} AND ${NOT_DELETED}`),
		list({ kind, locationId, limit, offset } = {}) {
			const where = [NOT_DELETED];
			if (kind) where.push(`kind = '${esc(kind)}'`);
			if (locationId) where.push(`location_id = '${esc(locationId)}'`);
			return db.select(TABLES.registerItem, { where: where.join(' AND '), orderBy: 'code ASC', limit, offset });
		},
		async findByIds(ids) {
			const list = inList(ids);
			return list ? db.select(TABLES.registerItem, { where: `ROWID IN ${list} AND ${NOT_DELETED}`, limit: 300 }) : [];
		},
		insert: (row) => first(db.insert(TABLES.registerItem, row)),
		update: (row) => db.update(TABLES.registerItem, row),
	};

	const locations = {
		findById: (id) => db.selectOne(TABLES.location, eqId(id)),
		list: () => db.select(TABLES.location, { orderBy: 'name ASC', limit: 300 }),
		insert: (row) => first(db.insert(TABLES.location, row)),
		update: (row) => db.update(TABLES.location, row),
	};

	const devices = {
		list: ({ limit, offset } = {}) => db.select(TABLES.device, { orderBy: 'CREATEDTIME DESC', limit, offset }),
	};

	return { registerItems, locations, devices, jobs, tasks, assignees, people, activity, checklists, templates, timeEntries, issues, swms, files, settings, complianceTypes, compliance, outbox };
}

module.exports = { createRepos };
