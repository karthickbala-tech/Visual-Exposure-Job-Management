'use strict';

const { DONE_FOR_PROGRESS } = require('./stages');

/**
 * Completion percentage for a group of tasks (docs/WORKFLOWS.md section 10).
 * Weighted by quoted hours. ASSUMPTION (FSD section 14): quoted hours, not proposed.
 * When the total quoted hours is zero: 100 if every task is done, else 0.
 * Returns a whole number 0..100; no tasks gives 0.
 */
function percentComplete(tasks) {
	if (!tasks || tasks.length === 0) return 0;

	let total = 0;
	let done = 0;
	let allDone = true;
	for (const t of tasks) {
		const hours = Math.max(Number(t.quoted_hours) || 0, 0);
		const isDone = DONE_FOR_PROGRESS.includes(t.stage);
		total += hours;
		if (isDone) done += hours;
		else allDone = false;
	}
	if (total === 0) return allDone ? 100 : 0;
	return Math.round((done / total) * 100);
}

/** { fab, install, job }: job covers all three task types, including design. */
function progressFor(tasks) {
	const byType = (type) => tasks.filter((t) => t.task_type === type);
	return {
		fab: percentComplete(byType('fabrication')),
		install: percentComplete(byType('install')),
		job: percentComplete(tasks),
	};
}

module.exports = { percentComplete, progressFor };
