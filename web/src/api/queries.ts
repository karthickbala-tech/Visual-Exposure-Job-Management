import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { JobTabCounts, SignGroup, IntegrationStatus, CompanyItem, SiteItem, SignItem, Matrix, OutboxItem, CalendarItem, ChemicalItem, DeviceItem, EquipmentItem, WorkshopLocation, ChecklistListItem, ChecklistView, ComplianceItem, ComplianceType, DashboardData, FileItem, Issue, Job, Person, SwmsView, JobDetailResponse, TaskDetailResponse } from './types';

export interface Me {
	user: { id: string; email: string; firstName: string; lastName: string };
	roles: string[];
	permissions: { createJob: boolean; editJob: boolean; createTask: boolean; assignPeople: boolean };
	person: Record<string, unknown> | null;
}

export const useHealth = () =>
	useQuery({ queryKey: ['health'], queryFn: () => api<{ ok: boolean }>('/health'), retry: false });

/** Signed-in user. A 401 means "not signed in" and is handled by the auth gate, so no retries. */
export const useMe = () =>
	useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/me'), retry: false, staleTime: 5 * 60_000 });

/** The jobs list: one request serves the rows, the people names, the hours and the numbers on the tabs. */
export const useJobs = (stage?: string, view?: string, who: { pm_id?: string; fab_manager_id?: string } = {}) =>
	useQuery({
		queryKey: ['jobs', stage ?? 'all', view ?? 'all', who.pm_id ?? '', who.fab_manager_id ?? ''],
		queryFn: () =>
			api<{ items: Job[]; count: number; total?: number; truncated?: boolean; counts?: JobTabCounts }>(
				'/jobs' + [stage && `stage=${encodeURIComponent(stage)}`, view && view !== 'all' && `view=${view}`, who.pm_id && `pm_id=${who.pm_id}`, who.fab_manager_id && `fab_manager_id=${who.fab_manager_id}`].filter(Boolean).reduce<string>((s, p, i) => s + (i ? '&' : '?') + p, ''),
			),
		staleTime: 30_000,
	});

export const useJob = (id: string | undefined) =>
	useQuery({
		queryKey: ['job', id],
		queryFn: () => api<JobDetailResponse>(`/jobs/${id}`),
		enabled: !!id,
		staleTime: 30_000,
	});

const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const useCreateJob = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { name: string; description?: string }) => api<Job>('/jobs', json('POST', input)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
	});
};

export const useCreateTask = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { task_type: string; name: string; kind?: string; scheduled_date?: string; required_finish?: string; quoted_hours?: number; proposed_hours?: number; description?: string }) => api('/jobs/' + jobId + '/tasks', json('POST', input)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
	});
};

/** Move a task to another stage. Refreshes the job so progress and allowed actions update. */
export const useTransitionTask = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { taskId: string; to: string; comment?: string; ohs?: 'Yes' | 'No'; management_review?: boolean }) => {
			const { taskId, ...body } = v;
			return api('/tasks/' + taskId + '/transition', json('POST', body));
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['job', jobId] });
			qc.invalidateQueries({ queryKey: ['jobs'] });
		},
	});
};

export const useTask = (id: string | undefined) =>
	useQuery({ queryKey: ['task', id], queryFn: () => api<TaskDetailResponse>('/tasks/' + id), enabled: !!id, staleTime: 15_000 });

export const useTaskChecklists = (taskId: string | undefined) =>
	useQuery({
		queryKey: ['task-checklists', taskId],
		queryFn: () => api<{ items: ChecklistListItem[] }>('/tasks/' + taskId + '/checklists'),
		enabled: !!taskId,
	});

export const useChecklist = (id: string | undefined) =>
	useQuery({ queryKey: ['checklist', id], queryFn: () => api<ChecklistView>('/checklists/' + id), enabled: !!id });

export const useStartChecklist = (taskId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (phase: 'pre' | 'post') => api<ChecklistView>('/tasks/' + taskId + '/checklists', json('POST', { phase })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['task-checklists', taskId] }),
	});
};

export const useSaveAnswers = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (answers: Record<string, string | number | null>) =>
			api<ChecklistView>('/checklists/' + id + '/answers', json('PATCH', { answers })),
		onSuccess: (data) => qc.setQueryData(['checklist', id], data),
	});
};

export interface ShiftInput {
	work_date: string;
	start: string;
	end: string;
	break_minutes: number;
	unbilled_hours: number;
}

export const useCompleteChecklist = (id: string, taskId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (shift: ShiftInput | Record<string, never>) => api<ChecklistView>('/checklists/' + id + '/complete', json('POST', shift)),
		onSuccess: (data) => {
			qc.setQueryData(['checklist', id], data);
			qc.invalidateQueries({ queryKey: ['task-checklists', taskId] });
			qc.invalidateQueries({ queryKey: ['task', taskId] });
		},
	});
};

/** Every issue the person may see, in one request (up to 300); the page filters and counts them in memory. */
export const useIssues = (status?: string) =>
	useQuery({
		queryKey: ['issues', status ?? 'all'],
		queryFn: () => api<{ items: Issue[]; count: number }>('/issues?limit=300' + (status ? '&status=' + encodeURIComponent(status) : '')),
		staleTime: 15_000,
	});

export interface IssueInput {
	subject: string;
	description?: string;
	issue_priority?: string;
	department?: string;
	task_id?: string;
	site_id?: string;
	billboard_site?: string;
	billboard_face?: string;
	review_needed?: string;
}
export const useCreateIssue = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: IssueInput) => api('/issues', json('POST', input)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
	});
};

export type IssuePatch = Partial<{ issue_status: string; issue_priority: string; assigned_to_id: string | null; owner_id: string | null; department: string; description: string; next_step: string; work_completed: string; due_date: string | null; billboard_site: string; billboard_face: string; review_needed: string }>;
export const useUpdateIssue = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { id: string; patch: IssuePatch }) => api('/issues/' + v.id, json('PATCH', v.patch)),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['issues'] });
			void qc.invalidateQueries({ queryKey: ['issue-history'] });
		},
	});
};
export const useMoveIssue = useUpdateIssue;

export const useSwms = (id: string | undefined) =>
	useQuery({ queryKey: ['swms', id], queryFn: () => api<{ swms: SwmsView }>('/swms/' + id), enabled: !!id });

/** Sign, declare or edit a SWMS. Every action returns the fresh statement, which replaces the cached one. */
export const useSwmsAction = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { path: '' | '/sign' | '/declare' | '/advance'; method: 'PATCH' | 'POST'; body?: unknown }) =>
			api<{ swms: SwmsView }>('/swms/' + id + v.path, json(v.method, v.body)),
		onSuccess: (data) => qc.setQueryData(['swms', id], data),
	});
};

export const useFiles = (entityType: string, entityId: string) =>
	useQuery({
		queryKey: ['files', entityType, entityId],
		queryFn: () => api<{ items: FileItem[] }>('/files?entity_type=' + entityType + '&entity_id=' + entityId),
	});

/**
 * Three steps: ask the server for a short-lived upload link, send the file straight to storage
 * (it never passes through our server), then tell the server it finished.
 */
export const useUploadFile = (entityType: string, entityId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: async (file: File) => {
			const slot = await api<{ file: FileItem; uploadUrl: string; headers: Record<string, string> }>(
				'/files/upload-url',
				json('POST', { entity_type: entityType, entity_id: entityId, file_name: file.name, mime_type: file.type, size_bytes: file.size }),
			);
			const put = await fetch(slot.uploadUrl, { method: 'PUT', headers: slot.headers, body: file });
			if (!put.ok) throw new Error('The upload did not finish (' + put.status + '). Please try again.');
			return api<{ file: FileItem }>('/files/' + slot.file.id + '/confirm', json('POST'));
		},
		onSuccess: () => qc.invalidateQueries({ queryKey: ['files', entityType, entityId] }),
	});
};

export const getDownloadUrl = (id: string) => api<{ url: string; name: string }>('/files/' + id + '/download-url');

export const useDashboard = () =>
	useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardData>('/dashboard'), staleTime: 30_000 });

export const useCalendar = (from: string, to: string) =>
	useQuery({
		queryKey: ['calendar', from, to],
		queryFn: () => api<{ items: CalendarItem[] }>('/calendar?from=' + from + '&to=' + to),
		staleTime: 30_000,
	});

export const usePeople = (enabled: boolean) =>
	useQuery({ queryKey: ['people'], queryFn: () => api<{ items: Person[] }>('/people?limit=300'), enabled, staleTime: 60_000 });

export const useComplianceTypes = () =>
	useQuery({ queryKey: ['compliance-types'], queryFn: () => api<{ items: ComplianceType[] }>('/compliance/types'), staleTime: 5 * 60_000 });

export const useComplianceItems = (status?: string) =>
	useQuery({
		queryKey: ['compliance', status ?? 'all'],
		queryFn: () => api<{ items: ComplianceItem[] }>('/compliance' + (status ? '?status=' + encodeURIComponent(status) : '')),
		staleTime: 30_000,
	});

export const useUpdateCompliance = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { id: string; reference_no?: string; issue_date?: string | null; expiry_date?: string | null; is_active?: boolean }) => {
			const { id, ...patch } = v;
			return api('/compliance/' + id, json('PATCH', patch));
		},
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['compliance'] });
			void qc.invalidateQueries({ queryKey: ['person-compliance'] });
		},
	});
};

export const useCreateCompliance = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { person_id?: string; company_id?: string; type_id: string; reference_no?: string; issue_date?: string; expiry_date?: string }) => api('/compliance', json('POST', input)),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['compliance'] });
			void qc.invalidateQueries({ queryKey: ['person-compliance'] });
		},
	});
};

// Equipment, chemicals, workshop locations, devices
const useList = <T,>(key: string, path: string, enabled = true) =>
	useQuery({ queryKey: [key], queryFn: () => api<{ items: T[] }>(path), enabled, staleTime: 30_000 });
export const useEquipment = () => useList<EquipmentItem>('equipment', '/equipment?limit=300');
export const useChemicals = () => useList<ChemicalItem>('chemicals', '/chemicals?limit=300');
export const useLocations = () => useList<WorkshopLocation>('locations', '/locations');
export const useDevices = (enabled: boolean) => useList<DeviceItem>('devices', '/devices?limit=300', enabled);

/** One mutation helper for the register screens: send, then refresh the lists it affects. */
export const useRegisterWrite = (invalidate: string[]) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ method, path, body }: { method: 'POST' | 'PATCH'; path: string; body?: unknown }) => api(path, json(method, body ?? {})),
		onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
	});
};

// Admin: permission matrix and outbox
export const useAuthz = () =>
	useQuery({ queryKey: ['authz'], queryFn: () => api<{ matrix: Matrix; customised: boolean; version: number }>('/admin/authz') });

export const useSaveAuthz = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (matrix: Matrix) => api('/admin/authz', json('PUT', { matrix })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['authz'] }),
	});
};

export const useOutbox = (status: string) =>
	useQuery({ queryKey: ['outbox', status], queryFn: () => api<{ items: OutboxItem[] }>('/admin/outbox' + (status ? '?status=' + status : '')) });

export const useRetryOutbox = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => api('/admin/outbox/' + id + '/retry', json('POST')),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['outbox'] }),
	});
};

// Companies, sites, signs
export const useCompanies = () => useList<CompanyItem>('companies', '/companies?limit=300');
export const useSites = () => useList<SiteItem>('sites', '/sites?limit=300');
export const useSigns = (jobId: string) =>
	useQuery({ queryKey: ['signs', jobId], queryFn: () => api<{ items: SignItem[] }>('/jobs/' + jobId + '/signs'), enabled: !!jobId, staleTime: 30_000 });

/** Checks the Zoho connections on demand (two small reads at Zoho). Never runs by itself. */
export const useCheckIntegrations = () => useMutation({ mutationFn: () => api<IntegrationStatus>('/admin/integrations') });

// Quotes pulled from the CRM, saved as the job's sign groups
export const useSignGroups = (jobId: string) =>
	useQuery({ queryKey: ['sign-groups', jobId], queryFn: () => api<{ items: SignGroup[] }>('/jobs/' + jobId + '/sign-groups'), enabled: !!jobId, staleTime: 60_000 });

export const useSyncQuotes = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api<{ found: number; created: number; updated: number; unchanged: number }>('/jobs/' + jobId + '/sync-quotes', json('POST')),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['sign-groups', jobId] }),
	});
};

/** Ask the CRM for newly won deals and make jobs for them (the same thing the hourly job does). */
export const usePullWonDeals = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api<{ ran: boolean; reason?: string; changedDeals?: number; wonDeals?: number; created?: number; alreadyHadJob?: number; failed?: number }>('/admin/crm/pull-won-deals', json('POST')),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
	});
};
