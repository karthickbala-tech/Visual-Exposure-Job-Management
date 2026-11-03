import { ISSUE_MANAGERS } from '../data/issuesSeed';
import { MAIL_TEMPLATES, PRIMARY_ROLES, ROLE_ASSIGNMENTS } from '../data/adminSeed';

// Settings that the Creator app hard-coded. In the Catalyst build these come from the settings table (FSD FAB-5).
export const WORKSHOP_JOB_ID = 'J-0000';
export const WORKSHOP_TASK_TYPES = ['Workshop', 'Maintenance'];

// Placeholder settings. In the Catalyst build these come from the settings table and are edited in the Admin area.
// FSD question 11 (pay period start day and length) and question 19 (hours-not-filled cutoff) are still open.
// Every value below is edited on the Admin screen (FSD section 5.14). Keys follow the Catalyst `setting` table in CATALYST_PLAN.md.

export const DEFAULT_SETTINGS = {
  payPeriod: { anchor: '2026-01-05', days: 14 }, // pay_period. A Monday, fortnightly (question 11 is open)
  hoursCutoff: '2026-10-01', // hours_cutoff. Creator hard-coded October 2026 (question 19 is open)
  expiryDays: 30, // expiry reminder days: items expiring within this many days show as Expiring
  workshopJobId: WORKSHOP_JOB_ID, // workshop_job_id
  pcbu: { name: 'Visual Exposure Pty Ltd', contact: '', phone: '' }, // pcbu_defaults, used by the SWMS PDF later
  roleAssignments: { ...ROLE_ASSIGNMENTS }, // roles.assignments
  issueRouting: JSON.parse(JSON.stringify(ISSUE_MANAGERS)), // notify.rules: manager and inform-also list per department
  hoursReportRecipients: ['Rachel Barnes'], // weekly hours report
  primaryRoles: [...PRIMARY_ROLES],
  templates: MAIL_TEMPLATES.map((t) => ({ ...t })), // template.<key>
};
