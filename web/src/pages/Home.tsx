import { Link } from 'react-router-dom';
import { useDashboard, useMe } from '../api/queries';
import { Chip } from '../components/Chip';
import { Card, Kpi, PageHeader } from '../components/ui';

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

			{q.isPending && <p role="status">Loading your dashboard...</p>}
			{q.isError && <p role="alert">Could not load the dashboard.</p>}

			{q.isSuccess && q.data.scope === 'all' && (
				<>
					<section className="kpis" aria-label="Needs attention">
						<Kpi label="Overdue tasks" value={q.data.overdueTasks ?? 0} to="/calendar" tone={q.data.overdueTasks ? 'danger' : 'ok'} note={q.data.overdueTasks ? 'past their required finish' : 'nothing overdue'} />
						<Kpi label="Open issues" value={q.data.openIssues ?? 0} to="/issues" tone={q.data.openIssues ? 'danger' : 'ok'} note={q.data.openIssues ? 'waiting for someone' : 'all clear'} />
						<Kpi label="SWMS awaiting signature" value={q.data.swmsAwaiting ?? 0} tone={q.data.swmsAwaiting ? 'danger' : 'ok'} note="before crews go on site" />
					</section>

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

			{q.isSuccess && (
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
											<td data-label="Scheduled">{t.scheduled_date || '-'}</td>
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
