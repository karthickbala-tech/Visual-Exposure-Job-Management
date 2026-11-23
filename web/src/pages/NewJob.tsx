import { JobForm } from '../components/JobForm';
import { useMe } from '../api/queries';
import { NoAccess } from '../components/Guard';

/** Add a job on its own page (the form is shared with Edit job). */
export function NewJob() {
	const me = useMe();
	if (me.isSuccess && !me.data.permissions.createJob) return <NoAccess what="adding jobs" />;
	return <JobForm isAdmin={!!me.data?.roles.includes('admin')} />;
}
