import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ChecklistListItem, ChecklistView, FileItem, Issue, Job, SwmsView, JobDetailResponse, TaskDetailResponse } from './types';

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

export const useJobs = (stage?: string) =>
	useQuery({
		queryKey: ['jobs', stage ?? 'all'],
		queryFn: () => api<{ items: Job[]; count: number }>(`/jobs${stage ? `?stage=${encodeURIComponent(stage)}` : ''}`),
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
		mutationFn: (input: { task_type: string; name: string }) => api('/jobs/' + jobId + '/tasks', json('POST', input)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['job', jobId] }),
	});
};

/** Move a task to another stage. Refreshes the job so progress and allowed actions update. */
export const useTransitionTask = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { taskId: string; to: string }) => api('/tasks/' + v.taskId + '/transition', json('POST', { to: v.to })),
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

export const useIssues = (status?: string) =>
	useQuery({
		queryKey: ['issues', status ?? 'all'],
		queryFn: () => api<{ items: Issue[]; count: number }>('/issues' + (status ? '?status=' + encodeURIComponent(status) : '')),
		staleTime: 15_000,
	});

export const useCreateIssue = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (input: { subject: string; description?: string; issue_priority?: string }) => api('/issues', json('POST', input)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
	});
};

export const useMoveIssue = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { id: string; issue_status: string }) => api('/issues/' + v.id, json('PATCH', { issue_status: v.issue_status })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['issues'] }),
	});
};

export const useSwms = (id: string | undefined) =>
	useQuery({ queryKey: ['swms', id], queryFn: () => api<{ swms: SwmsView }>('/swms/' + id), enabled: !!id });

/** Sign, declare or edit a SWMS. Every action returns the fresh statement, which replaces the cached one. */
export const useSwmsAction = (id: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { path: '' | '/sign' | '/declare'; method: 'PATCH' | 'POST'; body?: unknown }) =>
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
