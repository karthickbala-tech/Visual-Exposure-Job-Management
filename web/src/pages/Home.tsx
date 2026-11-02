import { Link } from 'react-router-dom';
import { useJobs, useMe } from '../api/queries';
import { Chip } from '../components/Chip';

const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed'];

/** Dashboard placeholder for Phase 1: counts by stage, from the jobs the user can see. */
export function Home() {
	const me = useMe();
	const jobs = useJobs();
	const first = me.data?.user.firstName;

	const counts = new Map<string, number>();
	for (const j of jobs.data?.items ?? []) counts.set(j.stage, (counts.get(j.stage) ?? 0) + 1);

	return (
		<>
			<h1 className="page-title">{first ? `Hello, ${first}` : 'Dashboard'}</h1>

			<section aria-label="Jobs by stage" className="tiles">
				{STAGES.map((s) => (
					<Link key={s} to="/jobs" className="tile tile--link">
						<span className="tile__label">
							<Chip status={s} />
						</span>
						<span className="tile__value num">{jobs.isSuccess ? (counts.get(s) ?? 0) : '-'}</span>
					</Link>
				))}
			</section>
			{jobs.isError && <p role="alert">Could not load job counts.</p>}
		</>
	);
}
