// Job rules from FSD JOB-2, JOB-3, JOB-5, JOB-6 and WORKFLOWS sections 2, 2.1 and 10. Pure functions, so they are easy to test
// and easy to change when the client answers FSD section 14 (questions 3 and 4).
import { CLOSED_STAGES } from './workflow';

export const JOB_CLOSED = 'Completed - Closed';

// FSD question 4 is open: should Rejected and Reopen tasks stop a job from completing? Built on "yes" (the safer rule).
export const REWORK_BLOCKS_COMPLETION = true;
// FSD question 3 is open: completion is weighted by quoted hours. Design tasks count only in the job-level figure.
const OPEN_FOR_ROLLUP = ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'On Hold', 'Not Started', 'Client Review', 'Manager Review'];
export const BLOCKING_STAGES = REWORK_BLOCKS_COMPLETION ? [...OPEN_FOR_ROLLUP, 'Rejected', 'Reopen'] : OPEN_FOR_ROLLUP;

// WORKFLOWS section 10: the done set for completion percentages.
export const DONE_STAGES = ['Completed', 'Complete - Not Used', 'Manager Review', 'Cancelled'];

export const isClosedJob = (job) => !!job && job.stage === JOB_CLOSED;

// Completed quoted hours / total quoted hours, as a whole number. With zero total hours: 100 if every task is done, else 0.
export function completionPct(tasks) {
  if (!tasks || tasks.length === 0) return 0;
  const total = tasks.reduce((n, t) => n + (Number(t.quoted) || 0), 0);
  const done = tasks.filter((t) => DONE_STAGES.includes(t.stage));
  if (total === 0) return done.length === tasks.length ? 100 : 0;
  return Math.round((done.reduce((n, t) => n + (Number(t.quoted) || 0), 0) / total) * 100);
}

// JOB-3 KPI blocks: total, open, overdue and percentage for one group of tasks. Open means not Completed, Cancelled or Not Used.
export function groupStats(tasks, todayKey) {
  const open = tasks.filter((t) => !CLOSED_STAGES.includes(t.stage));
  return {
    total: tasks.length,
    open: open.length,
    overdue: open.filter((t) => t.date && t.date < todayKey).length,
    pct: completionPct(tasks),
  };
}

export const KPI_GROUPS = [
  { kind: 'design', label: 'Management and design' },
  { kind: 'fab', label: 'Fabrication' },
  { kind: 'install', label: 'Installation' },
];

export function jobStats(tasks, todayKey) {
  const out = {};
  KPI_GROUPS.forEach((g) => { out[g.kind] = groupStats(tasks.filter((t) => t.kind === g.kind), todayKey); });
  out.job = groupStats(tasks, todayKey);
  return out;
}

// JOB-6 and WORKFLOWS 2.1: what changes on the job after a task stage change. Returns null when the job has no tasks.
// Closed, cancelled and on-hold jobs keep their stage (those are manual). Percentages are always recalculated.
export function rollup(job, tasks) {
  if (!tasks || tasks.length === 0) return null;
  const patch = {
    fab: completionPct(tasks.filter((t) => t.kind === 'fab')),
    install: completionPct(tasks.filter((t) => t.kind === 'install')),
    job: completionPct(tasks),
    stage: job.stage,
  };
  if (![JOB_CLOSED, 'Cancelled', 'On Hold'].includes(job.stage)) {
    const blocked = tasks.some((t) => BLOCKING_STAGES.includes(t.stage));
    if (!blocked) patch.stage = 'Completed';
    else if (['Preparation', 'Completed'].includes(job.stage)) patch.stage = 'In Progress'; // first task added, or a reopened task
  }
  return patch;
}

// JOB-5: only a Project Manager can close, and only at 100% complete. Returns { ok, reason }.
export function canCloseJob(job, roleId) {
  if (isClosedJob(job)) return { ok: false, reason: 'This job is already closed.' };
  if (job.stage === 'Cancelled') return { ok: false, reason: 'A cancelled job cannot be closed.' };
  if (roleId !== 'pm') return { ok: false, reason: 'Only a Project Manager can close a job.' };
  if (job.job !== 100) return { ok: false, reason: `Available at 100% complete. This job is at ${job.job}%.` };
  return { ok: true, reason: '' };
}

// JOB-2: tabs and filters on the jobs list.
export const JOB_TABS = [
  { id: 'all', label: 'All' },
  { id: 'myOpen', label: 'My Open' },
  { id: 'mine', label: 'My Jobs' },
  { id: 'prep', label: 'Preparation' },
  { id: 'ongoing', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
];

export const isMine = (job, person) => !!person && (job.pm === person || job.fabManager === person);
const isOpenJob = (job) => !['Completed', JOB_CLOSED, 'Cancelled'].includes(job.stage);

// FSD does not define Ongoing; built as In Progress only. On Hold and Cancelled jobs show under All.
export function matchesTab(job, tab, person) {
  switch (tab) {
    case 'myOpen': return isMine(job, person) && isOpenJob(job);
    case 'mine': return isMine(job, person);
    case 'prep': return job.stage === 'Preparation';
    case 'ongoing': return job.stage === 'In Progress';
    case 'completed': return job.stage === 'Completed' || job.stage === JOB_CLOSED;
    default: return true;
  }
}

export function filterJobs(jobs, { tab = 'all', person = '', stage = 'All', pm = 'All', fabManager = 'All', q = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return jobs.filter((j) => matchesTab(j, tab, person)
    && (stage === 'All' || j.stage === stage)
    && (pm === 'All' || j.pm === pm)
    && (fabManager === 'All' || j.fabManager === fabManager)
    && (!needle || `${j.name} ${j.id} ${j.client}`.toLowerCase().includes(needle)));
}
