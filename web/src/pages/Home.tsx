import { Link } from 'react-router-dom';
import { useDashboard, useMe } from '../api/queries';
import { Chip } from '../components/Chip';
import './Table.css';

const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed'];

/** Role-aware dashboard. Managers see company figures; everyone sees their own upcoming work. */
export function Home() {
	const me = useMe();
	const q = useDashboard();
	const first = me.data?.user.firstName;

	return (
		<>
			<h1 className="page-title">{first ? `Hello, ${first}` : 'Dashboard'}</h1>

			{q.isPending && <p role="status">Loading your dashboard...</p>}
			{q.isError && <p role="alert">Could not load the dashboard.</p>}

			{q.isSuccess && q.data.scope === 'all' && (
				<>
					<section aria-label="Jobs by stage" className="tiles">
						{STAGES.map((s) => (
							<Link key={s} to="/jobs" className="tile tile--link">
								<span className="tile__label">
									<Chip status={s} />
								</span>
								<span className="tile__value num">{q.data.jobsByStage?.[s] ?? 0}</span>
							</Link>
						))}
					</section>
					<section aria-label="Needs attention" className="tiles">
						<Link to="/calendar" className="tile tile--link">
							<span className="tile__label">Overdue tasks</span>
							<span className="tile__value num" data-ok={q.data.overdueTasks === 0}>
								{q.data.overdueTasks ?? 0}
							</span>
						</Link>
						<Link to="/issues" className="tile tile--link">
							<span className="tile__label">Open issues</span>
							<span className="tile__value num" data-ok={q.data.openIssues === 0}>
								{q.data.openIssues ?? 0}
							</span>
						</Link>
						<div className="tile">
							<span className="tile__label">SWMS awaiting signature</span>
							<span className="tile__value num" data-ok={q.data.swmsAwaiting === 0}>
								{q.data.swmsAwaiting ?? 0}
							</span>
						</div>
					</section>
				</>
			)}

			{q.isSuccess && (
				<section aria-label="My upcoming work" className="group">
					<h2 className="group__title">My upcoming work</h2>
					{q.data.myTasks.length === 0 ? (
						<p>Nothing is assigned to you right now.</p>
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
											<td data-label="Task">
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
				</section>
			)}
		</>
	);
}
