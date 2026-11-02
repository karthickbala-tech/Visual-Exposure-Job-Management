import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMe, useStartChecklist, useTask, useTaskChecklists, useTransitionTask } from '../api/queries';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import { Chip } from '../components/Chip';
import { SwmsPanel } from './SwmsPanel';
import { FilesPanel } from './FilesPanel';
import './Table.css';
import './Checklist.css';

const PHASE_LABEL = { pre: 'Pre-job checklist', post: 'Post-job checklist' } as const;

export function TaskDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const me = useMe();
	const q = useTask(id);
	const lists = useTaskChecklists(id);
	const start = useStartChecklist(id ?? '');
	const move = useTransitionTask(q.data?.task.job_id ?? '');

	if (q.isPending) return <p role="status">Loading task...</p>;
	if (q.error instanceof ApiError && q.error.status === 404) {
		return <h1 className="page-title">Task not found</h1>;
	}
	if (q.isError) return <p role="alert">Could not load this task.</p>;

	const { task, assignees, nextStages } = q.data;
	const myId = me.data?.person ? String(me.data.person.ROWID) : null;
	const iAmAssigned = !!myId && assignees.some((a) => a.personId === myId);
	const mine = (lists.data?.items ?? []).filter((c) => c.assigneeId === myId);
	const others = (lists.data?.items ?? []).filter((c) => c.assigneeId !== myId);
	const hasOpen = (phase: 'pre' | 'post') => mine.find((c) => c.phase === phase);

	const open = (phase: 'pre' | 'post') =>
		start.mutate(phase, { onSuccess: (view) => navigate('/checklists/' + view.checklist.id) });

	return (
		<>
			<p>
				<Link to={'/jobs/' + task.job_id}>&larr; Back to job</Link>
			</p>
			<h1 className="page-title">{task.name}</h1>
			<p>
				<Chip status={task.stage} />
			</p>
			{task.description && <p className="lead">{task.description}</p>}

			<section className="panel" aria-label="Task facts">
				<div>Type: {task.task_type}</div>
				<div>Quoted hours: {num(task.quoted_hours)}</div>
				<div>Booked hours: {num(task.booked_hours)}</div>
				<div>Scheduled: {task.scheduled_date || '-'}</div>
				<div>Team: {assignees.length ? assignees.map((a) => `${a.name ?? 'Unknown'} (${a.role})`).join(', ') : 'Nobody assigned yet'}</div>
			</section>

			{nextStages.length > 0 && (
				<div className="actions" aria-label="Move this task">
					{nextStages.map((s) => (
						<button key={s} className="btn btn-ghost" disabled={move.isPending} onClick={() => move.mutate({ taskId: task.ROWID, to: s })}>
							{s}
						</button>
					))}
				</div>
			)}
			{move.isError && <p role="alert">{move.error.message}</p>}

			{task.swms_id && <SwmsPanel swmsId={String(task.swms_id)} roles={me.data?.roles ?? []} myPersonId={myId} assignees={assignees} />}

			<FilesPanel entityType="task" entityId={task.ROWID} canUpload={iAmAssigned} />

			<h2 className="group__title">Checklists</h2>
			{iAmAssigned && (
				<div className="actions">
					{(['pre', 'post'] as const).map((p) => {
						const existing = hasOpen(p);
						return existing ? (
							<Link key={p} className="btn btn-primary" to={'/checklists/' + existing.id}>
								{existing.status === 'Completed' ? 'View ' : 'Continue '}
								{PHASE_LABEL[p].toLowerCase()}
							</Link>
						) : (
							<button key={p} className="btn btn-primary" disabled={start.isPending} onClick={() => open(p)}>
								Start {PHASE_LABEL[p].toLowerCase()}
							</button>
						);
					})}
				</div>
			)}
			{start.isError && <p role="alert">{start.error.message}</p>}
			{!iAmAssigned && <p>Only people assigned to this task fill in its checklists.</p>}

			{others.length > 0 && (
				<ul className="plain-list">
					{others.map((c) => (
						<li key={c.id}>
							<Link to={'/checklists/' + c.id}>
								{PHASE_LABEL[c.phase]} ({c.role})
							</Link>{' '}
							<Chip status={c.status} />
						</li>
					))}
				</ul>
			)}
		</>
	);
}
