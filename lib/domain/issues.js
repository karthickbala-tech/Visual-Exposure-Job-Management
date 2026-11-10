'use strict';

/**
 * Issue rules. Pure, no I/O.
 * Assumptions (business rules not stated in the FSD): four statuses, moves only along the list
 * below, a resolved issue may be reopened, and routing sends an issue to the department that
 * owns the task type.
 */
// The status, priority and department names are the ones of the old Creator Issues form (docs/CREATOR_NAMES.md).
const STATUSES = Object.freeze(['To Be discussed', 'To Be Quoted', 'Quoted', 'Quote Sent', 'In Progress', 'On Hold', 'Completed']);
const PRIORITIES = Object.freeze(['High', 'Medium', 'Low']);
const CLOSED = Object.freeze(['Completed']);
const NEW_STATUS = 'To Be discussed';

// Creator let an issue move to any status, so any move to a different status is allowed (a completed issue can be reopened).
const MOVES = Object.freeze(Object.fromEntries(STATUSES.map((s) => [s, STATUSES.filter((x) => x !== s)])));

const DEPARTMENT_BY_TASK_TYPE = Object.freeze({ design: 'Management', fabrication: 'Workshop', install: 'Install' });
const DEFAULT_DEPARTMENT = 'Management';

const canMove = (from, to) => (MOVES[from] || []).includes(to);
const nextStatuses = (from) => [...(MOVES[from] || [])];
const isClosed = (status) => CLOSED.includes(status);

/** Which department should look at an issue raised on a task of this type. */
const departmentFor = (taskType) => DEPARTMENT_BY_TASK_TYPE[taskType] || DEFAULT_DEPARTMENT;

/** Departments with their own issue board (FSD ISS-3, ISS-4). An issue can also be sent to one by hand. */
const DEPARTMENTS = Object.freeze(['Install', 'Civic Billboards', 'Workshop', 'Management', 'VT/Digital Screens']);
const OPEN_STATUSES = Object.freeze(STATUSES.filter((s) => !CLOSED.includes(s)));
const isOpen = (status) => OPEN_STATUSES.includes(status);

const FIELD_LABELS = Object.freeze({
	issue_status: 'Status',
	issue_priority: 'Priority',
	assigned_to_id: 'Assigned to',
	owner_id: 'Owner',
	department: 'Department',
	description: 'Description',
	next_step: 'Next step',
	work_completed: 'Work completed',
	due_date: 'Due date',
	billboard_site: 'Billboard site',
	billboard_face: 'Billboard face',
	review_needed: 'Review needed',
});

const LONG_FIELDS = Object.freeze(['description', 'next_step', 'work_completed']);
/** What kind of review an issue on a task of this type needs (ASSUMPTION: follows the department; the client can change it). */
const REVIEW_OPTIONS = Object.freeze(['Management Review', 'WHS Reported', 'OH&S Reported']);
/** The review choices of an issue by department, as in Creator: Install asks for Management Review or WHS Reported, the workshop for Management Review or OH&S Reported. */
const reviewFor = (department) => (department === 'Install' ? ['Management Review', 'WHS Reported'] : department === 'Workshop' ? ['Management Review', 'OH&S Reported'] : []);
/** The "Direction" of a billboard face. */
const BILLBOARD_DIRECTIONS = Object.freeze(['Inbound', 'Outbound', 'Middle Panel']);


const blank = (v) => (v === null || v === undefined ? '' : String(v));

/**
 * What an update really changes (FSD ISS-2): one entry per field whose value differs from the saved row.
 * A description is long, so only the fact that it changed is kept. Returns [{ field, label, from, to, long? }].
 */
function diffIssue(row, patch) {
	const out = [];
	for (const field of Object.keys(FIELD_LABELS)) {
		if (!(field in patch) || blank(patch[field]) === blank(row[field])) continue;
		if (LONG_FIELDS.includes(field)) out.push({ field, label: FIELD_LABELS[field], long: true });
		else out.push({ field, label: FIELD_LABELS[field], from: blank(row[field]), to: blank(patch[field]) });
	}
	return out;
}

/** Counts per department and status for the boards. Known departments always appear, even with no issues. */
function boardCounts(rows) {
	const counts = {};
	const ensure = (d) => (counts[d] = counts[d] || { ...Object.fromEntries(STATUSES.map((s) => [s, 0])), openTotal: 0 });
	for (const d of DEPARTMENTS) ensure(d);
	for (const r of rows) {
		const c = ensure(r.department || DEFAULT_DEPARTMENT);
		if (c[r.issue_status] !== undefined) c[r.issue_status] += 1;
		if (isOpen(r.issue_status)) c.openTotal += 1;
	}
	return counts;
}

/**
 * The rules for an update (taken from the demo app): finishing needs a note of the work completed; any other status
 * needs a next step and a due date; Civic Billboards issues need the site and face. `next` is the row with the patch applied.
 * Returns a list of plain messages, empty when fine.
 */
function updateProblems(next, patch) {
	const problems = [];
	const has = (k) => String(next[k] === null || next[k] === undefined ? '' : next[k]).trim() !== '';
	if ('issue_status' in patch) {
		if (isClosed(next.issue_status)) {
			if (!has('work_completed')) problems.push('Say what work was completed before resolving or closing.');
		} else {
			if (!has('next_step')) problems.push('Say what the next step is.');
			if (!has('due_date')) problems.push('Set a due date.');
		}
	}
	if (next.department === 'Civic Billboards' && ('department' in patch || 'billboard_site' in patch || 'billboard_face' in patch || 'issue_status' in patch)) {
		if (!has('billboard_site')) problems.push('Civic Billboards issues need the billboard site.');
		if (!has('billboard_face')) problems.push('Civic Billboards issues need the billboard face.');
	}
	return problems;
}

/** Open and past its due date (both dates are YYYY-MM-DD). */
const isOverdue = (row, today) => isOpen(row.issue_status) && !!row.due_date && String(row.due_date).slice(0, 10) < today;

module.exports = { NEW_STATUS, reviewFor, BILLBOARD_DIRECTIONS, updateProblems, isOverdue, REVIEW_OPTIONS, STATUSES, PRIORITIES, DEPARTMENTS, OPEN_STATUSES, FIELD_LABELS, canMove, nextStatuses, isClosed, isOpen, departmentFor, diffIssue, boardCounts, DEFAULT_DEPARTMENT };
