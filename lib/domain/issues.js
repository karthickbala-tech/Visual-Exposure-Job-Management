'use strict';

/**
 * Issue rules. Pure, no I/O.
 * Assumptions (business rules not stated in the FSD): four statuses, moves only along the list
 * below, a resolved issue may be reopened, and routing sends an issue to the department that
 * owns the task type.
 */
const STATUSES = Object.freeze(['Open', 'In Progress', 'Resolved', 'Closed']);
const PRIORITIES = Object.freeze(['Low', 'Normal', 'High', 'Urgent']);
const CLOSED = Object.freeze(['Resolved', 'Closed']);

const MOVES = Object.freeze({
	Open: ['In Progress', 'Resolved'],
	'In Progress': ['Open', 'Resolved'],
	Resolved: ['Open', 'Closed'],
	Closed: [],
});

const DEPARTMENT_BY_TASK_TYPE = Object.freeze({ design: 'Design', fabrication: 'Fabrication', install: 'Install' });
const DEFAULT_DEPARTMENT = 'Management';

const canMove = (from, to) => (MOVES[from] || []).includes(to);
const nextStatuses = (from) => [...(MOVES[from] || [])];
const isClosed = (status) => CLOSED.includes(status);

/** Which department should look at an issue raised on a task of this type. */
const departmentFor = (taskType) => DEPARTMENT_BY_TASK_TYPE[taskType] || DEFAULT_DEPARTMENT;

/** Departments with their own issue board (FSD ISS-3, ISS-4). An issue can also be sent to one by hand. */
const DEPARTMENTS = Object.freeze(['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards']);
const OPEN_STATUSES = Object.freeze(['Open', 'In Progress']);
const isOpen = (status) => OPEN_STATUSES.includes(status);

const FIELD_LABELS = Object.freeze({
	issue_status: 'Status',
	issue_priority: 'Priority',
	assigned_to_id: 'Assigned to',
	owner_id: 'Owner',
	department: 'Department',
	description: 'Description',
});

const blank = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * What an update really changes (FSD ISS-2): one entry per field whose value differs from the saved row.
 * A description is long, so only the fact that it changed is kept. Returns [{ field, label, from, to, long? }].
 */
function diffIssue(row, patch) {
	const out = [];
	for (const field of Object.keys(FIELD_LABELS)) {
		if (!(field in patch) || blank(patch[field]) === blank(row[field])) continue;
		if (field === 'description') out.push({ field, label: FIELD_LABELS[field], long: true });
		else out.push({ field, label: FIELD_LABELS[field], from: blank(row[field]), to: blank(patch[field]) });
	}
	return out;
}

/** Counts per department and status for the boards. Known departments always appear, even with no issues. */
function boardCounts(rows) {
	const counts = {};
	const ensure = (d) => (counts[d] = counts[d] || { Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, openTotal: 0 });
	for (const d of DEPARTMENTS) ensure(d);
	for (const r of rows) {
		const c = ensure(r.department || DEFAULT_DEPARTMENT);
		if (c[r.issue_status] !== undefined) c[r.issue_status] += 1;
		if (isOpen(r.issue_status)) c.openTotal += 1;
	}
	return counts;
}

module.exports = { STATUSES, PRIORITIES, DEPARTMENTS, OPEN_STATUSES, FIELD_LABELS, canMove, nextStatuses, isClosed, isOpen, departmentFor, diffIssue, boardCounts, DEFAULT_DEPARTMENT };
