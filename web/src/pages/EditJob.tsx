import { useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useJob, useMe } from '../api/queries';
import { JobForm } from '../components/JobForm';

/** Edit a job on its own page, with the same form as adding one. */
export function EditJob() {
	const { id } = useParams();
	const q = useJob(id);
	const me = useMe();
	if (q.isPending || me.isPending) return <p role="status">Loading job…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Job not found</h1>;
	if (q.isError) return <p role="alert">Could not load this job.</p>;
	if (!me.data?.permissions.editJob) return <p className="table-empty">You do not have access to edit jobs.</p>;
	return <JobForm key={q.data.job.ROWID} job={q.data.job} isAdmin={me.data.roles.includes('admin')} />;
}
