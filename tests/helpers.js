'use strict';

/**
 * In-memory fake of the repositories (lib/repos) so business rules can be tested
 * without Catalyst. It records activity rows and published events.
 */
let seq = 105747000001000000n;
const nextId = () => String(++seq);

function makeWorld({ roles = ['admin'], person = { ROWID: '105747000000900001', first_name: 'Test', last_name: 'User' } } = {}) {
	const db = { jobs: [], tasks: [], links: [], people: [], activity: [], checklists: [], templates: [], time: [], issues: [] };
	const published = [];

	if (person) db.people.push({ ROWID: person.ROWID, first_name: person.first_name, last_name: person.last_name });

	const clone = (r) => (r ? { ...r } : r);
	const patch = (rows, row) => {
		const i = rows.findIndex((r) => String(r.ROWID) === String(row.ROWID));
		if (i >= 0) rows[i] = { ...rows[i], ...row };
	};
	const byIds = (rows, ids) => (ids ? rows.filter((r) => ids.map(String).includes(String(r.ROWID))) : rows);

	const repos = {
		jobs: {
			findById: async (id) => clone(db.jobs.find((j) => String(j.ROWID) === String(id))),
			list: async ({ stage, ids } = {}) =>
				byIds(db.jobs, ids).filter((j) => !stage || j.stage === stage).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.jobs.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.jobs, row),
		},
		tasks: {
			findById: async (id) => clone(db.tasks.find((t) => String(t.ROWID) === String(id))),
			listByJob: async (jobId) => db.tasks.filter((t) => String(t.job_id) === String(jobId)).map(clone),
			list: async ({ jobId, type, stage, ids } = {}) =>
				byIds(db.tasks, ids)
					.filter((t) => (!jobId || String(t.job_id) === String(jobId)) && (!type || t.task_type === type) && (!stage || t.stage === stage))
					.map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.tasks.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.tasks, row),
		},
		assignees: {
			listForTask: async (taskId) => db.links.filter((l) => String(l.task_id) === String(taskId)).map(clone),
			listForPerson: async (personId) => db.links.filter((l) => String(l.person_id) === String(personId)).map(clone),
			add: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.links.push(r);
				return clone(r);
			},
			remove: async (ids) => {
				db.links = db.links.filter((l) => !ids.map(String).includes(String(l.ROWID)));
			},
		},
		people: { findByIds: async (ids) => byIds(db.people, ids).map(clone) },
		activity: { insert: async (row) => (db.activity.push(row), row) },
		checklists: {
			findById: async (id) => clone(db.checklists.find((c) => String(c.ROWID) === String(id))),
			findMine: async ({ taskId, personId, phase }) =>
				clone(db.checklists.find((c) => String(c.task_id) === String(taskId) && String(c.assignee_id) === String(personId) && c.phase === phase)),
			listByTask: async (taskId) => db.checklists.filter((c) => String(c.task_id) === String(taskId)).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.checklists.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.checklists, row),
			reopenPostForTask: async (taskId) => {
				const rows = db.checklists.filter((c) => String(c.task_id) === String(taskId) && c.phase === 'post' && c.checklist_status === 'Completed');
				rows.forEach((c) => (c.checklist_status = 'In Progress'));
				return rows.length;
			},
		},
		issues: {
			findById: async (id) => clone(db.issues.find((i) => String(i.ROWID) === String(id))),
			list: async ({ status, taskId, reportedBy } = {}) =>
				db.issues
					.filter((i) => (!status || i.issue_status === status) && (!taskId || String(i.task_id) === String(taskId)) && (!reportedBy || String(i.reported_by_id) === String(reportedBy)))
					.map(clone),
			findOpenBySubject: async (taskId, subject) =>
				clone(db.issues.find((i) => String(i.task_id) === String(taskId) && i.subject === subject.slice(0, 255) && i.source_kind === 'checklist' && ['Open', 'In Progress'].includes(i.issue_status))),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.issues.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.issues, row),
		},
		templates: {
			findByKey: async (key) => clone(db.templates.find((t) => t.template_key === key)),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.templates.push(r);
				return clone(r);
			},
			findLatest: async ({ taskType, phase, role }) =>
				clone(
					db.templates
						.filter((t) => t.task_type === taskType && t.phase === phase && t.assignee_role === role && t.is_active !== false)
						.sort((a, b) => b.version_no - a.version_no)[0]
				),
		},
		timeEntries: {
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.time.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.time, row),
			findByChecklist: async (id) => clone(db.time.find((e) => String(e.checklist_id) === String(id))),
			unapproveForTask: async (taskId) => {
				const rows = db.time.filter((e) => String(e.task_id) === String(taskId) && e.approved === 'true');
				rows.forEach((e) => (e.approved = 'false'));
				return rows.length;
			},
			listByTask: async (taskId) => db.time.filter((e) => String(e.task_id) === String(taskId)).map(clone),
			approveForTask: async (taskId) => {
				const rows = db.time.filter((e) => String(e.task_id) === String(taskId) && e.approved !== 'true');
				rows.forEach((e) => (e.approved = 'true'));
				return rows.length;
			},
		},
	};

	const log = { info() {}, warn() {}, error() {} };
	const ctx = {
		actor: { roles, person: person ? { ROWID: person.ROWID } : null },
		repos,
		log,
		now: () => new Date('2026-11-02T10:00:00Z'),
		publish: async (type, payload) => published.push({ type, payload }),
	};

	/** Switch the acting user without losing data. */
	const as = (newRoles, personId = '105747000000900001') => ({
		...ctx,
		actor: { roles: newRoles, person: personId ? { ROWID: personId } : null },
	});

	return { ctx, db, published, as };
}

async function rejects(promise, status, code) {
	try {
		await promise;
	} catch (e) {
		const assert = require('node:assert/strict');
		assert.equal(e.status, status, `expected HTTP ${status}, got ${e.status} (${e.message})`);
		if (code) assert.equal(e.code, code);
		return e;
	}
	require('node:assert/strict').fail(`expected a ${status} error, but nothing was thrown`);
}

module.exports = { makeWorld, rejects };
