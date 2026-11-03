'use strict';

/**
 * In-memory fake of the repositories (lib/repos) so business rules can be tested
 * without Catalyst. It records activity rows and published events.
 */
let seq = 105747000001000000n;
const nextId = () => String(++seq);

function makeWorld({ roles = ['admin'], person = { ROWID: '105747000000900001', first_name: 'Test', last_name: 'User' } } = {}) {
	const db = { jobs: [], tasks: [], links: [], people: [], activity: [], checklists: [], templates: [], time: [], issues: [], swms: [], files: [], settings: [], ctypes: [], citems: [], outbox: [], register: [], locations: [], devices: [], companies: [], sites: [], signs: [], signGroups: [] };
	const published = [];

	if (person) db.people.push({ ROWID: person.ROWID, first_name: person.first_name, last_name: person.last_name });

	const clone = (r) => (r ? { ...r } : r);
	const patch = (rows, row) => {
		if (Array.isArray(row)) return row.forEach((r) => patch(rows, r)); // batch update
		const i = rows.findIndex((r) => String(r.ROWID) === String(row.ROWID));
		if (i >= 0) rows[i] = { ...rows[i], ...row };
	};
	const byIds = (rows, ids) => (ids ? rows.filter((r) => ids.map(String).includes(String(r.ROWID))) : rows);

	const repos = {
		signGroups: {
			listByJob: async (jobId) => db.signGroups.filter((g) => String(g.job_id) === String(jobId)).map(clone),
			insertMany: async (rows) => rows.forEach((row) => db.signGroups.push({ ROWID: nextId(), ...row })),
			update: async (rows) => patch(db.signGroups, rows),
		},
		companies: {
			findById: async (id) => clone(db.companies.find((r) => String(r.ROWID) === String(id))),
			list: async () => db.companies.map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.companies.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.companies, row),
		},
		sites: {
			findById: async (id) => clone(db.sites.find((r) => String(r.ROWID) === String(id))),
			list: async () => db.sites.map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.sites.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.sites, row),
		},
		signs: {
			findById: async (id) => clone(db.signs.find((r) => String(r.ROWID) === String(id))),
			list: async () => db.signs.map(clone),
			listByJob: async (jobId) => db.signs.filter((s) => String(s.job_id) === String(jobId)).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.signs.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.signs, row),
		},
		registerItems: {
			findById: async (id) => clone(db.register.find((r) => String(r.ROWID) === String(id))),
			list: async ({ kind, locationId } = {}) => db.register.filter((r) => (!kind || r.kind === kind) && (!locationId || String(r.location_id) === String(locationId))).map(clone),
			findByIds: async (ids) => byIds(db.register, ids).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.register.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.register, row),
		},
		locations: {
			findById: async (id) => clone(db.locations.find((r) => String(r.ROWID) === String(id))),
			list: async () => db.locations.map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.locations.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.locations, row),
		},
		devices: { list: async () => db.devices.map(clone) },
		jobs: {
			findById: async (id) => clone(db.jobs.find((j) => String(j.ROWID) === String(id))),
			findByDealId: async (dealId) => clone(db.jobs.find((j) => j.crm_deal_id === dealId)),
			countByStage: async () => db.jobs.reduce((m, j) => ({ ...m, [j.stage]: (m[j.stage] || 0) + 1 }), {}),
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
			countOverdue: async (today, terminal) =>
				db.tasks.filter((t) => t.required_finish && t.required_finish < today && !terminal.includes(t.stage)).length,
			findBySwms: async (swmsId) => clone(db.tasks.find((t) => String(t.swms_id) === String(swmsId))),
			listByJob: async (jobId) => db.tasks.filter((t) => String(t.job_id) === String(jobId)).map(clone),
			list: async ({ jobId, type, stage, ids, excludeStages, from, to } = {}) =>
				byIds(db.tasks, ids)
					.filter(
						(t) =>
							(!jobId || String(t.job_id) === String(jobId)) &&
							(!type || t.task_type === type) &&
							(!stage || t.stage === stage) &&
							(!excludeStages || !excludeStages.includes(t.stage)) &&
							(!from || (t.scheduled_date && t.scheduled_date >= from)) &&
							(!to || (t.scheduled_date && t.scheduled_date <= to))
					)
					.sort((a, b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')))
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
		people: {
			findByIds: async (ids) => byIds(db.people, ids).map(clone),
			findByEmail: async (email) => clone(db.people.find((p) => p.email === email)),
			list: async ({ active } = {}) => db.people.filter((p) => active === undefined || (p.is_active !== false) === active).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.people.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.people, row),
			listByRole: async (role) => db.people.filter((p) => (p.roles || []).includes(role)).map(clone),
		},
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
		outbox: {
			findById: async (id) => clone(db.outbox.find((o) => String(o.ROWID) === String(id))),
			list: async ({ status } = {}) => db.outbox.filter((o) => !status || o.job_status === status).map(clone),
			findByKey: async (key) => clone(db.outbox.find((o) => o.idempotency_key === key)),
			listDue: async (until) => db.outbox.filter((o) => o.job_status === 'Pending' && o.next_run_at && o.next_run_at <= until).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.outbox.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.outbox, row),
		},
		complianceTypes: {
			findById: async (id) => clone(db.ctypes.find((t) => String(t.ROWID) === String(id))),
			list: async () => db.ctypes.map(clone),
			insertMany: async (rows) => rows.forEach((row) => db.ctypes.push({ ROWID: nextId(), ...row })),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.ctypes.push(r);
				return clone(r);
			},
		},
		compliance: {
			findById: async (id) => clone(db.citems.find((i) => String(i.ROWID) === String(id))),
			list: async ({ personId } = {}) => db.citems.filter((i) => i.is_active !== 'false' && (!personId || String(i.person_id) === String(personId))).map(clone),
			listDue: async (until) => db.citems.filter((i) => i.is_active !== 'false' && i.next_reminder_at && i.next_reminder_at <= until).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.citems.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.citems, row),
		},
		settings: {
			findByKey: async (key) => clone(db.settings.find((s) => s.setting_key === key)),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.settings.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.settings, row),
		},
		files: {
			findById: async (id) => clone(db.files.find((f) => String(f.ROWID) === String(id))),
			listForEntity: async (type, id) => db.files.filter((f) => f.entity_type === type && String(f.entity_id) === String(id)).map(clone),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.files.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.files, row),
		},
		swms: {
			findById: async (id) => clone(db.swms.find((s) => String(s.ROWID) === String(id))),
			insert: async (row) => {
				const r = { ROWID: nextId(), ...row };
				db.swms.push(r);
				return clone(r);
			},
			update: async (row) => patch(db.swms, row),
			countAwaiting: async () => db.swms.filter((s) => ['Created', 'PM Signed'].includes(s.swms_status)).length,
		},
		issues: {
			findById: async (id) => clone(db.issues.find((i) => String(i.ROWID) === String(id))),
			list: async ({ status, taskId, reportedBy } = {}) =>
				db.issues
					.filter((i) => (!status || i.issue_status === status) && (!taskId || String(i.task_id) === String(taskId)) && (!reportedBy || String(i.reported_by_id) === String(reportedBy)))
					.map(clone),
			countByStatus: async () => db.issues.reduce((m, i) => ({ ...m, [i.issue_status]: (m[i.issue_status] || 0) + 1 }), {}),
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
			existingKeys: async (keys) => db.templates.filter((t) => keys.includes(t.template_key)).map((t) => t.template_key),
			insertMany: async (rows) => rows.forEach((row) => db.templates.push({ ROWID: nextId(), ...row })),
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
		storage: { signedPut: async (key) => 'https://put.test/' + key, signedGet: async (key) => 'https://get.test/' + key },
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

/** Get a task's SWMS signed by the project manager and then its team leader (as the rules require). */
async function signSwmsFor(w, task, leadCtx) {
	const swms = require('../lib/services/swms');
	const id = String(w.db.tasks.find((t) => String(t.ROWID) === String(task.ROWID)).swms_id);
	await swms.signSwms(w.as(['project_manager'], '105747000000900002'), id, { as: 'pm' });
	await swms.signSwms(leadCtx, id, { as: 'tl' });
	return id;
}

module.exports = { makeWorld, rejects, signSwmsFor };
