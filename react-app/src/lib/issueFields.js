// ISS-6: which Issues fields each role can see. The FSD says "as in Creator" (about 18 fields), but the Creator export has no
// permission profiles, so this table is a PROPOSAL to confirm with the client (FSD question 10). Pure functions.

// The 18 fields of an issue.
export const ISSUE_FIELDS = [
  ['subject', 'Subject'], ['description', 'Description'], ['department', 'Department'], ['priority', 'Priority'], ['status', 'Status'],
  ['reportedBy', 'Reported by'], ['date', 'Date reported'], ['assignedTo', 'Assigned manager'], ['notify', 'Also informed'], ['dueDate', 'Due date'],
  ['location', 'Location'], ['site', 'Billboard site'], ['direction', 'Billboard face'], ['taskId', 'Related task'], ['review', 'Review needed'],
  ['dateCompleted', 'Date completed'], ['completionNotes', 'Completion notes'], ['history', 'Management history'],
];

// Fields hidden from a role. Anything not listed is visible. Roles that are not listed see everything.
export const HIDDEN_FIELDS = {
  admin: [],
  pm: [],
  fabManager: [],
  installCoordinator: ['review'],
  ic2: ['review', 'notify'],
  workshop: ['review', 'notify', 'site', 'direction'],
  designer: ['review', 'notify', 'site', 'direction'],
  fabWorker: ['review', 'notify', 'assignedTo', 'dueDate', 'site', 'direction'],
  installer: ['review', 'notify', 'assignedTo', 'dueDate', 'site', 'direction'],
  viewer: ['review', 'notify'],
  contractor: ['review', 'notify', 'assignedTo', 'dueDate', 'site', 'direction', 'taskId', 'history'],
};

export const hiddenFor = (roleId) => HIDDEN_FIELDS[roleId] || [];
export const canSeeField = (roleId, field) => !hiddenFor(roleId).includes(field);
export const hiddenCount = (roleId) => hiddenFor(roleId).length;
