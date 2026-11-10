import { JobForm } from '../components/JobForm';
import { useMe } from '../api/queries';

/** Add a job on its own page (the form is shared with Edit job). */
export function NewJob() {
	const me = useMe();
	if (me.isSuccess && !me.data.permissions.createJob) return <p className="table-empty">You do not have access to add jobs.</p>;
	return <JobForm isAdmin={!!me.data?.roles.includes('admin')} />;
}
