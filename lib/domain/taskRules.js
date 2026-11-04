'use strict';

/**
 * Task and job rules that are not stage-machine edges (FSD TSK-2, INS-6, JOB-5). Pure, no I/O.
 */
const { isTerminal } = require('./stages');

/** Install kinds with no checklists or review: a manager closes them directly (INS-6). */
const CLOSE_ONLY_KINDS = Object.freeze(['External Install', 'Print Only']);
const CLOSE_ONLY_FROM = Object.freeze(['Awaiting Scheduling', 'Scheduled', 'In Progress']);

const isCloseOnly = (task) => task.task_type === 'install' && CLOSE_ONLY_KINDS.includes(task.kind);
const canCloseDirectly = (task) => isCloseOnly(task) && CLOSE_ONLY_FROM.includes(task.stage);

/**
 * A subtask hangs off the ROOT parent (a subtask of a subtask joins the same parent). Only install and fabrication tasks
 * can have subtasks. Install subtasks are kind "VE Subtask" (no SWMS of their own); fab subtasks keep their parent's kind.
 * Returns { draft } or { error, code }.
 */
function subtaskDraft(task, root, job) {
	if (!['install', 'fabrication'].includes(task.task_type)) {
		return { error: 'Only install and fabrication tasks can have subtasks.', code: 'bad_request' };
	}
	if (job && job.stage === 'Completed - Closed') {
		return { error: 'This job is closed. Reopen it before adding a subtask.', code: 'job_closed' };
	}
	const draft = {
		task_type: task.task_type,
		name: `${root.name} - Subtask`.slice(0, 200),
		kind: task.task_type === 'install' ? 'VE Subtask' : task.kind || undefined,
	};
	for (const k of ['scheduled_date', 'required_finish', 'site_id', 'sign_group_id']) if (task[k]) draft[k] = String(task[k]);
	return { draft };
}

/** Why a job cannot be closed yet (an empty list means it can). A job closes once, when every task is finished. */
function closeJobProblems(job, tasks) {
	if (job.stage === 'Completed - Closed') return ['This job is already closed.'];
	if (!tasks.length) return ['This job has no tasks yet.'];
	const open = tasks.filter((t) => !isTerminal(t.stage));
	if (open.length) return [`${open.length} task${open.length === 1 ? ' is' : 's are'} not finished yet.`];
	return [];
}

const parseFlags = (text) => {
	try {
		const v = text ? JSON.parse(text) : {};
		return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
	} catch {
		return {};
	}
};

module.exports = { CLOSE_ONLY_KINDS, CLOSE_ONLY_FROM, isCloseOnly, canCloseDirectly, subtaskDraft, closeJobProblems, parseFlags };
