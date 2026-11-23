/**
 * Plain words for the system codes shown on Admin > Email log and Admin > Outbox. Those tabs showed the raw codes
 * ("issue.raised", "no_recipients", "crm.update_deal"). A code not listed here is still shown, made readable.
 */
const readable = (code: string) => {
	const s = code.replace(/[._]/g, ' ').trim();
	return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Which email it was (lib/events/handlers.js, lib/services/complianceJob.js, weeklyReports.js). */
const EMAIL_EVENT: Record<string, string> = {
	'issue.raised': 'New issue',
	'issue.updated': 'Issue updated',
	'task.approval_requested': 'Task submitted for approval',
	'task.approval_flagged': 'Approval flagged for review or OH&S',
	'task.sent_back': 'Task sent back',
	'job.closed': 'Job closure report',
	'equipment.off_hire': 'Equipment off hire',
	'install.finished_on_site': 'Install finished on site',
	'fab.checklist_submitted': 'Fabrication checklist submitted',
	'compliance.due': 'Ticket or document expiring',
	'report.weekly_hours': 'Weekly hours report',
	'report.weekly_issues': 'Weekly issues report',
};

/** Why an email was not sent (lib/mail.js, lib/services/notifications.js). */
const EMAIL_REASON: Record<string, string> = {
	no_recipients: 'Nobody to send it to',
	no_sender: 'No sender address set up',
	failed: 'The mail service refused it',
};

const EMAIL_STATUS: Record<string, string> = { sent: 'Sent', skipped: 'Skipped', failed: 'Failed', retried: 'Retried' };

/** Work waiting to reach another system (lib/jobs/registry.js). */
const OUTBOX_WORK: Record<string, string> = {
	'crm.update_deal': 'Update the CRM deal',
	'workdrive.create_job_folder': 'Create the WorkDrive job folder',
	'workdrive.upload_file': 'Upload a file to WorkDrive',
};

export const emailEventLabel = (code: string) => EMAIL_EVENT[code] ?? readable(code);
export const emailReasonLabel = (code: string) => EMAIL_REASON[code] ?? readable(code);
export const emailStatusLabel = (code: string) => EMAIL_STATUS[code] ?? readable(code);
export const outboxWorkLabel = (code: string) => OUTBOX_WORK[code] ?? readable(code);
/** "job 1047" -> "Job 1047". */
export const entityLabel = (type: string, id: string) => [type ? readable(type) : '', id].filter(Boolean).join(' ');
