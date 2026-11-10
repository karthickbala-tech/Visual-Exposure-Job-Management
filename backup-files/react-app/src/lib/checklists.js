import { membersOf } from './people';
// Checklist rules from FSD CHK-1 to CHK-8 and INS-2 to INS-4, WORKFLOWS sections 4.2 and 5.1.
// Pure functions only, so they are easy to test and easy to change when the client answers FSD section 14.

// FSD question 5 is open: should Workshop fab tasks skip the pre-job checklist? Built on the FSD's current rule (skip).
export const WORKSHOP_SKIPS_PRE_JOB = true;
// FSD question 2 is open: crew wait for each other or work independently? Built on the latest rule (independent).
export const CREW_WAIT_FOR_EACH_OTHER = false;

export const WARN_HOURS = 14;
export const MAX_HOURS = 16;

// CHK-6: above 14 hours the person must confirm; above 16 hours it cannot be saved.
export const needsHoursConfirm = (h) => Number(h) > WARN_HOURS && Number(h) <= MAX_HOURS;

export const STEP_TITLES = {
  pre1: 'Job briefing',
  pre2: 'Arrival on site',
  post1: 'On-site completion',
  post2: 'Closure and hours',
};
export const FAB_STEP_TITLES = { pre1: 'Pre-job check', post2: 'Post-job check and hours' };
export const DESIGN_STEP_TITLES = { pre1: 'Design brief check', post2: 'Design hand-off and hours' };
export const stepTitle = (task, key) => (task.kind === 'fab' ? FAB_STEP_TITLES[key] : task.kind === 'design' ? DESIGN_STEP_TITLES[key] : STEP_TITLES[key]) || key;

// INS-1 and CHK-4: which checklists a task needs.
export const checklistPlan = (task) => {
  if (task.kind === 'install') {
    if (task.type === 'VE Install') return { pre: true, post: true };
    if (['VE Subtask', 'Minor Task'].includes(task.type)) return { pre: false, post: true };
    return { pre: false, post: false }; // External Install, Print Only: closed by the PM (INS-6)
  }
  if (task.kind === 'fab') return { pre: !(WORKSHOP_SKIPS_PRE_JOB && task.type === 'Workshop'), post: true };
  if (task.kind === 'design') return { pre: true, post: true }; // CHK-1, WORKFLOWS section 6: the designer's own checklists
  return { pre: false, post: false };
};

export const stepOrder = (task) => {
  const plan = checklistPlan(task);
  const keys = task.kind === 'install' ? ['pre1', 'pre2', 'post1', 'post2'] : ['pre1', 'post2'];
  return keys.filter((k) => (k.startsWith('pre') ? plan.pre : plan.post));
};

// Design tasks have one owner (the designer). Fab and install tasks have a team leader and any number of members.
export const crewOf = (task) => (task.kind === 'design' ? [task.owner].filter(Boolean) : [task.leader, ...membersOf(task)].filter(Boolean));
export const roleOf = (task, person) => (task.kind === 'design' || task.leader === person ? 'TL' : 'TM');

const isDone = (rec, key) => Boolean(rec && rec.steps && rec.steps[key]);

// CHK-3 and WORKFLOWS 4.2: the step this person sees next. Returns { step, message }.
export function nextStep(task, rec) {
  const order = stepOrder(task);
  if (order.length === 0) return { step: null, message: 'This task type has no checklists.' };
  if (['Rejected', 'Reopen'].includes(task.stage)) {
    // A rejection resets the post-job checklists, so the person goes back to the first post-job step they still owe.
    const post = order.filter((k) => k.startsWith('post')).find((k) => !isDone(rec, k));
    return post ? { step: post, message: '' } : { step: null, message: 'Your checklists are complete.' };
  }
  const openStages = task.kind === 'design' ? ['In Progress', 'Open'] : ['Scheduled', 'In Progress'];
  if (!openStages.includes(task.stage)) {
    if (task.kind === 'design' && task.stage === 'Assigned') return { step: null, message: 'Start the task to open its checklist.' };
    return { step: null, message: ['Manager Review', 'Completed', 'Approved & Completed', 'Awaiting Submission'].includes(task.stage) ? 'Your checklists are complete.' : 'No checklist is open at this stage.' };
  }

  const sub = task.subStage || '';
  const plan = checklistPlan(task);
  let phase;
  if (task.kind === 'install') {
    if (plan.pre) phase = ['', 'Team Briefed'].includes(sub) ? 'pre' : 'post';
    else phase = task.stage === 'In Progress' ? 'post' : null; // post-job only types start once the task is started
  } else {
    phase = plan.pre && !isDone(rec, 'pre1') ? 'pre' : 'post';
  }
  if (!phase) return { step: null, message: 'Start the task to open its checklist.' };

  const keys = order.filter((k) => k.startsWith(phase));
  const open = keys.find((k) => !isDone(rec, k));
  if (open) return { step: open, message: '' };
  if (phase === 'pre') return { step: null, message: task.kind === 'install' ? 'Pre-job complete. Waiting for the team leader to mark On Site.' : 'Pre-job complete.' };
  return { step: null, message: 'Your checklists are complete.' };
}

// INS-3: every crew member's closure step must be done before Manager Review.
export const closuresPending = (task, checklists) => {
  if (!checklistPlan(task).post) return [];
  return crewOf(task).filter((p) => !isDone(checklists.find((c) => c.taskId === task.id && c.person === p), 'post2'));
};
export const submitBlockReason = (task, checklists) => {
  const pending = closuresPending(task, checklists);
  if (pending.length === 0) return '';
  return `Closure step still open for ${pending.join(' and ')}`;
};

// INS-4: the team leader cannot finish the pre-job checklist until the SWMS is signed by the PM and the team leader.
export const swmsReady = (status) => !['Created', 'PM Signed'].includes(status);

// CHK-6 and CHK-7. Returns an error message, or '' when the answers are fine.
export function validateStep(key, role, d, ctx = {}) {
  const need = (v) => v === undefined || v === null || String(v).trim() === '';
  if (d.ohsConcern === 'Yes' && need(d.ohsDetail)) return 'Describe the OH&S or WHS concern so an issue can be raised.';
  if (key === 'pre1') {
    if (ctx.kind === 'fab') {
      if (!d.areaSafe || !d.ppeChecked) return 'Confirm the work area and PPE checks.';
      return '';
    }
    if (ctx.kind === 'design') {
      if (!d.briefRead || !d.filesChecked) return 'Confirm you read the brief and checked the source files.';
      return '';
    }
    if (role === 'TL') {
      if (!d.briefed) return 'Confirm you briefed the crew on the job and the SWMS.';
      if (ctx.swmsStatus !== undefined && !swmsReady(ctx.swmsStatus)) return 'The SWMS must be signed by the PM and the team leader before the pre-job checklist can be finished.';
    } else if (!d.understood) return 'Confirm you were briefed and understand the SWMS.';
    return '';
  }
  if (key === 'pre2') return d.arrived ? '' : 'Confirm you have arrived on site.';
  if (key === 'post1') return d.workComplete ? '' : 'Confirm the on-site work is complete.';
  if (key === 'post2') {
    if (ctx.kind === 'design' && (!d.filesSaved || !d.proofSent)) return 'Confirm the files are saved and the proof is ready for review.';
    const h = Number(d.hours);
    const u = d.unbilled === '' || d.unbilled === undefined ? 0 : Number(d.unbilled);
    if (!(h > 0)) return 'Enter the hours you worked.';
    if (h > MAX_HOURS) return `Hours above ${MAX_HOURS} cannot be saved. Split the time or ask your manager.`;
    if (h > WARN_HOURS && !d.hoursConfirmed) return `That is more than ${WARN_HOURS} hours. Tick the box to confirm it is correct.`;
    if (Number.isNaN(u) || u < 0 || u > MAX_HOURS) return `Unbilled hours must be between 0 and ${MAX_HOURS}.`;
    if (ctx.kind === 'install' && role === 'TM') {
      const r = Number(d.rating);
      if (!Number.isInteger(r) || r < 1 || r > 10) return 'Rate the job briefing from 1 to 10.';
    }
  }
  return '';
}

// The SWMS status a task shows: its own value, or the linked SWMS record's status while the task still says "Created".
export const taskSwmsStatus = (task, swmsList) => (task.swms === 'Created'
  ? (swmsList.find((s) => s.jobId === task.jobId && s.title === task.name) || swmsList.find((s) => s.jobId === task.jobId))?.status ?? task.swms
  : task.swms);
