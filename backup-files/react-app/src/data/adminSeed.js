// SAMPLE DATA ONLY. Starting values for the Admin area (FSD section 5.14).
// The notification events come from WORKFLOWS section 13. Debug and test mails are dropped.
// Placeholders in {braces} are filled in by the server when the email is sent.
export const MAIL_TEMPLATES = [
  { key: 'job_created', event: 'New job created', to: 'Fab Manager', subject: 'Job Checklist: {job}', body: 'A new job has been created: {job}.\nProject Manager: {pm}\nExpected finish: {finish}' },
  { key: 'task_approval', event: 'Submit for approval', to: 'PM (install, design) or Fab Manager (fab)', subject: '{type} Task Approval', body: '{employee} has submitted {task} for approval on {job}. Please review it.' },
  { key: 'task_rejected', event: 'Task rejected', to: 'Assignee', subject: '{type} Task is Rejected: {task}', body: 'Your task {task} was rejected by {manager}.\nReason: {comment}' },
  { key: 'install_finished', event: 'Install finished on site', to: 'PM, installation manager', subject: 'Install Finished On Site: {task} - {employee}', body: '{employee} has finished {task} on site.' },
  { key: 'equipment_off_hire', event: 'Equipment off hire', to: 'Equipment managers', subject: 'Equipment Off Hire: {task}', body: 'The install {task} has finished. Please send this equipment off hire:\n{equipment}' },
  { key: 'job_closure', event: 'Job closure report (sent once)', to: 'Directors, PM, Fab Manager', subject: 'Job Closed: {job}', body: '{job} has been closed by {closedBy}.\nBooked hours: {booked}\nQuoted hours: {quoted}' },
  { key: 'issue_reported', event: 'Issue reported, updated or completed', to: 'Department manager, reporter, inform-also list', subject: 'Issue {status}: {subject}', body: '{reportedBy} reported an issue in {department}.\nPriority: {priority}\n{description}' },
  { key: 'expiry_reminder', event: 'Expiry reminder', to: 'Installation manager, company, worker', subject: '{type} expires {expiry}', body: '{owner} has a {type} that expires on {expiry}. Please renew it.' },
];

export const PRIMARY_ROLES = ['Project Manager', 'Fab Manager', 'Fab 2IC', 'Fabricator', 'Installer', 'Workshop'];

// Who holds the manager roles that emails are sent to (settings key roles.assignments).
export const ROLE_ASSIGNMENTS = {
  fabManager: 'Tom Hendry',
  installationManager: 'Rachel Barnes',
  installCoordinator: 'Ben Okafor',
  director: 'Karen Wells',
};

// Sample notification log rows. One has failed so Retry can be tried. The real log is written by the server (FSD section 8).
const ago = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
export const SEED_NOTIFICATIONS = [
  { id: 'N-seed-1', at: ago(3), event: 'task.submitted', eventLabel: 'Submit for approval', recipient: 'Tom Hendry', recipientRole: 'Fab Manager', subject: 'Fabrication Task Approval', status: 'Sent', attempts: 1, ref: 'F5' },
  { id: 'N-seed-2', at: ago(5), event: 'install.finishedOnSite', eventLabel: 'Install finished on site', recipient: 'Rachel Barnes', recipientRole: 'Project Manager', subject: 'Install Finished On Site: Building letters L5 - Luke M.', status: 'Sent', attempts: 1, ref: 'I8' },
  { id: 'N-seed-3', at: ago(5), event: 'install.finishedOnSite', eventLabel: 'Install finished on site', recipient: 'Rachel Barnes', recipientRole: 'Installation manager', subject: 'Install Finished On Site: Building letters L5 - Luke M.', status: 'Failed', attempts: 2, ref: 'I8', error: 'Mailbox unavailable' },
  { id: 'N-seed-4', at: ago(27), event: 'issue.reported', eventLabel: 'Issue reported', recipient: 'Tom Hendry', recipientRole: 'Department manager', subject: 'Issue Reported: Spray booth filter overdue', status: 'Sent', attempts: 1, ref: 'IS-7' },
  { id: 'N-seed-5', at: ago(48), event: 'job.created', eventLabel: 'New job created', recipient: 'Tom Hendry', recipientRole: 'Fab Manager', subject: 'Job Checklist: Westbrook Entry Signage', status: 'Sent', attempts: 1, ref: 'J-1039' },
];
