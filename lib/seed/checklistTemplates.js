'use strict';

/**
 * First install checklists. PLACEHOLDER WORDING: replace with the real questions from the
 * Creator checklists. A changed template is a new row with a higher version (the key carries
 * the version because template_key is unique); open checklists keep the version they started on.
 */
const yesno = (key, label, extra = {}) => ({ key, label, type: 'yesno', required: true, ...extra });

const TEMPLATES = [
	{
		template_key: 'install.pre.lead@1',
		task_type: 'install', checklist_kind: 'Pre-job', phase: 'pre', assignee_role: 'lead', version_no: 1,
		definition: {
			sections: [
				{ key: 'arrival', title: 'Arrival', questions: [
					yesno('site_safe', 'Is the site safe to start work?', { raiseIssueOn: 'no' }),
					{ key: 'hazard_note', label: 'Describe the hazard', type: 'text', required: true, showIf: { key: 'site_safe', equals: 'no' } },
					yesno('swms_signed', 'Has the SWMS been read and signed by everyone on site?'),
					yesno('access_ok', 'Do you have access to the install location?', { raiseIssueOn: 'no' }),
					{ key: 'weather', label: 'Weather', type: 'choice', options: ['Fine', 'Rain', 'Wind', 'Extreme'], required: false },
				] },
				{ key: 'briefing', title: 'Briefing', questions: [yesno('crew_briefed', 'Has the crew been briefed on the job?')] },
			],
		},
	},
	{
		template_key: 'install.pre.member@1',
		task_type: 'install', checklist_kind: 'Pre-job', phase: 'pre', assignee_role: 'member', version_no: 1,
		definition: {
			sections: [
				{ key: 'arrival', title: 'Arrival', questions: [
					yesno('briefing_attended', 'Did you attend the team briefing?'),
					yesno('swms_read', 'Have you read and signed the SWMS?'),
				] },
			],
		},
	},
	{
		template_key: 'install.post.lead@1',
		task_type: 'install', checklist_kind: 'Post-job', phase: 'post', assignee_role: 'lead', version_no: 1,
		definition: {
			sections: [
				{ key: 'closure', title: 'Closure', questions: [
					yesno('work_complete', 'Is the install work complete?'),
					yesno('site_clean', 'Has the site been left clean and tidy?'),
					yesno('defects', 'Are there any defects or outstanding items?', { raiseIssueOn: 'yes' }),
					{ key: 'defect_notes', label: 'Describe the defects', type: 'text', required: true, showIf: { key: 'defects', equals: 'yes' } },
					{ key: 'finish_photo', label: 'Photo of the finished install', type: 'photo', required: false },
				] },
			],
		},
	},
	{
		template_key: 'install.post.member@1',
		task_type: 'install', checklist_kind: 'Post-job', phase: 'post', assignee_role: 'member', version_no: 1,
		definition: {
			sections: [
				{ key: 'closure', title: 'Closure', questions: [
					yesno('site_clean', 'Has your work area been left clean and tidy?'),
					{ key: 'notes', label: 'Anything the team leader should know?', type: 'text', required: false },
				] },
			],
		},
	},
];

module.exports = { TEMPLATES };
