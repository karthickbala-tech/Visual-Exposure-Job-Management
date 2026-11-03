'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../lib/domain/stages');
const { jobStageFor } = require('../lib/domain/rollup');
const { percentComplete, progressFor } = require('../lib/domain/completion');

const PM = { roles: ['project_manager'], isAssignee: false };
const CREW_ASSIGNED = { roles: ['installer'], isAssignee: true };
const CREW_OTHER = { roles: ['installer'], isAssignee: false };

test('each task type starts in its own initial stage', () => {
	assert.equal(S.initialStage('install'), 'Awaiting Scheduling');
	assert.equal(S.initialStage('fabrication'), 'Awaiting Scheduling');
	assert.equal(S.initialStage('design'), 'To be Assigned');
	assert.throws(() => S.initialStage('painting'));
});

test('every stage in every flow is reachable from the initial stage', () => {
	for (const type of ['install', 'fabrication', 'design']) {
		const seen = new Set([S.initialStage(type)]);
		let grew = true;
		while (grew) {
			grew = false;
			for (const from of [...seen]) {
				for (const to of S.nextStages(type, from, { roles: ['admin'], isAssignee: false })) {
					if (!seen.has(to)) (seen.add(to), (grew = true));
				}
			}
		}
		// 'Open' is system-only for design, so exclude it from the manual reachability check.
		const expected = S.stagesFor(type).filter((s) => !(type === 'design' && s === 'Open'));
		for (const s of expected) assert.ok(seen.has(s), `${type}: ${s} unreachable`);
	}
});

test('undefined transitions are refused with a reason', () => {
	const r = S.checkTransition('install', 'Awaiting Scheduling', 'Completed', PM);
	assert.equal(r.ok, false);
	assert.match(r.reason, /cannot move/);
});

test('managers can make normal transitions; crew only the ones marked for assignees', () => {
	assert.equal(S.checkTransition('install', 'Awaiting Scheduling', 'Scheduled', PM).ok, true);
	assert.equal(S.checkTransition('install', 'Awaiting Scheduling', 'Scheduled', CREW_ASSIGNED).ok, false);
	assert.equal(S.checkTransition('install', 'Scheduled', 'In Progress', CREW_ASSIGNED).ok, true);
	assert.equal(S.checkTransition('install', 'Scheduled', 'In Progress', CREW_OTHER).ok, false, 'not assigned');
	assert.equal(S.checkTransition('install', 'In Progress', 'Manager Review', CREW_ASSIGNED).ok, true);
});

test('crew can submit for review but never approve or reject', () => {
	assert.equal(S.checkTransition('install', 'Manager Review', 'Completed', CREW_ASSIGNED).ok, false);
	assert.equal(S.checkTransition('install', 'Manager Review', 'Rejected', CREW_ASSIGNED).ok, false);
	assert.equal(S.checkTransition('install', 'Manager Review', 'Completed', PM).ok, true);
});

test('system-only transitions cannot be made by anyone through the API', () => {
	assert.equal(S.checkTransition('design', 'In Progress', 'Open', PM).ok, false);
	assert.equal(S.checkTransition('design', 'In Progress', 'Open', CREW_ASSIGNED).ok, false);
});

test('design flow ends in Approved & Completed; field flow ends in Completed', () => {
	assert.equal(S.checkTransition('design', 'Manager Review', 'Approved & Completed', PM).ok, true);
	assert.equal(S.checkTransition('design', 'Manager Review', 'Completed', PM).ok, false);
});

test('nextStages lists only what the actor may do now', () => {
	assert.deepEqual(S.nextStages('install', 'In Progress', CREW_ASSIGNED), ['Manager Review']);
	assert.deepEqual(
		S.nextStages('install', 'In Progress', PM).sort(),
		['Cancelled', 'Manager Review', 'On Hold']
	);
	assert.deepEqual(S.nextStages('install', 'Cancelled', PM), []);
});

test('terminal stages have no way out except Completed -> Reopen', () => {
	for (const s of S.TERMINAL) {
		const outs = S.nextStages('install', s, { roles: ['admin'], isAssignee: false });
		if (s === 'Completed') assert.deepEqual(outs, ['Reopen']);
		else assert.deepEqual(outs, [], s);
	}
});

test('job rollup: starts In Progress when work begins', () => {
	assert.equal(jobStageFor('Preparation', ['Awaiting Scheduling']), 'Preparation');
	assert.equal(jobStageFor('Preparation', ['Scheduled', 'Awaiting Scheduling']), 'In Progress');
	assert.equal(jobStageFor('Preparation', ['To be Assigned']), 'Preparation');
});

test('job rollup: completes when no task is open, cancels when all cancelled', () => {
	assert.equal(jobStageFor('In Progress', ['Completed', 'Complete - Not Used', 'Cancelled']), 'Completed');
	assert.equal(jobStageFor('In Progress', ['Approved & Completed']), 'Completed');
	assert.equal(jobStageFor('In Progress', ['Cancelled', 'Cancelled']), 'Cancelled');
	assert.equal(jobStageFor('In Progress', ['Completed', 'Manager Review']), 'In Progress');
});

test('job rollup: reopens a finished job when a task becomes open again', () => {
	assert.equal(jobStageFor('Completed', ['Completed', 'Reopen']), 'In Progress');
});

test('job rollup never overrides manual stages and ignores jobs with no tasks', () => {
	for (const s of ['Completed - Closed', 'Cancelled', 'On Hold']) {
		assert.equal(jobStageFor(s, ['Completed']), s);
	}
	assert.equal(jobStageFor('Preparation', []), 'Preparation');
});

test('completion is weighted by quoted hours and rounded', () => {
	const tasks = [
		{ stage: 'Completed', quoted_hours: 30 },
		{ stage: 'In Progress', quoted_hours: 70 },
	];
	assert.equal(percentComplete(tasks), 30);
	assert.equal(percentComplete([{ stage: 'Completed', quoted_hours: 1 }, { stage: 'In Progress', quoted_hours: 2 }]), 33);
});

test('Manager Review counts as done for progress', () => {
	assert.equal(percentComplete([{ stage: 'Manager Review', quoted_hours: 10 }]), 100);
});

test('zero quoted hours: all done is 100, otherwise 0; no tasks is 0', () => {
	assert.equal(percentComplete([{ stage: 'Completed', quoted_hours: 0 }]), 100);
	assert.equal(percentComplete([{ stage: 'Completed', quoted_hours: 0 }, { stage: 'Scheduled', quoted_hours: 0 }]), 0);
	assert.equal(percentComplete([]), 0);
});

test('bad hours values are treated as zero, not NaN', () => {
	assert.equal(percentComplete([{ stage: 'Completed', quoted_hours: 'abc' }, { stage: 'Scheduled', quoted_hours: -5 }]), 0);
});

test('progressFor splits fab and install and includes design in the job figure', () => {
	const tasks = [
		{ task_type: 'fabrication', stage: 'Completed', quoted_hours: 10 },
		{ task_type: 'install', stage: 'Scheduled', quoted_hours: 10 },
		{ task_type: 'design', stage: 'Approved & Completed', quoted_hours: 20 },
	];
	assert.deepEqual(progressFor(tasks), { fab: 100, install: 0, job: 75 });
});
