import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../api/client';
import { useCalendar, useEquipment, useJobs } from '../api/queries';
import { useChecklistReport } from '../api/more';
import type { WorkTask } from '../api/more';
import type { CalendarItem } from '../api/types';
import { Chip } from './Chip';
import { Card, EmptyState, fmtDate } from './ui';
import { WorkshopTaskForm } from '../pages/TaskBoard';

/**
 * The parts of each role's dashboard that FSD section 5.12 lists beyond the tiles: calendars, task and job tables, and the
 * role's buttons. Every calendar on the page shares one request (the next seven days); each table is one list request.
 */

const DAYS = 7;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: string, n: number) => {
	const x = new Date(d + 'T00:00:00Z');
	x.setUTCDate(x.getUTCDate() + n);
	return iso(x);
};
const dayName = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const TYPE_NAME: Record<string, string> = { design: 'Design', fabrication: 'Fabrication', install: 'Install' };
type Kind = 'fab' | 'install' | 'design' | 'all';

/** The calendar's own rule (lib/domain/reports.js inCalendar): the install calendar leaves out External Install and Print Only. */
const inKind = (t: CalendarItem & { kind?: string | null }, kind: Kind) =>
	kind === 'all' ||
	(kind === 'fab' && t.task_type === 'fabrication') ||
	(kind === 'design' && t.task_type === 'design') ||
	(kind === 'install' && t.task_type === 'install' && t.kind !== 'External Install' && t.kind !== 'Print Only');

/** The next seven days of scheduled work, day by day. The server already limits crew to their own tasks. */
function WeekCalendar({ title, kind, today }: { title: string; kind: Kind; today: string }) {
	const from = today;
	const to = addDays(today, DAYS - 1);
	const q = useCalendar(from, to);
	const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));
	const items = (q.data?.items ?? []).filter((t) => inKind(t, kind));
	return (
		<Card title={title} action={<Link className="view-all" to="/calendar">Open calendar</Link>} flush>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert" className="table-empty">Could not load the calendar.</p>}
			{q.isSuccess && items.length === 0 && <EmptyState title="Nothing scheduled" description="No work is scheduled in the next seven days." />}
			{q.isSuccess && items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">{title}, next seven days</caption>
						<thead><tr><th scope="col">Day</th><th scope="col">Task</th><th scope="col">Type</th><th scope="col">Stage</th></tr></thead>
						<tbody>
							{days.flatMap((d) =>
								items.filter((t) => t.scheduled_date.slice(0, 10) === d).map((t, i) => (
									<tr key={t.ROWID}>
										<td data-label="Day">{i === 0 ? <strong>{d === today ? 'Today' : dayName(d)}</strong> : ''}</td>
										<td data-label="Task" className="cell-primary"><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></td>
										<td data-label="Type">{TYPE_NAME[t.task_type] ?? t.task_type}</td>
										<td data-label="Stage"><Chip status={t.stage} /></td>
									</tr>
								)),
							)}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

/** Open tasks for one table, from the task list (soonest first). `params` are the list filters (type, kind, assignee). */
function TaskTable({ title, params, today, empty }: { title: string; params: Record<string, string>; today: string; empty: string }) {
	const qs = new URLSearchParams({ ...params, open: 'true', detail: 'true', limit: '50' }).toString();
	const q = useQuery({ queryKey: ['dash-tasks', qs], queryFn: () => api<{ items: WorkTask[] }>('/tasks?' + qs), staleTime: 60_000 });
	const items = [...(q.data?.items ?? [])].sort((a, b) => String(a.scheduled_date || a.required_finish || '9999').localeCompare(String(b.scheduled_date || b.required_finish || '9999'))).slice(0, 10);
	const late = (t: WorkTask) => !!t.required_finish && t.required_finish.slice(0, 10) < today;
	return (
		<Card title={title} action={<Link className="view-all" to={'/tasks' + (params.type ? '?type=' + (params.type === 'fabrication' ? 'fabrication' : params.type) : '')}>View all</Link>} flush>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert" className="table-empty">Could not load the tasks.</p>}
			{q.isSuccess && items.length === 0 && <EmptyState title="All clear" description={empty} />}
			{items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">{title}</caption>
						<thead><tr><th scope="col">Task</th><th scope="col">Job</th><th scope="col">Stage</th><th scope="col">Scheduled</th><th scope="col">Required finish</th></tr></thead>
						<tbody>
							{items.map((t) => (
								<tr key={t.ROWID} className={late(t) ? 'jd-row--late' : ''}>
									<td data-label="Task" className="cell-primary"><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></td>
									<td data-label="Job">{t.job_name ? <Link to={'/jobs/' + t.job_id}>{t.job_name}</Link> : '-'}</td>
									<td data-label="Stage"><Chip status={t.stage} /></td>
									<td data-label="Scheduled">{fmtDate(t.scheduled_date)}</td>
									<td data-label="Required finish">{fmtDate(t.required_finish)}{late(t) && <span className="kind-tag kind-tag--late">Overdue</span>}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

/** Open jobs, from the jobs list: the PM's own ("my_open") or every open job, with the fab progress when asked. */
function JobsTable({ title, view, showFab }: { title: string; view: 'my_open' | 'all_open'; showFab?: boolean }) {
	const q = useJobs(undefined, view);
	const items = (q.data?.items ?? []).slice(0, 10);
	return (
		<Card title={title} action={<Link className="view-all" to="/jobs">View all</Link>} flush>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert" className="table-empty">Could not load the jobs.</p>}
			{q.isSuccess && items.length === 0 && <EmptyState title="No open jobs" description="Nothing open right now." />}
			{items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">{title}</caption>
						<thead><tr><th scope="col">Job</th><th scope="col">Stage</th>{showFab && <th scope="col" className="num">% Fab</th>}<th scope="col" className="num">% Job</th><th scope="col">Expected finish</th></tr></thead>
						<tbody>
							{items.map((j) => (
								<tr key={j.ROWID}>
									<td data-label="Job" className="cell-primary"><Link to={'/jobs/' + j.ROWID}>{j.name}</Link></td>
									<td data-label="Stage"><Chip status={j.stage} /></td>
									{showFab && <td data-label="% Fab" className="num">{Number(j.percent_fab ?? 0)}</td>}
									<td data-label="% Job" className="num">{Number(j.percent_job ?? 0)}</td>
									<td data-label="Expected finish">{fmtDate(j.expected_finish)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

/** The fab worker's post-job checklists that are still open (the server lists only their own). */
function MyPostChecklists() {
	const q = useChecklistReport('post', 'Not Completed');
	const items = (q.data?.items ?? []).slice(0, 10);
	return (
		<Card title="My post-job checklists" action={<Link className="view-all" to="/reports/checklists">View all</Link>} flush>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert" className="table-empty">Could not load your checklists.</p>}
			{q.isSuccess && items.length === 0 && <EmptyState title="All done" description="No post-job checklist is waiting for you." />}
			{items.length > 0 && (
				<ul className="plain-list">
					{items.map((c) => <li key={c.id}><Link to={'/checklists/' + c.id}>{c.taskName ?? 'Task ' + c.taskId}</Link> <Chip status={c.status} /></li>)}
				</ul>
			)}
		</Card>
	);
}

/** Overdue equipment checks for the workshop: the ones the person is responsible for first. */
function OverdueChecks({ myId }: { myId: string }) {
	const q = useEquipment();
	const items = (q.data?.items ?? []).filter((e) => e.overdue).sort((a, b) => Number(b.responsibleId === myId) - Number(a.responsibleId === myId) || b.daysOverdue - a.daysOverdue).slice(0, 10);
	return (
		<Card title="Overdue equipment checks" action={<Link className="view-all" to="/equipment">Equipment register</Link>} flush>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert" className="table-empty">Could not load the equipment.</p>}
			{q.isSuccess && items.length === 0 && <EmptyState title="All checked" description="No equipment check is overdue." />}
			{items.length > 0 && (
				<ul className="plain-list">
					{items.map((e) => (
						<li key={e.id}>
							<strong>{e.code}</strong> {e.name}{e.responsibleId === myId ? ' (yours)' : ''} <span className="chip chip-red">{e.daysOverdue} days overdue</span>
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}

/** "Create Workshop Task" (FAB-5): the same form as on the task board, on the Fab Manager and Workshop dashboards. */
function WorkshopButton() {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button className="btn" onClick={() => setOpen(true)}><Plus size={16} aria-hidden="true" /> Create Workshop Task</button>
			{open && <WorkshopTaskForm onClose={() => setOpen(false)} />}
		</>
	);
}

const DASH_ROLES = ['project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'installer', 'fab_worker', 'workshop'] as const;

/** The sections of the person's own dashboard (the first of their roles with one), as FSD section 5.12 lists them. */
export function RoleDashboard({ roles, today, myId }: { roles: string[]; today: string; myId: string }) {
	const role = DASH_ROLES.find((r) => roles.includes(r));
	if (!role) return null;
	const mine = { assignee: 'me' };
	return (
		<div className="dash-grid">
			{role === 'project_manager' && (
				<>
					<div className="dash-col">
						<JobsTable title="My open jobs" view="my_open" />
						<TaskTable title="Open install tasks" params={{ type: 'install' }} today={today} empty="No open install tasks." />
						<TaskTable title="Open design tasks" params={{ type: 'design' }} today={today} empty="No open design tasks." />
					</div>
					<div className="dash-col">
						<WeekCalendar title="Install calendar" kind="install" today={today} />
						<WeekCalendar title="Fab calendar" kind="fab" today={today} />
					</div>
				</>
			)}
			{role === 'fab_manager' && (
				<>
					<div className="dash-col">
						<div className="inline-form"><WorkshopButton /></div>
						<TaskTable title="Open fabrication tasks" params={{ type: 'fabrication' }} today={today} empty="No open fabrication tasks." />
						<TaskTable title="Open design tasks" params={{ type: 'design' }} today={today} empty="No open design tasks." />
					</div>
					<div className="dash-col">
						<WeekCalendar title="Fab calendar" kind="fab" today={today} />
						<JobsTable title="Open jobs" view="all_open" showFab />
					</div>
				</>
			)}
			{role === 'second_ic' && (
				<>
					<div className="dash-col"><TaskTable title="My open fabrication tasks" params={{ type: 'fabrication', ...mine }} today={today} empty="No open fabrication tasks for you." /></div>
					<div className="dash-col"><WeekCalendar title="Fab calendar by day" kind="fab" today={today} /></div>
				</>
			)}
			{role === 'install_coordinator' && (
				<>
					<div className="dash-col">
						<div className="inline-form">
							<Link className="btn btn-ghost" to="/hours?view=this">Booked hours this pay period</Link>
							<Link className="btn btn-ghost" to="/hours?view=last">Booked hours last pay period</Link>
						</div>
						<TaskTable title="Open install tasks" params={{ type: 'install' }} today={today} empty="No open install tasks." />
						<JobsTable title="Open jobs" view="all_open" />
					</div>
					<div className="dash-col"><WeekCalendar title="Install calendar" kind="install" today={today} /></div>
				</>
			)}
			{role === 'installer' && (
				<>
					<div className="dash-col"><WeekCalendar title="My day" kind="all" today={today} /></div>
					<div className="dash-col"><TaskTable title="My open install tasks" params={{ type: 'install', ...mine }} today={today} empty="No open install tasks for you." /></div>
				</>
			)}
			{role === 'fab_worker' && (
				<>
					<div className="dash-col"><WeekCalendar title="My calendar" kind="all" today={today} /></div>
					<div className="dash-col"><MyPostChecklists /></div>
				</>
			)}
			{role === 'workshop' && (
				<>
					<div className="dash-col">
						<div className="inline-form"><WorkshopButton /></div>
						<TaskTable title="Open workshop tasks" params={{ type: 'fabrication', kind: 'Workshop' }} today={today} empty="No open workshop tasks." />
					</div>
					<div className="dash-col"><OverdueChecks myId={myId} /></div>
				</>
			)}
		</div>
	);
}
