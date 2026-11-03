'use strict';

/**
 * Task stage state machines (docs/WORKFLOWS.md sections 4 to 6).
 * Pure functions, no I/O. Assumptions from FSD section 14 are marked ASSUMPTION.
 *
 * Who may make a transition:
 *   - managers (admin, project_manager, fab_manager, install_coordinator, second_ic)
 *     may make any transition that is defined here, except 'system' ones
 *   - 'assignee'  also allowed to the person assigned to the task
 *   - 'system'    only the platform itself (checklist completion), never a user
 */

const MANAGER_ROLES = Object.freeze([
	'admin',
	'project_manager',
	'fab_manager',
	'install_coordinator',
	'second_ic',
]);

/** Stages that end a task. ASSUMPTION: every other stage counts as "open" for the job rollup. */
const TERMINAL = Object.freeze(['Completed', 'Approved & Completed', 'Complete - Not Used', 'Cancelled']);

/** Stages that count as "done" when working out completion percentages. */
const DONE_FOR_PROGRESS = Object.freeze([...TERMINAL, 'Manager Review']);

const FIELD_FLOW = {
	initial: 'Awaiting Scheduling',
	transitions: [
		['Awaiting Scheduling', 'Scheduled', []],
		['Awaiting Scheduling', 'On Hold', []],
		['Awaiting Scheduling', 'Complete - Not Used', []],
		['Awaiting Scheduling', 'Cancelled', []],
		['Scheduled', 'Awaiting Scheduling', []],
		['Scheduled', 'In Progress', ['assignee']],
		['Scheduled', 'On Hold', []],
		['Scheduled', 'Complete - Not Used', []],
		['Scheduled', 'Cancelled', []],
		['In Progress', 'Manager Review', ['assignee']],
		['In Progress', 'On Hold', []],
		['In Progress', 'Cancelled', []],
		['Manager Review', 'Completed', []],
		['Manager Review', 'Rejected', []],
		['Rejected', 'In Progress', ['assignee']],
		['Completed', 'Reopen', []],
		['Reopen', 'In Progress', ['assignee']],
		['Reopen', 'Scheduled', []],
		['On Hold', 'Awaiting Scheduling', []],
		['On Hold', 'Scheduled', []],
		['On Hold', 'In Progress', []],
	],
};

const DESIGN_FLOW = {
	initial: 'To be Assigned',
	transitions: [
		['To be Assigned', 'Assigned', []],
		['To be Assigned', 'Complete - Not Used', []],
		['To be Assigned', 'Cancelled', []],
		['Assigned', 'In Progress', ['assignee']],
		['Assigned', 'On Hold', []],
		['Assigned', 'Cancelled', []],
		['In Progress', 'Open', ['system']],
		['In Progress', 'Awaiting Submission', ['assignee']],
		['In Progress', 'Client Review', []],
		['In Progress', 'On Hold', []],
		['In Progress', 'Cancelled', []],
		['Open', 'Awaiting Submission', ['system', 'assignee']],
		['Open', 'On Hold', []],
		['Awaiting Submission', 'Manager Review', ['assignee']],
		['Manager Review', 'Approved & Completed', []],
		['Manager Review', 'Reopen', []],
		['Reopen', 'In Progress', ['assignee']],
		['Client Review', 'In Progress', []],
		['On Hold', 'Assigned', []],
		['On Hold', 'In Progress', []],
	],
};

const FLOWS = Object.freeze({
	install: FIELD_FLOW,
	fabrication: FIELD_FLOW,
	design: DESIGN_FLOW,
});

function flowFor(taskType) {
	const flow = FLOWS[taskType];
	if (!flow) throw new Error(`Unknown task type: ${taskType}`);
	return flow;
}

/** Every stage name a task of this type can be in. */
function stagesFor(taskType) {
	const flow = flowFor(taskType);
	const set = new Set([flow.initial]);
	for (const [from, to] of flow.transitions) {
		set.add(from);
		set.add(to);
	}
	return [...set];
}

const initialStage = (taskType) => flowFor(taskType).initial;
const isTerminal = (stage) => TERMINAL.includes(stage);
const isManager = (roles) => (roles || []).some((r) => MANAGER_ROLES.includes(r));

/**
 * Can this actor move a task of `taskType` from `from` to `to`?
 * actor: { roles: string[], isAssignee: boolean }
 * Returns { ok: true } or { ok: false, reason }.
 */
function checkTransition(taskType, from, to, actor) {
	const flow = flowFor(taskType);
	const edge = flow.transitions.find(([f, t]) => f === from && t === to);
	if (!edge) {
		return {
			ok: false,
			code: 'invalid_transition',
			reason: `A ${taskType} task cannot move from "${from}" to "${to}"`,
		};
	}

	const allowedBy = edge[2];
	const notAllowed = (reason) => ({ ok: false, code: 'not_allowed', reason });

	if (allowedBy.includes('system') && !allowedBy.includes('assignee')) {
		if (!isManager(actor.roles)) return notAllowed('Only the system can make this change');
	}
	if (isManager(actor.roles)) {
		if (allowedBy.length === 1 && allowedBy[0] === 'system') {
			return notAllowed('This change is made automatically');
		}
		return { ok: true };
	}
	if (allowedBy.includes('assignee') && actor.isAssignee) return { ok: true };
	return notAllowed('You are not allowed to make this change');
}

/** Stages this actor can move the task to right now (for building action buttons). */
function nextStages(taskType, from, actor) {
	return flowFor(taskType)
		.transitions.filter(([f]) => f === from)
		.map(([, t]) => t)
		.filter((t) => checkTransition(taskType, from, t, actor).ok);
}

module.exports = {
	MANAGER_ROLES,
	TERMINAL,
	DONE_FOR_PROGRESS,
	stagesFor,
	initialStage,
	isTerminal,
	isManager,
	checkTransition,
	nextStages,
};
