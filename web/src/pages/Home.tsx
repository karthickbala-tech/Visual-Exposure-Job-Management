import { Link } from 'react-router-dom';
import { AlertTriangle, Briefcase, Calendar as CalendarIcon, Clock, Columns3, ShieldCheck } from 'lucide-react';
import { useDashboard, useMe } from '../api/queries';
import { Chip } from '../components/Chip';
import { Card, EmptyState, Kpi, PageHeader, fmtDate } from '../components/ui';
import { useRoleDashboard } from '../api/more';
import { CrewTasks } from '../components/CrewCards';
import { ToDoList } from '../components/ToDoList';

/** Where a tile goes when it is tapped. */
const TILE_LINK = (key: string): string | undefined => {
	if (key.startsWith('hours')) return '/hours';
	if (key.startsWith('my_open_jobs')) return '/jobs';
	if (key.startsWith('equipment')) return '/equipment';
	if (/^(fab|install|design|my_(fab|install|design)|workshop|jobs_with)/.test(key)) return '/tasks';
	return undefined;
};

const TILE_ROLES = ['project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'installer', 'fab_worker', 'workshop'];

/** The numbers for the person's own role (the first of their roles that has a dashboard). */
function RoleTiles({ roles }: { roles: string[] }) {
	const role = TILE_ROLES.find((r) => roles.includes(r));
	const q = useRoleDashboard(role);
	if (!role || !q.isSuccess || q.data.tiles.length === 0) return null;
	return (
		<section className="kpis" aria-label={`${role.replace(/_/g, ' ')} figures`}>
			{q.data.tiles.map((t) => (
				<Kpi key={t.key} to={TILE_LINK(t.key)} label={t.label} value={t.value} tone={/overdue|not filled/i.test(t.label) ? (t.value ? 'danger' : 'ok') : undefined} />
			))}
		</section>
	);
}

const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed'];

/** Quick links for managers. The targets are the same routes the old "Go to" buttons used. */
const SHORTCUTS = [
	{ to: '/jobs', label: 'Jobs', icon: Briefcase },
	{ to: '/tasks', label: 'Task board', icon: Columns3 },
	{ to: '/calendar', label: 'Calendar', icon: CalendarIcon },
	{ to: '/hours', label: 'Hours', icon: Clock },
	{ to: '/compliance', label: 'Compliance', icon: ShieldCheck },
	{ to: '/issues', label: 'Issues', icon: AlertTriangle },
];

const longDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Role-aware dashboard. Managers see company figures; everyone sees their own upcoming work. */
export function Home() {
	const me = useMe();
	const q = useDashboard();
	const first = me.data?.user.firstName;

	return (
		<>
			<PageHeader eyebrow={q.data ? longDate(q.data.today) : 'Dashboard'} title={first ? `Hello, ${first}` : 'Dashboard'} />

			{me.isSuccess && <RoleTiles roles={me.data.roles} />}

			{q.isPending && <p role="status" className="table-empty">Loading your dashboard…</p>}
			{q.isError && <p role="alert" className="form-error">Could not load the dashboard.</p>}

			{q.isSuccess && q.data.scope === 'all' && (
				<>
					<section className="kpis" aria-label="Needs attention">
						<Kpi label="Overdue tasks" value={q.data.overdueTasks ?? 0} to="/tasks" tone={q.data.overdueTasks ? 'danger' : 'ok'} note={q.data.overdueTasks ? 'past their required finish' : 'nothing overdue'} />
						<Kpi label="Open issues" value={q.data.openIssues ?? 0} to="/issues" tone={q.data.openIssues ? 'danger' : 'ok'} note={q.data.openIssues ? 'waiting for someone' : 'all clear'} />
						<Kpi label="SWMS awaiting signature" value={q.data.swmsAwaiting ?? 0} to="/swms" tone={q.data.swmsAwaiting ? 'danger' : 'ok'} note="before crews go on site" />
					</section>

					<div className="dash-grid">
						<div className="dash-col">
							<ToDoList />

							<Card title="My upcoming work" action={<Link className="view-all" to="/tasks">View all tasks</Link>} flush>
								{q.data.myTasks.length === 0 ? (
									<EmptyState title="All caught up" description="Nothing is assigned to you right now." />
								) : (
									<div className="table-wrap">
										<table className="table">
											<caption className="sr-only">My upcoming tasks</caption>
											<thead>
												<tr>
													<th scope="col">Task</th>
													<th scope="col">Stage</th>
													<th scope="col">Scheduled</th>
												</tr>
											</thead>
											<tbody>
												{q.data.myTasks.map((t) => (
													<tr key={t.ROWID}>
														<td data-label="Task" className="cell-primary">
															<Link to={'/tasks/' + t.ROWID}>{t.name}</Link>
														</td>
														<td data-label="Stage">
															<Chip status={t.stage} />
														</td>
														<td data-label="Scheduled">{fmtDate(t.scheduled_date)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</Card>
						</div>

						<div className="dash-col">
							<Card title="Jobs by stage" action={<Link className="view-all" to="/jobs">View all</Link>}>
								<div className="dash-stage-grid">
									{STAGES.map((s) => (
										<Link key={s} to="/jobs" className="stage-stat-item">
											<span className="stage-stat-chip">
												<Chip status={s} />
											</span>
											<span className="stage-stat-value num">{q.data.jobsByStage?.[s] ?? 0}</span>
										</Link>
									))}
								</div>
							</Card>

							<Card title="Go to" label="Shortcuts">
								<div className="quick-actions-grid">
									{SHORTCUTS.map(({ to, label, icon: Icon }) => (
										<Link key={to} className="quick-action-btn" to={to}>
											<Icon size={16} aria-hidden="true" />
											<span>{label}</span>
										</Link>
									))}
								</div>
							</Card>
						</div>
					</div>
				</>
			)}

			{q.isSuccess && q.data.scope === 'mine' && <CrewTasks tasks={q.data.myTasks} today={q.data.today} />}
		</>
	);
}
