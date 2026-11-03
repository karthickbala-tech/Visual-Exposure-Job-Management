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
