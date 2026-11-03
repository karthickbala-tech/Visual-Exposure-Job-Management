// Settings that the Creator app hard-coded. In the Catalyst build these come from the settings table (FSD FAB-5).
export const WORKSHOP_JOB_ID = 'J-0000';
export const WORKSHOP_TASK_TYPES = ['Workshop', 'Maintenance'];

// Placeholder settings. In the Catalyst build these come from the settings table and are edited in the Admin area.
// FSD question 11 (pay period start day and length) and question 19 (hours-not-filled cutoff) are still open.
export const DEFAULT_SETTINGS = {
  payPeriod: { anchor: '2026-01-05', days: 14 }, // a Monday, fortnightly
  hoursCutoff: '2026-10-01', // Creator hard-coded October 2026
};
