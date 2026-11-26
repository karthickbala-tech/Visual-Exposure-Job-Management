'use strict';

const { isTerminal } = require('./stages');

/** Job stages a person sets by hand; the rollup never overrides them. */
const MANUAL_JOB_STAGES = Object.freeze(['Completed - Closed', 'Cancelled', 'On Hold']);

/** Task stages that mean "nobody has started yet". */
const NOT_STARTED = Object.freeze(['Awaiting Scheduling', 'To be Assigned']);

/**
 * Work out the job stage from its tasks (docs/WORKFLOWS.md section 2.1).
 * Pure: returns the stage the job should have. ASSUMPTIONS (FSD section 14):
 *   - a task counts as "open" unless it is in a terminal stage
 *   - a job with only cancelled tasks is Cancelled; otherwise Completed when none is open
 *   - a finished job goes back to In Progress when a task is added or reopened
 */
function jobStageFor(currentStage, taskStages) {
	if (MANUAL_JOB_STAGES.includes(currentStage)) return currentStage;
	if (!taskStages || taskStages.length === 0) return currentStage;

	const open = taskStages.filter((s) => !isTerminal(s));
	if (open.length === 0) {
		return taskStages.every((s) => s === 'Cancelled') ? 'Cancelled' : 'Completed';
	}
	if (currentStage === 'Completed') return 'In Progress';
	if (currentStage === 'Preparation' && taskStages.some((s) => !NOT_STARTED.includes(s) && !isTerminal(s))) {
		return 'In Progress';
	}
	return currentStage;
}

/** Job stages that send Creator's "related job" tick to the CRM deal (Completed_crm_job_update). */
const DEAL_CLOSING_STAGES = Object.freeze(['Completed', 'Cancelled']);

/** The closure email may go again once a job leaves these stages (Creator's "K Reset Closure Email Flag on Stage Change"). */
const KEEPS_CLOSURE_FLAG = Object.freeze(['Completed', 'Completed - Closed']);

/**
 * The stage changes a person may make on a job by hand, as on Creator's Jobs form (docs/WORKFLOWS.md section 2):
 *   hold    Preparation or In Progress -> On Hold
 *   resume  On Hold -> worked out again from the tasks
 *   cancel  -> Cancelled, only when no task is open (Creator's "Can't close if tasks open")
 *   reopen  Cancelled or Completed - Closed -> worked out again from the tasks; administrator only (JOB-8)
 * Completed comes from the tasks (JOB-6) and Completed - Closed from Close job (JOB-5), so neither is a move here.
 * Returns [{ action, to, allowed, reason }]: a move that is shown but refused carries the reason.
 */
function jobStageMoves(stage, { openTasks = 0, isAdmin = false } = {}) {
	const out = [];
	const cancel = () =>
		out.push({
			action: 'cancel',
			to: 'Cancelled',
			allowed: openTasks === 0,
			reason: openTasks ? `Finish or cancel the ${openTasks} open task${openTasks === 1 ? '' : 's'} first.` : null,
		});
	if (stage === 'Preparation' || stage === 'In Progress') {
		out.push({ action: 'hold', to: 'On Hold', allowed: true, reason: null });
		cancel();
	} else if (stage === 'On Hold') {
		out.push({ action: 'resume', to: 'In Progress', allowed: true, reason: null });
		cancel();
	} else if ((stage === 'Cancelled' || stage === 'Completed - Closed') && isAdmin) {
		out.push({ action: 'reopen', to: 'In Progress', allowed: true, reason: null });
	}
	return out;
}

/** Where a resumed or reopened job lands: worked out from its tasks as if it had just been created. */
const stageAfterRelease = (taskStages) => jobStageFor('Preparation', taskStages);

module.exports = { jobStageFor, jobStageMoves, stageAfterRelease, MANUAL_JOB_STAGES, DEAL_CLOSING_STAGES, KEEPS_CLOSURE_FLAG };
