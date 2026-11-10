import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

/**
 * Hooks for the later backend batches: hours, boards, SWMS list, reports, dashboards, admin settings, emails and roles.
 * Each reads once and keeps the answer for a while: the plan's monthly request allowance is small (docs/REQUEST_BUDGET.md).
 */
const useGet = <T,>(key: unknown[], path: string, enabled = true, staleTime = 30_000) => useQuery({ queryKey: key, queryFn: () => api<T>(path), enabled, staleTime });
const send = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });
const qs = (o: Record<string, string | undefined>) => {
	const p = Object.entries(o).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`);
	return p.length ? '?' + p.join('&') : '';
};

// ---- hours ----
export interface HourCell { fab: number; install: number; workshop: number; design: number; other: number; unbilled: number; final?: number }
export interface HoursRow { personId: string; name: string; days: Record<string, HourCell>; totals: HourCell; labourCost?: number }
export interface HoursReport { rows: HoursRow[]; totals: HourCell; truncated: boolean; weekStart?: string; days?: string[]; period?: { start: string; end: string }; which?: string }
export const useWeeklyHours = (week?: string) => useGet<HoursReport>(['hours-week', week ?? ''], '/hours/weekly' + qs({ week }));
export const usePayPeriodHours = (which: 'this' | 'last', enabled: boolean) => useGet<HoursReport>(['hours-period', which], '/hours/pay-period' + qs({ which }), enabled);
export const useHoursNotFilled = () => useGet<{ workshop: number; other: number; total: number }>(['hours-not-filled'], '/hours/not-filled', true, 120_000);
export const useAddTime = (taskId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { work_date: string; hours: number; unbilled_hours?: number; person_id?: string }) => api(`/tasks/${taskId}/hours`, send('POST', v)),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['hours-week'] });
			qc.invalidateQueries({ queryKey: ['task', taskId] });
		},
	});
};

// ---- task board ----
export interface BoardItem { ROWID: string; name: string; job_id: string; kind: string | null; scheduled_date: string | null; required_finish: string | null; overdue: boolean }
export interface BoardColumn { stage: string; items: BoardItem[]; count: number; overdueCount: number }
export const useTaskBoard = (type: string) => useGet<{ type: string; columns: BoardColumn[]; truncated: boolean }>(['board', type], '/tasks/board' + qs({ type }));

// ---- SWMS and checklist reports ----
export interface SwmsListItem { id: string; status: string; jobId: string; siteAddress: string; task: { id: string; name: string; stage: string } | null }
export const useSwmsList = (view: string, mine: boolean) => useGet<{ items: SwmsListItem[]; count: number }>(['swms-list', view, mine], '/swms' + qs({ view, mine: mine ? 'true' : undefined }));
export interface ChecklistReportRow { id: string; taskId: string; taskName: string | null; phase: string; status: string; assigneeId: string | null; role: string; hours: number | null }
export const useChecklistReport = (phase: string, status: string) => useGet<{ items: ChecklistReportRow[]; count: number }>(['checklist-report', phase, status], '/reports/checklists' + qs({ phase, status }));

// ---- dashboards and compliance ----
export interface Tile { key: string; label: string; value: number }
export const useRoleDashboard = (role: string | undefined) => useGet<{ role: string; tiles: Tile[] }>(['role-dashboard', role ?? ''], `/dashboards/${role}`, !!role, 60_000);
export interface ComplianceCounts { [kind: string]: { overdue: number; today: number; within30: number } }
export const useComplianceDashboard = (active: boolean, enabled: boolean) =>
	useGet<{ today: string; counts: ComplianceCounts; workers: { ve: number; other: number } }>(['compliance-dash', active], '/compliance/dashboard' + qs({ active: String(active) }), enabled, 60_000);

// ---- admin: settings, emails, notifications, roles ----
export interface AppSettings {
	workshop_job_id?: string | null;
	pay_period?: { start_date: string; length_days: number } | null;
	issue_routing?: Record<string, { manager_id?: string | null; inform_also?: string[] }> | null;
	expiry_reminder_days?: number[] | null;
	pcbu_defaults?: Record<string, string> | null;
	hours_report_recipients?: string[] | null;
	hours_cutoff_date?: string | null;
}
export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api<{ settings: AppSettings }>('/admin/settings'), staleTime: 60_000 });
export const useSaveSettings = () => {
	const qc = useQueryClient();
	return useMutation({ mutationFn: (v: AppSettings) => api('/admin/settings', send('PUT', v)), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }) });
};
export interface MailTemplate { name: string; label: string; placeholders: string[]; override: { subject?: string; intro?: string; footer?: string } | null }
export const useMailTemplates = () => useGet<{ items: MailTemplate[] }>(['mail-templates'], '/admin/mail-templates', true, 60_000);
export const useSaveTemplate = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { name: string; subject: string | null; intro: string | null; footer: string | null }) => api(`/admin/mail-templates/${v.name}`, send('PUT', { subject: v.subject, intro: v.intro, footer: v.footer })),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['mail-templates'] }),
	});
};
export const previewTemplate = (name: string) => api<{ subject: string; html: string }>(`/admin/mail-templates/${name}/preview`);
export interface NotificationRow { id: string; event: string; status: string; subject: string; recipients: string[]; reason: string | null; at: string | null }
export const useNotifications = (status: string) => useGet<{ items: NotificationRow[] }>(['notifications', status], '/admin/notifications' + qs({ status }));
export const useRetryNotification = () => {
	const qc = useQueryClient();
	return useMutation({ mutationFn: (id: string) => api<{ sent: boolean; reason: string | null }>(`/admin/notifications/${id}/retry`, send('POST')), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
};
export const useRunReport = () => useMutation({ mutationFn: (which: 'weekly-hours' | 'weekly-issues') => api<Record<string, unknown>>(`/admin/reports/${which}`, send('POST')) });
export const useRoles = () => useGet<{ items: { key: string; label: string }[] }>(['roles'], '/roles', true, 600_000);
export const useUpdatePerson = () => {
	const qc = useQueryClient();
	return useMutation({ mutationFn: (v: { id: string; roles?: string[]; is_active?: boolean }) => api(`/people/${v.id}`, send('PATCH', { roles: v.roles, is_active: v.is_active })), onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }) });
};

/** PDFs open in a new tab: the browser sends the sign-in cookie and the server makes the file on request. */
export const pdfUrl = (path: string) => `${import.meta.env.VITE_API_BASE ?? '/server/api'}${path}`;

// ---- job close, issue history ----
export const useCloseJob = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => api(`/jobs/${jobId}/close`, send('POST')),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['job', jobId] });
			qc.invalidateQueries({ queryKey: ['jobs'] });
		},
	});
};
// ---- task management (managers) ----
const useTaskWrite = <V,>(taskId: string, fn: (v: V) => Promise<unknown>) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: fn,
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['task', taskId] });
			qc.invalidateQueries({ queryKey: ['job'] });
		},
	});
};
export const useUpdateTask = (taskId: string) => useTaskWrite(taskId, (v: Record<string, unknown>) => api(`/tasks/${taskId}`, send('PATCH', v)));
export const useAssign = (taskId: string) => useTaskWrite(taskId, (v: { person_id: string; role: string }) => api(`/tasks/${taskId}/assignees`, send('POST', v)));
export const useUnassign = (taskId: string) => useTaskWrite(taskId, (personId: string) => api(`/tasks/${taskId}/assignees/${personId}`, send('DELETE')));
export const useAddSubtask = (taskId: string) => useTaskWrite(taskId, (v: { name: string }) => api(`/tasks/${taskId}/subtasks`, send('POST', v)));
export const useRate = (taskId: string) => useTaskWrite(taskId, (v: { person_id: string; rating: number; comment?: string }) => api(`/tasks/${taskId}/ratings`, send('POST', v)));
export const useCreateWorkshopTask = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { name: string; scheduled_date?: string; required_finish?: string; repeat?: { every: number; unit: string } | null }) => api<{ task: { ROWID: string } }>('/tasks/workshop', send('POST', v)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['board'] }),
	});
};

export interface IssueChange { field: string; from: string; to: string }
export interface DeptCounts { Open: number; 'In Progress': number; Resolved: number; Closed: number; openTotal: number }
export const useIssueBoard = (enabled: boolean) => useGet<{ departments: string[]; counts: Record<string, DeptCounts>; truncated: boolean }>(['issue-board'], '/issues/board', enabled, 30_000);
export const useCrmDeal = () => useMutation({ mutationFn: (id: string) => api<{ created: boolean; dealId: string }>(`/issues/${id}/crm-deal`, send('POST')) });
export const useIssueHistory =(id: string, enabled: boolean) => useGet<{ items: { at: string | null; changes: IssueChange[] }[] }>(['issue-history', id], `/issues/${id}/history`, enabled);

// ---- people ----
export interface PersonFull { ROWID: string; first_name: string; last_name?: string; email?: string; phone?: string; person_kind?: string; job_title?: string; roles?: string; is_active?: boolean; hourly_rate?: string | number }
export const usePerson = (id: string | undefined) => useGet<{ person: PersonFull }>(['person', id ?? ''], `/people/${id}`, !!id, 60_000);
export const useRatings = (id: string | undefined) => useGet<{ items: { taskId: string; rating: number; comment: string; ratedAt: string | null }[]; count: number; average: number | null }>(['ratings', id ?? ''], `/people/${id}/ratings`, !!id, 60_000);
export const usePersonCompliance = (id: string | undefined) => useGet<{ items: { id: string; typeName: string | null; referenceNo: string; expiryDate: string | null; daysLeft: number | null; status: string }[] }>(['person-compliance', id ?? ''], `/compliance?person_id=${id}`, !!id, 60_000);
export const useCreatePerson = () => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (v: { first_name: string; last_name?: string; email?: string; phone?: string; person_kind?: string; roles?: string[] }) => api<{ person: PersonFull }>('/people', send('POST', v)),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['people'] }),
	});
};

// ---- manager's "to do now" ----
export interface TodoItem { id: string; tone: 'danger' | 'warn' | 'info'; title: string; detail: string; to: string; action: string }
export const useTodo = () => useGet<{ today: string; total: number; items: TodoItem[] }>(['todo'], '/dashboard/todo', true, 60_000);

// ---- checklist next step (crew) ----
export interface NextStep { phase: 'pre' | 'post' | null; action: 'start' | 'continue' | 'done'; checklistId: string | null; next: { label: string } | null }
export const useNextStep = (taskId: string, enabled: boolean) => useGet<NextStep>(['next-step', taskId], `/tasks/${taskId}/checklist/next`, enabled, 15_000);
