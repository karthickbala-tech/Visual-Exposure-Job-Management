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

/** Design and fabrication: one short pre and post checklist per role. PLACEHOLDER wording, like install. */
const section = (title, questions) => ({ sections: [{ key: title.toLowerCase(), title, questions }] });
const simple = (taskType, label, phase, role, questions) => ({
	template_key: `${taskType}.${phase}.${role}@1`,
	task_type: taskType,
	checklist_kind: phase === 'pre' ? 'Pre-job' : 'Post-job',
	phase,
	assignee_role: role,
	version_no: 1,
	definition: section(phase === 'pre' ? 'Start' : 'Finish', questions),
});

for (const role of ['lead', 'member']) {
	TEMPLATES.push(
		simple('design', 'Design', 'pre', role, [
			yesno('brief_read', 'Have you read the design brief and spec?'),
			yesno('assets_ok', 'Do you have the artwork files and site measurements you need?', { raiseIssueOn: 'no' }),
		]),
		simple('design', 'Design', 'post', role, [
			yesno('proof_ready', 'Is the proof ready for review?'),
			{ key: 'notes', label: 'Notes for the reviewer', type: 'text', required: false },
		]),
		simple('fabrication', 'Fabrication', 'pre', role, [
			yesno('materials_ok', 'Are all materials and parts on hand?', { raiseIssueOn: 'no' }),
			yesno('ppe_ok', 'Is the right PPE and equipment ready?'),
		]),
		simple('fabrication', 'Fabrication', 'post', role, [
			yesno('built_to_spec', 'Is the item built to spec and quality checked?'),
			yesno('workshop_clean', 'Is the workshop area clean and tools put away?'),
			{ key: 'notes', label: 'Notes for the install team', type: 'text', required: false },
		])
	);
}

/**
 * Version 2: the real Creator wording and the team leader / team member split (docs/DS_CHECKLIST_RULES.md, from the DS show and hide
 * scripts). Not in these templates, on purpose: start, finish and total hours (the app records them when the checklist is completed),
 * and the DS variants by install type (Minor Task) or fab type (Workshop), because a template is chosen only by task type, phase and role.
 * No raiseIssueOn is set: the DS scripts do not say which answers raise an issue (owner to confirm). The briefing rating and the
 * management review are optional here because the DS asks them only for some job types.
 */
const rating = (key, label) => ({ key, label, type: 'choice', options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], required: false });
const note = (key, label, extra = {}) => ({ key, label, type: 'text', required: false, ...extra });
const photo = (key, label) => ({ key, label, type: 'photo', required: false });
const v2 = (taskType, phase, role, sections) => ({
	template_key: `${taskType}.${phase}.${role}@2`,
	task_type: taskType,
	checklist_kind: phase === 'pre' ? 'Pre-job' : 'Post-job',
	phase,
	assignee_role: role,
	version_no: 2,
	definition: { sections },
});
const whs = [
	yesno('whs_issues', 'Were there any WHS issues in completing the job?'),
	note('whs_details', 'Describe the WHS issues', { required: true, showIf: { key: 'whs_issues', equals: 'yes' } }),
	yesno('area_cleaned', 'Was the work area cleaned/tidied after the job completed?'),
];

TEMPLATES.push(
	v2('install', 'pre', 'lead', [
		{ key: 'prejob', title: 'Pre job check list', questions: [
			yesno('scope_clear', 'Are you clear on the scope of works for the job?'),
			yesno('prints_clear', 'Are you clear about what location each of the printed materials needs to be installed?'),
			yesno('parking_clear', 'Are you clear about where you can park in close proximity to your work site?'),
			yesno('tools_reviewed', 'Have you reviewed the list of tools that you need to take to this site?'),
			yesno('vehicle_loaded', 'Have you loaded your vehicle/jobs bay for the works?'),
			yesno('ppe_checked', 'Have you checked if you need to bring in any specific clothing, cards, PPE etc?'),
			yesno('access_equipment', 'Access equipment: if you are being provided access equipment for this job, have you reviewed it to ensure that it will be suitable for the tasks that you are performing?'),
			yesno('subcontractors', 'Are you aware of the subcontractors on site that you will be managing and what their role is?'),
		] },
		{ key: 'arrival', title: 'Job arrival check list', questions: [
			yesno('swms_briefed', 'Have you read the SWMS, briefed other on site staff and collected signatures?'),
			photo('arrival_photo', 'Photos'),
		] },
	]),
	v2('install', 'pre', 'member', [
		{ key: 'prejob', title: 'Pre job check list', questions: [
			yesno('checked_in', 'Have you checked in with your team leader about this job?'),
			yesno('vehicle_loaded', "Is your vehicle loaded for this job? (If your team leader isn't back, then do as much as you can to help them out)"),
			yesno('ppe_checked', 'Have you checked if you need to bring in any specific clothing, cards, PPE etc?'),
		] },
		{ key: 'arrival', title: 'Job arrival check list', questions: [
			yesno('swms_signed', 'Have you read the SWMS and signed the SWMS?'),
			photo('arrival_photo', 'Photos'),
		] },
	]),
	v2('install', 'post', 'lead', [
		{ key: 'onsite', title: 'Post job checklist 1 (on site)', questions: [
			...whs,
			note('onsite_notes', 'Do you have any notes on this job?'),
			photo('finish_photo', 'Please upload good photos of the completed job'),
		] },
		{ key: 'closure', title: 'Post job checklist 2 (closure)', questions: [
			yesno('management_review', 'Do you believe that a management level review should be made of this job to discuss issues and improvements we could make?', { required: false }),
			rating('briefing_rating', 'Please rate the quality of the briefing that you received before this job began, from 1 (poor) to 10 (excellent).'),
		] },
	]),
	v2('install', 'post', 'member', [
		{ key: 'onsite', title: 'Post job checklist 1 (on site)', questions: [
			...whs,
			note('onsite_notes', 'Do you have any notes on this job?'),
			photo('finish_photo', 'Please upload good photos of the completed job'),
		] },
		{ key: 'closure', title: 'Post job checklist 2 (closure)', questions: [
			yesno('management_review', 'Do you believe that a management level review should be made of this job to discuss issues and improvements we could make?', { required: false }),
		] },
	]),
	v2('fabrication', 'pre', 'lead', [
		{ key: 'prejob', title: 'Pre job check list', questions: [
			yesno('scope_clear', 'Are you clear on the scope of works for the job?'),
			yesno('quality_clear', 'Are you clear about the finish quality required for this job?'),
			yesno('due_clear', 'Are you clear about when this task needs to be completed by?'),
		] },
	]),
	v2('fabrication', 'pre', 'member', [
		{ key: 'prejob', title: 'Pre job check list', questions: [
			yesno('checked_in', 'Have you checked in with your team leader about this job?'),
			yesno('due_clear', 'Are you clear about when this task needs to be completed by?'),
		] },
	]),
	...['lead', 'member'].map((role) =>
		v2('fabrication', 'post', role, [
			{ key: 'finish', title: 'Post job check list', questions: [
				yesno('ohs_issues', 'Were there any OH&S issues in completing the job?'),
				note('ohs_details', 'Describe the OH&S issues', { required: true, showIf: { key: 'ohs_issues', equals: 'yes' } }),
				note('task_notes', 'Are there any notes for this task that you need to inform us of?'),
				photo('finish_photo', 'Please upload good photos of the completed job'),
				yesno('management_review', 'Do you believe that a management level review should be made of this job to discuss issues and improvements we could make?', { required: false }),
				rating('briefing_rating', 'Please rate the quality of the briefing that you received before this job began, from 1 (poor) to 10 (excellent).'),
			] },
		])
	)
);

module.exports = { TEMPLATES };
