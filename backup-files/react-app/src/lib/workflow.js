// The approval lifecycle shared by Fab and Install tasks (from the Creator record buttons).
// Design tasks have their own flow (WORKFLOWS section 6), below.
export const STEPS = ['Scheduled', 'In Progress', 'Manager Review', 'Completed'];

const POS = { 'Awaiting Scheduling': -1, 'Not Started': -1, Scheduled: 0, 'In Progress': 1, Rejected: 1, Reopen: 1, 'Manager Review': 2, Completed: 3 };
export const stepIndex = (stage) => (stage in POS ? POS[stage] : -1);

// manager: only a Project Manager or Fab Manager may do it. comment: a comment is required.
export const TRANSITIONS = {
  'Awaiting Scheduling': [{ action: 'Schedule', to: 'Scheduled' }],
  'Not Started': [{ action: 'Start', to: 'In Progress' }],
  Scheduled: [{ action: 'Start', to: 'In Progress' }],
  'In Progress': [{ action: 'Submit for approval', to: 'Manager Review' }],
  'Manager Review': [
    { action: 'Approve', to: 'Completed', manager: true },
    { action: 'Reject', to: 'Rejected', manager: true, comment: true, danger: true },
  ],
  Rejected: [{ action: 'Rework', to: 'In Progress' }],
  Completed: [{ action: 'Reopen', to: 'Reopen', manager: true, comment: true }],
  Reopen: [{ action: 'Start', to: 'In Progress' }],
};

// WORKFLOWS section 6 (DES-1). In Progress -> Open and Open -> Awaiting Submission are moved by the designer's
// pre-job and post-job checklists, not by a button. A rejection keeps the pre-job checklist and clears the post-job one,
// so from Reopen the designer redoes the post-job checklist, which sends the task back to Awaiting Submission.
export const DESIGN_STEPS = ['Assigned', 'In Progress', 'Open', 'Awaiting Submission', 'Manager Review', 'Approved & Completed'];
const DESIGN_POS = { 'To be Assigned': -1, Assigned: 0, 'In Progress': 1, 'Client Review': 1, 'On Hold': 1, Open: 2, Reopen: 2, 'Awaiting Submission': 3, 'Manager Review': 4, 'Approved & Completed': 5 };

export const DESIGN_TRANSITIONS = {
  'To be Assigned': [{ action: 'Assign', to: 'Assigned', manager: true, assign: true }],
  Assigned: [{ action: 'Start', to: 'In Progress' }],
  'In Progress': [{ action: 'Send to client', to: 'Client Review', comment: true }],
  'Client Review': [{ action: 'Client replied', to: 'In Progress' }],
  'Awaiting Submission': [{ action: 'Submit for approval', to: 'Manager Review' }],
  'Manager Review': [
    { action: 'Approve', to: 'Approved & Completed', manager: true },
    { action: 'Reject', to: 'Reopen', manager: true, comment: true, danger: true },
  ],
};

export const transitionsFor = (task) => ((task && task.kind === 'design' ? DESIGN_TRANSITIONS : TRANSITIONS)[task && task.stage] || []);
export const stepsFor = (task) => (task && task.kind === 'design' ? DESIGN_STEPS : STEPS);
export const stepIndexFor = (task) => (task && task.kind === 'design'
  ? (task.stage in DESIGN_POS ? DESIGN_POS[task.stage] : -1)
  : stepIndex(task && task.stage));

export const MANAGER_ROLES = ['admin', 'pm', 'fabManager'];

// Install crew steps while a task is In Progress (from the Creator install sub-stage list).
export const SUBSTAGES = ['Team Briefed', 'On Site', 'Finished On Site'];
// Longest single time entry allowed (the Creator checklist rejects entries of 16 hours or more).
export const MAX_ENTRY_HOURS = 16;

// Stages after which a task no longer counts as open.
export const CLOSED_STAGES = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
