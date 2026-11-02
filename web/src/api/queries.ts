import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Job, JobDetailResponse } from './types';

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
