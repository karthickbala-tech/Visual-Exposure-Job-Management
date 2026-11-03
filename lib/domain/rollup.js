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

module.exports = { jobStageFor, MANUAL_JOB_STAGES };
