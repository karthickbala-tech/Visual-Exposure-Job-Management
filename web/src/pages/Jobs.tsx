import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useCreateJob, useJobs, useMe } from '../api/queries';
import { num } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';

const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];

export function Jobs() {
	const [params, setParams] = useSearchParams();
	const text = params.get('q') ?? '';
	const [stage, setStage] = useState('');
	const jobs = useJobs(stage || undefined);
	const me = useMe();
	const create = useCreateJob();
	const navigate = useNavigate();
	const { notify } = useToast();
	const [name, setName] = useState('');
	const [open, setOpen] = useState(false);

	const needle = text.trim().toLowerCase();
	const shown = (jobs.data?.items ?? []).filter((j) => !needle || j.name.toLowerCase().includes(needle) || (j.crm_deal_id ?? '').toLowerCase().includes(needle));

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		create.mutate(
			{ name: name.trim() },
			{
				onSuccess: (job) => {
					notify('Job created');
					navigate('/jobs/' + job.ROWID);
				},
			},
		);
	};

	return (
		<>
			<PageHeader eyebrow="Projects" title="Jobs" subtitle="Every job from deal to finished install.">
				{me.data?.permissions.createJob && !open && (
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> New job
					</button>
				)}
			</PageHeader>

			<Card flush>
				{open && (
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

				<div className="inline-form" role="group" aria-label="Filter jobs">
					<label className="search" style={{ flex: '1 1 240px' }}>
						<Search size={16} aria-hidden="true" />
						<input
							type="search"
							value={text}
							onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
							placeholder="Filter by name or deal"
							aria-label="Filter jobs"
						/>
					</label>
					<label style={{ flex: '0 1 200px' }}>
						<span className="toolbar__label">Stage</span>
						<select value={stage} onChange={(e) => setStage(e.target.value)} style={{ width: '100%' }}>
							<option value="">All stages</option>
							{STAGES.map((s) => (
								<option key={s}>{s}</option>
							))}
						</select>
					</label>
				</div>

				{jobs.isPending && <p role="status" className="table-empty">Loading jobs...</p>}
				{jobs.isError && (
					<p role="alert">
						Could not load jobs.{' '}
						<button className="btn btn-ghost btn-sm" onClick={() => jobs.refetch()}>
							Try again
						</button>
					</p>
				)}
				{jobs.isSuccess && shown.length === 0 && <p className="table-empty">{needle ? 'No jobs match that search.' : 'No jobs to show.'}</p>}

				{jobs.isSuccess && shown.length > 0 && (
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
								{shown.map((j) => (
									<tr key={j.ROWID}>
										<td data-label="Job" className="cell-primary">
											<Link to={`/jobs/${j.ROWID}`}>{j.name}</Link>
										</td>
										<td data-label="Stage">
											<Chip status={j.stage} />
										</td>
										<td data-label="Progress">
											<Progress label="Job" value={num(j.percent_job)} single />
										</td>
										<td data-label="Expected finish">{j.expected_finish || '-'}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
