import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { useMe, useStartChecklist, useTask, useTaskChecklists, useTransitionTask } from '../api/queries';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader, fmtDate } from '../components/ui';
import { FilesPanel } from './FilesPanel';
import { SwmsPanel } from './SwmsPanel';
import { HoursPanel, ManagePanel, RatingPanel, StageActions } from './TaskManage';
import { TaskDetailsPanel } from '../components/TaskDetailsPanel';
import { TaskHistory } from '../components/TaskHistory';
import { NextStepCard } from '../components/CrewCards';

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];

const PHASE_LABEL = { pre: 'Pre-job checklist', post: 'Post-job checklist' } as const;
const TYPE_LABEL: Record<string, string> = { design: 'Design task', fabrication: 'Fabrication task', install: 'Install task' };

export function TaskDetail() {
	const { id } = useParams();
	const navigate = useNavigate();
	const me = useMe();
	const q = useTask(id);
	const lists = useTaskChecklists(id);
	const start = useStartChecklist(id ?? '');
	const move = useTransitionTask(q.data?.task.job_id ?? '');
	const { notify } = useToast();

	if (q.isPending) return <p role="status">Loading task…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Task not found</h1>;
	if (q.isError) return <p role="alert">Could not load this task.</p>;

	const { task, assignees, nextStages } = q.data;
	const myId = me.data?.person ? String(me.data.person.ROWID) : null;
	const iAmAssigned = !!myId && assignees.some((a) => a.personId === myId);
	const mine = (lists.data?.items ?? []).filter((c) => c.assigneeId === myId);
	const others = (lists.data?.items ?? []).filter((c) => c.assigneeId !== myId);
	const existing = (phase: 'pre' | 'post') => mine.find((c) => c.phase === phase);

	const open = (phase: 'pre' | 'post') => start.mutate(phase, { onSuccess: (view) => navigate('/checklists/' + view.checklist.id) });

	return (
		<>
			<Link className="back-link" to={'/jobs/' + task.job_id}>
				<ArrowLeft size={16} aria-hidden="true" /> Back to job
			</Link>

			<PageHeader eyebrow={TYPE_LABEL[task.task_type] ?? 'Task'} title={task.name}>
				<Chip status={task.stage} />
			</PageHeader>
			{task.description && <p className="lead">{task.description}</p>}

			{iAmAssigned && !DONE.includes(task.stage) && <NextStepCard taskId={task.ROWID} />}

			<Card title="Details">
				<dl className="facts">
					<div className="fact">
						<dt>Quoted hours</dt>
						<dd className="num">{num(task.quoted_hours)}</dd>
					</div>
					<div className="fact">
						<dt>Booked hours</dt>
						<dd className="num">{num(task.booked_hours)}</dd>
					</div>
					<div className="fact">
						<dt>Scheduled</dt>
						<dd>{fmtDate(task.scheduled_date)}</dd>
					</div>
					<div className="fact">
						<dt>Team</dt>
						<dd>{assignees.length ? assignees.map((a) => `${a.name ?? 'Unknown'} (${a.role})`).join(', ') : 'Nobody assigned yet'}</dd>
					</div>
				</dl>
			</Card>

			{nextStages.length > 0 && <StageActions taskId={task.ROWID} stage={task.stage} nextStages={nextStages} move={move} onDone={(to) => notify(`Moved to ${to}`)} />}

			{me.data?.permissions.assignPeople && !DONE.includes(task.stage) && (
				<ManagePanel taskId={task.ROWID} scheduled={task.scheduled_date} finish={task.required_finish} quoted={num(task.quoted_hours)} assignees={assignees} canSubtask={task.task_type === 'fabrication' || task.task_type === 'install'} />
			)}

			{me.data?.permissions.assignPeople && !DONE.includes(task.stage) && (
				<TaskDetailsPanel key={task.ROWID + (task.kind ?? '')} taskId={task.ROWID} type={task.task_type} name={task.name} kind={task.kind} description={task.description} proposedHours={task.proposed_hours} spec={task.spec} started={['In Progress', 'Manager Review'].includes(task.stage)} />
			)}

			<TaskHistory taskId={task.ROWID} />

			{task.swms_id && <SwmsPanel swmsId={String(task.swms_id)} roles={me.data?.roles ?? []} myPersonId={myId} assignees={assignees} />}

			<Card title="Checklists">
				{iAmAssigned ? (
					<div className="actions">
						{(['pre', 'post'] as const).map((p) => {
							const c = existing(p);
							return c ? (
								<Link key={p} className="btn" to={'/checklists/' + c.id}>
									<ClipboardCheck size={16} aria-hidden="true" /> {c.status === 'Completed' ? 'View' : 'Continue'} {PHASE_LABEL[p].toLowerCase()}
								</Link>
							) : (
								<button key={p} className="btn" disabled={start.isPending} onClick={() => open(p)}>
									Start {PHASE_LABEL[p].toLowerCase()}
								</button>
							);
						})}
					</div>
				) : (
					<p className="muted">Only people assigned to this task fill in its checklists.</p>
				)}
				{start.isError && (
					<p role="alert" style={{ marginTop: 12 }}>
						{start.error.message}
					</p>
				)}

				{others.length > 0 && (
					<ul className="plain-list" style={{ marginTop: 16 }}>
						{others.map((c) => (
							<li key={c.id}>
								<Link className="row-link" to={'/checklists/' + c.id}>
									{PHASE_LABEL[c.phase]} ({c.role})
								</Link>{' '}
								<Chip status={c.status} />
							</li>
						))}
					</ul>
				)}
			</Card>

			{(iAmAssigned || me.data?.permissions.assignPeople) && task.task_type !== 'design' && !DONE.includes(task.stage) && (
				<HoursPanel taskId={task.ROWID} assignees={assignees} isManager={!!me.data?.permissions.assignPeople} />
			)}
			{me.data?.permissions.assignPeople && ['Completed', 'Approved & Completed'].includes(task.stage) && <RatingPanel taskId={task.ROWID} assignees={assignees} />}

			<FilesPanel entityType="task" entityId={task.ROWID} canUpload={iAmAssigned} />
		</>
	);
}
