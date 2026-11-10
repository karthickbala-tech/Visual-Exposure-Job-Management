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
	// added by the jobs list (JOB-2)
	pm_name?: string | null;
	fab_manager_name?: string | null;
	quoted_hours?: number;
	booked_hours?: number;
	risk?: string[];
	profit_email_at?: string | null;
	total_purchases?: number | string | null;
	stock_purchases?: number | string | null;
	close_triggered?: boolean;
	quote_ref?: string;
	pm_id?: string;
	fab_manager_id?: string;
	CREATEDTIME?: string;
	MODIFIEDTIME?: string;
	workdrive_url?: string;
	server_path?: string;
	job_status?: string;
	fab_hours_booked?: number;
	install_hours_booked?: number;
	fab_labour_cost?: number;
	install_labour_cost?: number;
	design_labour_cost_parent?: number;
	design_labour_cost_fab?: number;
	fab_labour_cost_parent?: number;
	fab_labour_cost_fab?: number;
	install_labour_cost_parent?: number;
	install_labour_cost_fab?: number;
	design_hours_booked?: number;
	design_labour_cost?: number;
	completed_date?: string | null;
	closure_email_sent?: boolean;
}

export interface JobTabCounts {
	all: number;
	all_open: number;
	my_open: number;
	my_jobs: number;
	preparation: number;
	ongoing: number;
	completed: number;
}

export interface Task {
	ROWID: string;
	job_id: string;
	task_type: 'design' | 'fabrication' | 'install';
	name: string;
	kind?: string;
	cost_type?: string | null;
	stage: string;
	quoted_hours?: string | number;
	booked_hours?: string | number;
	scheduled_date?: string;
	required_finish?: string;
	nextStages?: string[];
	swms_id?: string;
	parent_id?: string | null;
	team_leader?: string;
	team_members?: string;
	swms_status?: string | null;
	labour_cost?: string | number | null;
}

export interface Progress {
	fab: number;
	install: number;
	job: number;
}

export interface JobLocation { id: string; name: string; street?: string; city?: string; address: string; mapUrl?: string; crmSiteId?: string; addedTime?: string | null }
export interface JobDetailResponse {
	job: Job;
	tasks: Task[];
	progress: Progress;
	locations?: JobLocation[];
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
	task: Task & { description?: string; notes?: string; booked_hours?: string | number; proposed_hours?: string | number; spec?: string };
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
	assigned_to_id?: string | null;
	next_step?: string;
	work_completed?: string;
	due_date?: string | null;
	billboard_site?: string;
	billboard_face?: string;
	review_needed?: string;
	crm_deal_id?: string;
	completed_at?: string | null;
	CREATEDTIME?: string;
	nextStatuses?: string[];
}

export interface SwmsView {
	id: string;
	jobId: string;
	status: 'Created' | 'PM Signed' | 'TL Signed' | 'Not Required';
	pcbu: Record<string, string>;
	siteAddress: string;
	ppe: string[];
	hazards?: string[];
	tasks: { task: string; responsible?: string }[];
	declarations: { personId: string; name: string | null; at: string }[];
	signoff: { pm?: { name: string | null; at: string }; tl?: { name: string | null; at: string } };
}

export interface DashboardData {
	scope: 'all' | 'mine';
	today: string;
	myTasks: Task[];
	jobsByStage?: Record<string, number>;
	overdueTasks?: number;
	openIssues?: number;
	swmsAwaiting?: number;
	generatedAt?: string;
}

export interface CalendarItem {
	ROWID: string;
	job_id: string;
	name: string;
	task_type: 'design' | 'fabrication' | 'install';
	stage: string;
	scheduled_date: string;
}

export interface Person {
	ROWID: string;
	first_name: string;
	last_name?: string;
	email?: string;
	phone?: string;
	roles?: string;
	is_active?: boolean;
	hourly_rate?: string | number;
}

export interface ComplianceType {
	id: string;
	kind: string;
	name: string;
	requiresExpiry: boolean;
	mandatory: boolean;
	offsets: number[];
}

export interface ComplianceItem {
	id: string;
	kind: string;
	companyId?: string | null;
	companyName?: string | null;
	typeName: string | null;
	personId: string | null;
	personName: string | null;
	referenceNo: string;
	issueDate?: string | null;
	typeId?: string | null;
	expiryDate: string | null;
	daysLeft: number | null;
	status: 'Valid' | 'Expiring' | 'Expired' | 'No expiry';
}

export interface FileItem {
	id: string;
	name: string;
	kind: string;
	mimeType: string;
	sizeBytes: number;
	uploaded: boolean;
}

export interface EquipmentItem {
	id: string;
	code: string;
	name: string;
	type: string;
	locationId: string | null;
	locationName: string | null;
	status: 'In service' | 'Off hire' | 'Out of service';
	offHireRequired: boolean;
	frequencyDays: number | null;
	lastChecked: string | null;
	nextDue: string | null;
	overdue: boolean;
	daysOverdue: number;
}

export interface ChemicalItem {
	id: string;
	code: string;
	name: string;
	locationId: string | null;
	locationName: string | null;
	sdsUrl: string;
	sdsMissing: boolean;
	reviewDate: string | null;
	reviewDue: boolean;
	stock: number | null;
	unit: string;
	hazardClass: string;
}

export interface WorkshopLocation {
	id: string;
	name: string;
	description: string;
	supervisorId: string | null;
	supervisorName: string | null;
}

export interface DeviceItem {
	id: string;
	personName: string | null;
	model: string;
	os: string;
	lat: number | null;
	lng: number | null;
	address: string;
	lastSeenAt: string | null;
	stale: boolean;
	mapUrl: string | null;
}

export type Verb = 'view' | 'create' | 'edit' | 'delete';
export type Scope = 'all' | 'assigned' | 'own';
export type Matrix = Record<string, Record<string, { verbs: Verb[]; scope: Scope }>>;

export interface OutboxItem {
	id: string;
	jobType: string;
	entityType: string;
	entityId: string;
	status: 'Pending' | 'Done' | 'Failed';
	attempts: number;
	nextRunAt: string | null;
	lastError: string;
}

export interface CompanyItem {
	id: string;
	name: string;
	kind: 'subcontractor' | 'supplier' | 'client' | 'internal';
	street?: string;
	suburb?: string;
	state: string;
	postCode?: string;
	contactName: string;
	phone: string;
	email: string;
	notes: string;
	isActive: boolean;
}

export interface SiteItem {
	id: string;
	name: string;
	address: string;
	street?: string;
	suburb?: string;
	state?: string;
	postCode?: string;
	contactName: string;
	phone: string;
	country?: string;
	notes?: string;
	accessNotes?: string;
	businessHours?: string;
	tenantBusiness?: string;
	tenantContact?: string;
	tenantPhone?: string;
	tenantEmail?: string;
	ownerName?: string;
	ownerPhone?: string;
	ownerEmail?: string;
	isActive: boolean;
}

export interface SignItem {
	id: string;
	jobId: string;
	name: string;
	revision: string;
	qty: number;
	medium: string;
	finishing: string;
	installDate: string | null;
	signNumber?: string;
	dealStage?: string;
	artworkStage?: string;
	manufacturingStage?: string;
	installStage?: string;
}

export interface IntegrationCheck {
	configured: boolean;
	ok: boolean;
	message: string;
}
export interface IntegrationStatus {
	crm: IntegrationCheck;
	workdrive: IntegrationCheck;
	workdriveFolder: IntegrationCheck;
	workdriveFolderSet: boolean;
}

export interface QuoteLine {
	product: string;
	description: string;
	qty: number;
	unitPrice: number;
	discount: number;
	total: number;
}
export interface SignGroup {
	id: string;
	name: string;
	description: string;
	crmQuoteId: string | null;
	stage: string;
	truncated: boolean;
	totals: { subTotal: number; discount: number; tax: number; adjustment: number; grandTotal: number };
	items: QuoteLine[];
}
