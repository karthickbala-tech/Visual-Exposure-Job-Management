/**
 * The names the staff already know, taken from the old Creator app (the Projects.ds export). The screens use these words
 * for fields, columns and lists, so nothing has to be relearned; only the layout and look are new.
 * Keep the sign stages in step with SIGN_STAGES in lib/services/directory.js.
 */
export const SIGN_STAGES = {
	deal: ['Early Design', 'Client Review', 'Needs Changes', 'Approved'],
	artwork: ['Not a job yet', 'Design Stage', 'Client Review', 'Needs Changes', 'Client Approved', 'Manual Approval'],
	manufacturing: ['Not required', 'RFQ', 'Quoted', 'Approved', 'In Production', 'QC', 'Completed'],
	install: ['Pre Install planning', 'Ready for Scheduling', 'Scheduled', 'Installed - POP not sent', 'Installed - POP sent', 'Completed'],
} as const;

/** Column and field names per kind of task, as in the old Creator forms. */
export const TASK_NAMES = {
	design: { typeLabel: 'Design Type', dateLabel: 'Required Finish', addLabel: 'Add Design Task', title: 'Design Tasks', table: 'Page - Job - Design Tasks' },
	fabrication: { typeLabel: 'Fab Type', dateLabel: 'Scheduled Date', addLabel: 'Add Fab Task', title: 'Fabrication Tasks', table: 'Page - Job - Fabrication Tasks' },
	install: { typeLabel: 'Install Type', dateLabel: 'Install Date', addLabel: 'Add Install Task', title: 'Installation Tasks', table: 'Page - Jobs - Install Tasks' },
} as const;

