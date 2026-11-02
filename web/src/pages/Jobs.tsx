import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateJob, useJobs, useMe } from '../api/queries';
import { num } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import './Table.css';

const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];

export function Jobs() {
	const [stage, setStage] = useState('');
	const jobs = useJobs(stage || undefined);
	const me = useMe();
	const create = useCreateJob();
	const navigate = useNavigate();
	const [name, setName] = useState('');
	const [open, setOpen] = useState(false);

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		create.mutate({ name: name.trim() }, { onSuccess: (job) => navigate('/jobs/' + job.ROWID) });
	};

	return (
		<>
			<h1 className="page-title">Jobs</h1>

			{me.data?.permissions.createJob && (
				<div>
					{!open ? (
						<button className="btn" onClick={() => setOpen(true)}>
							New job
						</button>
					) : (
						<form className="inline-form" onSubmit={submit}>
							<label>
								<span className="toolbar__label">Job name</span>
								<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />
							</label>
							<button className="btn" disabled={create.isPending || !name.trim()}>
								{create.isPending ? 'Creating...' : 'Create job'}
							</button>
							<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
								Cancel
							</button>
							{create.isError && <p role="alert">{create.error.message}</p>}
						</form>
					)}
				</div>
			)}

			<div className="toolbar">
				<label>
					<span className="toolbar__label">Stage</span>
					<select value={stage} onChange={(e) => setStage(e.target.value)}>
						<option value="">All stages</option>
						{STAGES.map((s) => (
							<option key={s}>{s}</option>
						))}
					</select>
				</label>
			</div>

			{jobs.isPending && <p role="status">Loading jobs...</p>}
			{jobs.isError && (
				<p role="alert">
					Could not load jobs.{' '}
					<button className="btn btn-ghost" onClick={() => jobs.refetch()}>
						Try again
					</button>
				</p>
			)}
			{jobs.isSuccess && jobs.data.items.length === 0 && <p>No jobs to show.</p>}

			{jobs.isSuccess && jobs.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Jobs</caption>
						<thead>
							<tr>
								<th scope="col">Job</th>
								<th scope="col">Stage</th>
								<th scope="col">Progress</th>
								<th scope="col">Expected finish</th>
							</tr>
						</thead>
						<tbody>
							{jobs.data.items.map((j) => (
								<tr key={j.ROWID}>
									<td data-label="Job">
										<Link to={`/jobs/${j.ROWID}`}>{j.name}</Link>
									</td>
									<td data-label="Stage">
										<Chip status={j.stage} />
									</td>
									<td data-label="Progress">
										<Progress label="Job" value={num(j.percent_job)} />
									</td>
									<td data-label="Expected finish">{j.expected_finish || '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}
