/**
 * "Completed" offered from any stage but Manager Review can only be the direct close of an External Install or Print Only task
 * (FSD INS-6): the stage flows reach Completed only through Manager Review (lib/domain/stages.js).
 */
export const isDirectClose = (from: string, to: string) => to === 'Completed' && from !== 'Manager Review';

/** Reset assignment (TSK-2): a scheduled task back to Awaiting Scheduling, an assigned design task back to To be Assigned. */
export const isReset = (from: string, to: string) => (from === 'Scheduled' && to === 'Awaiting Scheduling') || (from === 'Assigned' && to === 'To be Assigned');

/** The question asked before a reset, which takes the crew off the task (lib/domain/taskRules.js cleanupFor). */
export const RESET_CONFIRM = {
	title: 'Reset assignment',
	message: 'Everyone comes off this task and their unfinished checklists are removed, so it can be planned again. Finished checklists are kept.',
	confirmLabel: 'Reset assignment',
};

/** The question asked before that close, on the task page and in the job page's row menu. */
export const CLOSE_CONFIRM = {
	title: 'Close this task',
	message: 'External Install and Print Only tasks have no checklists or manager review. The task will be marked Completed.',
	confirmLabel: 'Close task',
};
