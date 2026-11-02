// The approval lifecycle shared by Design, Fab and Install tasks (from the Creator record buttons).
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

export const MANAGER_ROLES = ['pm', 'fabManager'];

// Install crew steps while a task is In Progress (from the Creator install sub-stage list).
export const SUBSTAGES = ['Team Briefed', 'On Site', 'Finished On Site'];
// Longest single time entry allowed (the Creator checklist rejects entries of 16 hours or more).
export const MAX_ENTRY_HOURS = 16;
