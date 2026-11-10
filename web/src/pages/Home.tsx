import { Link } from 'react-router-dom';
import { useDashboard, useMe } from '../api/queries';
import { Chip } from '../components/Chip';
import { Card, Kpi, PageHeader, fmtDate } from '../components/ui';
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

			{q.isPending && <p role="status">Loading your dashboard…</p>}
			{q.isError && <p role="alert">Could not load the dashboard.</p>}

			{q.isSuccess && q.data.scope === 'all' && (
				<>
					<section className="kpis" aria-label="Needs attention">
						<Kpi label="Overdue tasks" value={q.data.overdueTasks ?? 0} to="/tasks" tone={q.data.overdueTasks ? 'danger' : 'ok'} note={q.data.overdueTasks ? 'past their required finish' : 'nothing overdue'} />
						<Kpi label="Open issues" value={q.data.openIssues ?? 0} to="/issues" tone={q.data.openIssues ? 'danger' : 'ok'} note={q.data.openIssues ? 'waiting for someone' : 'all clear'} />
						<Kpi label="SWMS awaiting signature" value={q.data.swmsAwaiting ?? 0} to="/swms" tone={q.data.swmsAwaiting ? 'danger' : 'ok'} note="before crews go on site" />
					</section>

					<ToDoList />

					<Card title="Go to" label="Shortcuts">
						<div className="actions">
							{[['/jobs', 'Jobs'], ['/tasks', 'Task board'], ['/calendar', 'Calendar'], ['/hours', 'Hours'], ['/compliance', 'Compliance'], ['/issues', 'Issues']].map(([to, label]) => (
								<Link key={to} className="btn btn-ghost" to={to}>{label}</Link>
							))}
						</div>
					</Card>

					<Card title="Jobs by stage" action={<Link className="view-all" to="/jobs">View all</Link>}>
						<div className="kpis">
							{STAGES.map((s) => (
								<Link key={s} to="/jobs" className="kpi">
									<span className="kpi-label">
										<Chip status={s} />
									</span>
									<span className="kpi-value num">{q.data.jobsByStage?.[s] ?? 0}</span>
								</Link>
							))}
						</div>
					</Card>
				</>
			)}

			{q.isSuccess && q.data.scope === 'mine' && <CrewTasks tasks={q.data.myTasks} today={q.data.today} />}

			{q.isSuccess && q.data.scope === 'all' && (
				<Card title="My upcoming work" flush>
					{q.data.myTasks.length === 0 ? (
						<p className="table-empty">Nothing is assigned to you right now.</p>
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
			)}
		</>
	);
}
