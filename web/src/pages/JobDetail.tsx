import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useJob, useMe, useTransitionTask } from '../api/queries';
import { AddTaskForm } from '../components/AddTaskForm';
import { EditJobForm } from '../components/EditJobForm';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, Kpi, Ring, fmtDate } from '../components/ui';
import { useCloseJob } from '../api/more';
import { SignsPanel } from './SignsPanel';
import { QuotesPanel } from './QuotesPanel';

const TYPE_LABEL = { design: 'Design', fabrication: 'Fabrication', install: 'Install' } as const;
const TYPES = ['design', 'fabrication', 'install'] as const;

export function JobDetail() {
	const { id } = useParams();
	const q = useJob(id);
	const me = useMe();
	const move = useTransitionTask(id ?? '');
	const close = useCloseJob(id ?? '');
	const { notify } = useToast();
	const [adding, setAdding] = useState(false);
	const [editing, setEditing] = useState(false);

	if (q.isPending) return <p role="status">Loading job…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) {
		return (
			<>
				<Link className="back-link" to="/jobs">
					<ArrowLeft size={16} aria-hidden="true" /> All jobs
				</Link>
				<h1 className="page-title">Job not found</h1>
			</>
		);
	}
	if (q.isError) return <p role="alert">Could not load this job.</p>;

	const { job, tasks, progress } = q.data;
	const kpis = (q.data as { kpis?: Record<string, { total: number; open: number; overdue: number; percent: number }> }).kpis;
	const canClose = me.data?.permissions.editJob && job.stage === 'Completed';
	const inReview = tasks.filter((t) => t.stage === 'Manager Review');
	const groups = TYPES.map((t) => ({ type: t, rows: tasks.filter((x) => x.task_type === t) })).filter((g) => g.rows.length > 0);

	return (
		<>
			<Link className="back-link" to="/jobs">
				<ArrowLeft size={16} aria-hidden="true" /> All jobs
			</Link>

			<Card flush>
				<div className="job-head">
					<div className="job-head-main">
						<p className="eyebrow">{job.crm_deal_id ? `Deal ${job.crm_deal_id}` : 'Job'}</p>
						<h1>{job.name}</h1>
						<div className="job-meta">
							<Chip status={job.stage} />
							{job.expected_finish && <span>Expected finish {fmtDate(job.expected_finish)}</span>}
						</div>
						{job.description && <p className="lead" style={{ marginTop: 12 }}>{job.description}</p>}
					</div>
					<Ring value={progress.job} label="Job progress" />
					{me.data?.permissions.editJob && !editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /> Edit job</button>}
					{canClose && (
						<button className="btn" disabled={close.isPending} onClick={() => !(inReview.length && !window.confirm(`${inReview.length} ${inReview.length === 1 ? 'task is' : 'tasks are'} still in Manager Review. Closing will not wait for approval. Close the job anyway?`)) && close.mutate(undefined, { onSuccess: () => notify('Job closed'), onError: (e) => notify(e instanceof Error ? e.message : 'Could not close the job', 'error') })}>
							{close.isPending ? 'Closing…' : 'Close job'}
						</button>
					)}
				</div>
				{editing && <EditJobForm job={job} isAdmin={!!me.data?.roles.includes('admin')} onClose={() => setEditing(false)} />}
			</Card>

			{me.data?.permissions.editJob && inReview.length > 0 && (
				<div className="attention" role="status">
					<strong className="num">{inReview.length}</strong> {inReview.length === 1 ? 'task is' : 'tasks are'} waiting for your approval.
					{inReview.slice(0, 3).map((t) => <Link key={t.ROWID} to={'/tasks/' + t.ROWID}>Review {t.name}</Link>)}
				</div>
			)}

			{kpis && (
				<section className="kpis" aria-label="Tasks by discipline">
					{(['design', 'fabrication', 'install'] as const).map((t) => (
						<Kpi key={t} label={`${TYPE_LABEL[t]} tasks`} value={`${kpis[t]?.open ?? 0} open`} tone={kpis[t]?.overdue ? 'danger' : undefined} note={`${kpis[t]?.total ?? 0} total, ${kpis[t]?.overdue ?? 0} overdue, ${kpis[t]?.percent ?? 0}% done`} />
					))}
				</section>
			)}

			<Card title="Progress">
				<div className="stack" style={{ gap: 10, maxWidth: 520 }}>
					<Progress label="Fab" value={progress.fab} />
					<Progress label="Install" value={progress.install} />
					<Progress label="Job" value={progress.job} />
				</div>
			</Card>

			{move.isError && <p role="alert">{move.error.message}</p>}

			{me.data?.permissions.createTask && (
				<Card
					title="Tasks"
					action={
						!adding && (
							<button className="btn btn-sm" onClick={() => setAdding(true)}>
								<Plus size={14} aria-hidden="true" /> Add task
							</button>
						)
					}
					flush
				>
					{adding && <AddTaskForm jobId={id ?? ''} onClose={() => setAdding(false)} />}
					{tasks.length === 0 && !adding && <p className="table-empty">This job has no tasks yet.</p>}
				</Card>
			)}
			{tasks.length === 0 && !me.data?.permissions.createTask && <p>This job has no tasks yet.</p>}

			{groups.map((g) => (
				<Card key={g.type} title={TYPE_LABEL[g.type]} flush>
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">{TYPE_LABEL[g.type]} tasks</caption>
							<thead>
								<tr>
									<th scope="col">Task</th>
									<th scope="col">Stage</th>
									<th scope="col">Quoted hrs</th>
									<th scope="col">Scheduled</th>
									<th scope="col">Actions</th>
								</tr>
							</thead>
							<tbody>
								{g.rows.map((t) => (
									<tr key={t.ROWID}>
										<td data-label="Task" className="cell-primary">
											<Link to={'/tasks/' + t.ROWID}>{t.name}</Link>
										</td>
										<td data-label="Stage">
											<Chip status={t.stage} />
										</td>
										<td data-label="Quoted hrs" className="num">
											{num(t.quoted_hours)}
										</td>
										<td data-label="Scheduled">{fmtDate(t.scheduled_date)}</td>
										<td data-label="Actions">
											<div className="actions">
												{(t.nextStages ?? []).map((s) => (
													<button
														key={s}
														className="btn btn-ghost btn-sm"
														disabled={move.isPending}
														onClick={() => move.mutate({ taskId: t.ROWID, to: s }, { onSuccess: () => notify(`Moved to ${s}`) })}
													>
														{s}
													</button>
												))}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			))}
			<QuotesPanel jobId={id ?? ''} hasDeal={!!job.crm_deal_id} canSync={!!me.data?.permissions.createTask} />
			<SignsPanel jobId={id ?? ''} canWrite={!!me.data?.permissions.createTask} />
		</>
	);
}
