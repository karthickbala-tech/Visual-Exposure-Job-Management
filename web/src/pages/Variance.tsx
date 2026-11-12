import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFabVariance } from '../api/queries';
import { Chip } from '../components/Chip';
import { Card, PageHeader } from '../components/ui';

/** Positive = over the quoted hours. */
const signed = (n: number) => (n > 0 ? '+' + n : String(n));
const tone = (n: number) => (n > 0 ? 'var(--danger, #c0392b)' : undefined);

/** Fabrication tasks: booked hours against quoted hours, with a total per job. The server limits it to the tasks you may see. */
export function Variance() {
	const q = useFabVariance();
	/** The job whose tasks are listed below, or null for every task. Filtered in the browser, no extra request. */
	const [jobId, setJobId] = useState<string | null>(null);
	const jobName = jobId ? (q.data?.jobs.find((j) => j.job_id === jobId)?.job_name || 'Job ' + jobId) : null;
	const tasks = q.isSuccess ? (jobId ? q.data.items.filter((t) => t.job_id === jobId) : q.data.items) : [];

	return (
		<>
			<PageHeader eyebrow="Reports" title="Fabrication variance" subtitle="Booked hours against quoted hours. Positive means over the quote." />

			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert">Could not load the variance report.</p>}

			{q.isSuccess && q.data.items.length === 0 && (
				<Card>
					<p className="table-empty">No fabrication tasks have quoted or booked hours yet.</p>
				</Card>
			)}

			{q.isSuccess && q.data.items.length > 0 && (
				<>
					<Card flush>
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">Variance by job</caption>
								<thead>
									<tr><th scope="col">Job</th><th scope="col">Quoted</th><th scope="col">Booked</th><th scope="col">Variance</th><th scope="col"><span className="sr-only">Tasks</span></th></tr>
								</thead>
								<tbody>
									{q.data.jobs.map((j) => (
										<tr key={j.job_id}>
											<td data-label="Job" className="cell-primary"><Link to={'/jobs/' + j.job_id}>{j.job_name || 'Job ' + j.job_id}</Link></td>
											<td data-label="Quoted" className="num">{j.quoted}</td>
											<td data-label="Booked" className="num">{j.booked}</td>
											<td data-label="Variance" className="num" style={{ color: tone(j.variance) }}>{signed(j.variance)}</td>
											<td data-label="Tasks">
												<button
													type="button"
													className={'btn btn-ghost btn-sm' + (jobId === j.job_id ? ' on' : '')}
													aria-pressed={jobId === j.job_id}
													onClick={() => setJobId(jobId === j.job_id ? null : j.job_id)}
												>
													{jobId === j.job_id ? 'Hide tasks' : 'Show tasks'}
												</button>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Card>

					<Card
						flush
						title={jobName ? 'Tasks for ' + jobName : 'Tasks, all jobs'}
						action={jobId ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setJobId(null)}>Show all tasks</button> : undefined}
					>
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">{jobName ? `Variance by task for ${jobName}` : 'Variance by task'}</caption>
								<thead>
									<tr><th scope="col">Task</th><th scope="col">Job</th><th scope="col">Stage</th><th scope="col">Quoted</th><th scope="col">Booked</th><th scope="col">Variance</th></tr>
								</thead>
								<tbody>
									{tasks.map((t) => (
										<tr key={t.ROWID}>
											<td data-label="Task" className="cell-primary"><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></td>
											<td data-label="Job">{t.job_name || '-'}</td>
											<td data-label="Stage"><Chip status={t.stage} /></td>
											<td data-label="Quoted" className="num">{t.quoted}</td>
											<td data-label="Booked" className="num">{t.booked}</td>
											<td data-label="Variance" className="num" style={{ color: tone(t.variance) }}>{signed(t.variance)}</td>
										</tr>
									))}
									{tasks.length === 0 && (
										<tr><td colSpan={6} className="table-empty">No tasks for this job.</td></tr>
									)}
								</tbody>
							</table>
						</div>
					</Card>
					{q.data.capped && <p className="table-empty">Showing the 300 most recently changed fabrication tasks.</p>}
				</>
			)}
		</>
	);
}
