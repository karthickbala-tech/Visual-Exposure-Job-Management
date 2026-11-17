/**
 * "Completed" offered from any stage but Manager Review can only be the direct close of an External Install or Print Only task
 * (FSD INS-6): the stage flows reach Completed only through Manager Review (lib/domain/stages.js).
 */
export const isDirectClose = (from: string, to: string) => to === 'Completed' && from !== 'Manager Review';

/** Reset assignment (TSK-2): a scheduled task back to Awaiting Scheduling, an assigned design task back to To be Assigned. */
export const isReset = (from: string, to: string) => (from === 'Scheduled' && to === 'Awaiting Scheduling') || (from === 'Assigned' && to === 'To be Assigned');

/** What each move that needs a reason does, in the words of the reason form (the server asks for the same reasons, TSK-2). */
const REASON_FOR: Record<string, string> = {
	Rejected: 'send it back',
	Reopen: 'reopen it',
	'On Hold': 'put it on hold',
	Cancelled: 'cancel it',
	'Complete - Not Used': 'mark it not used',
};

/** The words for a move that needs a reason ("put it on hold"), or null when it needs none. */
export const reasonFor = (from: string, to: string): string | null => (isReset(from, to) ? 'reset the assignment' : REASON_FOR[to] ?? null);

/** What the move takes off the task, shown above the reason (lib/domain/taskRules.js cleanupFor). */
export const clearsNote = (from: string, to: string): string | null =>
	to === 'Cancelled'
		? 'Everyone comes off the task, with their unfinished checklists, and the scheduled date and quoted hours are cleared. Finished checklists are kept.'
		: to === 'Complete - Not Used' || isReset(from, to)
			? 'Everyone comes off the task, with their unfinished checklists. Finished checklists are kept.'
			: null;

/** The menu wording for a move that needs a reason; the menu opens the task page with the reason form ready. */
export const moveLabel = (from: string, to: string) => (isReset(from, to) ? 'Reset assignment…' : to === 'On Hold' ? 'Put on hold…' : to === 'Cancelled' ? 'Cancel task…' : to === 'Complete - Not Used' ? 'Mark not used…' : `Move to ${to}…`);

/** The question asked before that close, on the task page and in the job page's row menu. */
export const CLOSE_CONFIRM = {
	title: 'Close this task',
	message: 'External Install and Print Only tasks have no checklists or manager review. The task will be marked Completed.',
	confirmLabel: 'Close task',
};
