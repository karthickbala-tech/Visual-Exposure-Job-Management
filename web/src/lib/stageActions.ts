/**
 * "Completed" offered from any stage but Manager Review can only be the direct close of an External Install or Print Only task
 * (FSD INS-6): the stage flows reach Completed only through Manager Review (lib/domain/stages.js).
 */
export const isDirectClose = (from: string, to: string) => to === 'Completed' && from !== 'Manager Review';

/** The question asked before that close, on the task page and in the job page's row menu. */
export const CLOSE_CONFIRM = {
	title: 'Close this task',
	message: 'External Install and Print Only tasks have no checklists or manager review. The task will be marked Completed.',
	confirmLabel: 'Close task',
};
