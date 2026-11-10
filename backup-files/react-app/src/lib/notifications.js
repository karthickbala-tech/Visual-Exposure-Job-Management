// Notification log (FSD section 8, WORKFLOWS section 13). Every email the app would send writes one row per recipient.
// Recipients are resolved by role from settings, never typed in. In the demo no email is sent. Pure functions.

// event -> label, recipients (role labels or names), subject. ctx carries the task, job or issue details.
export const EVENTS = {
  'job.created': { label: 'New job created', subject: (c) => `Job Checklist: ${c.job}`, to: (c, s) => [['Fab Manager', s.roleAssignments?.fabManager]] },
  'task.submitted': {
    label: 'Submit for approval',
    subject: (c) => `${c.type} Task Approval`,
    to: (c, s) => (c.kind === 'fab' ? [['Fab Manager', s.roleAssignments?.fabManager]] : [['Project Manager', c.pm]]),
  },
  'task.rejected': { label: 'Task rejected', subject: (c) => `${c.type} Task is Rejected: ${c.task}`, to: (c) => (c.assignees || []).map((a) => ['Assignee', a]) },
  'checklist.fabSubmitted': { label: 'Fab checklist submitted', subject: (c) => `Fab Checklist Submitted: ${c.task} - ${c.employee}`, to: (c, s) => [['Fab Manager', s.roleAssignments?.fabManager]] },
  'install.finishedOnSite': {
    label: 'Install finished on site',
    subject: (c) => `Install Finished On Site: ${c.task} - ${c.employee}`,
    to: (c, s) => [['Project Manager', c.pm], ['Installation manager', s.roleAssignments?.installationManager]],
  },
  'equipment.offHire': {
    label: 'Equipment off hire',
    subject: (c) => `Equipment Off Hire: ${c.task}`,
    to: (c, s) => [['Equipment manager', s.roleAssignments?.fabManager], ['Equipment manager', s.roleAssignments?.installationManager]],
  },
  'job.closed': {
    label: 'Job closure report',
    subject: (c) => `Job Closed: ${c.job}`,
    to: (c, s) => [['Director', s.roleAssignments?.director], ['Project Manager', c.pm], ['Fab Manager', s.roleAssignments?.fabManager]],
  },
  'issue.reported': { label: 'Issue reported', subject: (c) => `Issue Reported: ${c.subject}`, to: (c, s) => issueRecipients(c, s) },
  'issue.updated': { label: 'Issue updated', subject: (c) => `Record Updated: ${c.subject}`, to: (c, s) => issueRecipients(c, s) },
  'issue.completed': { label: 'Issue completed', subject: (c) => `Issue Completed: ${c.subject}`, to: (c, s) => issueRecipients(c, s) },
};

// Department manager, the reporter, and the inform-also list from the Admin routing settings.
function issueRecipients(c, s) {
  const route = (s.issueRouting || {})[c.department] || { manager: '', also: [] };
  return [['Department manager', route.manager], ['Reporter', c.reportedBy], ...(route.also || []).map((p) => ['Inform also', p])];
}

// One row per distinct recipient. Returns [] for an unknown event or when nobody could be resolved.
export function makeNotifications(event, ctx, settings, at, seed = Date.now()) {
  const def = EVENTS[event];
  if (!def) return [];
  const seen = new Set();
  const rows = [];
  def.to(ctx, settings).forEach(([role, name]) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    rows.push({ id: `N${seed.toString(36)}${rows.length}`, at, event, eventLabel: def.label, recipient: name, recipientRole: role, subject: def.subject(ctx), status: 'Sent', attempts: 1, ref: ctx.ref || '' });
  });
  return rows;
}

export const NOTIFICATION_STATUSES = ['Sent', 'Failed'];

// Retry sets a failed row to Sent and counts the attempt. Rows that are not failed are left alone.
export const retried = (row, at) => (row.status === 'Failed' ? { ...row, status: 'Sent', attempts: row.attempts + 1, at, error: '' } : row);

export function filterLog(log, { status = 'All', event = 'All', q = '' } = {}) {
  const needle = q.trim().toLowerCase();
  return log.filter((r) => (status === 'All' || r.status === status) && (event === 'All' || r.event === event)
    && (!needle || `${r.recipient} ${r.subject} ${r.ref}`.toLowerCase().includes(needle)));
}

export const logSummary = (log) => ({ total: log.length, sent: log.filter((r) => r.status === 'Sent').length, failed: log.filter((r) => r.status === 'Failed').length });
