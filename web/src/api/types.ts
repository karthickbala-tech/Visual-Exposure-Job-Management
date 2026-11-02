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
