/** Shapes returned by the API. Catalyst sends numbers as strings, so numeric fields are parsed with num(). */
export interface Job {
	ROWID: string;
	name: string;
	stage: string;
	description?: string;
	crm_deal_id?: string;
	expected_finish?: string;
	agreed_fab_finish?: string;
	required_fab_finish?: string;
	created_date?: string;
	percent_fab?: string | number;
	percent_install?: string | number;
	percent_job?: string | number;
}

export interface Task {
	ROWID: string;
	job_id: string;
	task_type: 'design' | 'fabrication' | 'install';
	name: string;
	kind?: string;
	stage: string;
	quoted_hours?: string | number;
	booked_hours?: string | number;
	scheduled_date?: string;
	required_finish?: string;
	nextStages?: string[];
}

export interface Progress {
	fab: number;
	install: number;
	job: number;
}

export interface JobDetailResponse {
	job: Job;
	tasks: Task[];
	progress: Progress;
}

export const num = (v: string | number | undefined | null): number => {
	const n = Number(v);
	return Number.isFinite(n) ? n : 0;
};

export interface Assignee {
	linkId: string;
	personId: string;
	role: string;
	name: string | null;
}

export interface TaskDetailResponse {
	task: Task & { description?: string; notes?: string; booked_hours?: string | number };
	assignees: Assignee[];
	nextStages: string[];
}

export interface Question {
	key: string;
	label: string;
	type: 'yesno' | 'text' | 'number' | 'choice' | 'photo';
	required?: boolean;
	options?: string[];
	showIf?: { key: string; equals: string };
}

export interface ChecklistView {
	checklist: {
		id: string;
		taskId: string;
		phase: 'pre' | 'post';
		status: string;
		role: string;
		hours?: number | string | null;
	};
	definition: { sections: { key: string; title?: string; questions: Question[] }[] };
	answers: Record<string, string | number>;
	progress: { total: number; answered: number; percent: number; missing: string[]; issues: string[]; canComplete: boolean };
	next: Question | null;
}

export interface ChecklistListItem {
	id: string;
	phase: 'pre' | 'post';
	status: string;
	assigneeId: string | null;
	role: string;
	hours?: number | string | null;
}

export interface Issue {
	ROWID: string;
	subject: string;
	description?: string;
	department?: string;
	issue_status: string;
	issue_priority?: string;
	source_kind?: string;
	task_id?: string;
	CREATEDTIME?: string;
	nextStatuses?: string[];
}
