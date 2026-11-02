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

module.exports = { STATUSES, PRIORITIES, canMove, nextStatuses, isClosed, departmentFor, DEFAULT_DEPARTMENT };
