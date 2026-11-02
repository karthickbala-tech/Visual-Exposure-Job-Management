import { ApiError } from '../api/client';
import { useHealth, useMe } from '../api/queries';

/** Phase 0 landing page: proves the shell, the brand and the backend connection. */
export function Home() {
	const health = useHealth();
	const me = useMe();

	const apiState = health.isPending ? 'Checking...' : health.isSuccess ? 'Online' : 'Unreachable';
	const authState = me.isPending
		? 'Checking...'
		: me.isSuccess
			? `Signed in as ${me.data.user.email}`
			: me.error instanceof ApiError && me.error.status === 401
				? 'Not signed in'
				: 'Unavailable';

	return (
		<>
			<h1 className="page-title">Dashboard</h1>
			<section aria-label="System status" className="tiles">
				<div className="tile">
					<span className="tile__label">Backend</span>
					<span className="tile__value num" data-ok={health.isSuccess}>{apiState}</span>
				</div>
				<div className="tile">
					<span className="tile__label">Account</span>
					<span className="tile__value">{authState}</span>
				</div>
				<div className="tile">
					<span className="tile__label">Job stages</span>
					<span className="tile__chips">
						{['Preparation', 'In Progress', 'On Hold', 'Completed', 'Cancelled'].map((s) => (
							<span key={s} className="chip" data-status={s}>{s}</span>
						))}
					</span>
				</div>
			</section>
		</>
	);
}
