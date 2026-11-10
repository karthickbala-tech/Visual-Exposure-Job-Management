import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePeople } from '../api/queries';
import { useAddTime, useAssign, useRate, useUnassign, useUpdateTask } from '../api/more';
import { AddSubtaskDialog } from '../components/AddSubtaskDialog';
import type { Assignee } from '../api/types';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';
import { Dialog } from '../components/Dialog';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const today = () => new Date().toISOString().slice(0, 10);
const ROLES = ['lead', 'member', 'other'];
const bare = { background: 'transparent', border: 0, padding: 0 } as const;

/** Managers: schedule, change the crew, add a subtask. The server checks every one of these again. */
export function ManagePanel({ taskId, scheduled, finish, quoted, assignees, canSubtask }: { taskId: string; scheduled?: string; finish?: string; quoted: number; assignees: Assignee[]; canSubtask: boolean }) {
	const update = useUpdateTask(taskId);
	const assign = useAssign(taskId);
	const unassign = useUnassign(taskId);
	const people = usePeople(true);
	const { notify } = useToast();
	const [dates, setDates] = useState({ scheduled_date: scheduled?.slice(0, 10) ?? '', required_finish: finish?.slice(0, 10) ?? '', quoted_hours: String(quoted || '') });
	const [person, setPerson] = useState('');
	const [role, setRole] = useState('member');
	const [addingCrew, setAddingCrew] = useState(false);
	const [addingSub, setAddingSub] = useState(false);
	const free = (people.data?.items ?? []).filter((p) => !assignees.some((a) => a.personId === p.ROWID) && p.is_active !== false);

	return (
		<Card title="Manage this task">
			<div className="stack">
				<form
					className="inline-form"
					style={bare}
					onSubmit={(e) => {
						e.preventDefault();
						const body: Record<string, unknown> = {};
						if (dates.scheduled_date) body.scheduled_date = dates.scheduled_date;
						if (dates.required_finish) body.required_finish = dates.required_finish;
						if (dates.quoted_hours) body.quoted_hours = Number(dates.quoted_hours);
						update.mutate(body, { onSuccess: () => notify('Task saved'), onError: (er) => notify(errText(er), 'error') });
					}}
				>
					<label><span className="toolbar__label">Scheduled</span><input type="date" value={dates.scheduled_date} onChange={(e) => setDates({ ...dates, scheduled_date: e.target.value })} /></label>
					<label><span className="toolbar__label">Required finish</span><input type="date" value={dates.required_finish} onChange={(e) => setDates({ ...dates, required_finish: e.target.value })} /></label>
					<label><span className="toolbar__label">Quoted hours</span><input type="number" min={0} step={0.25} inputMode="decimal" value={dates.quoted_hours} onChange={(e) => setDates({ ...dates, quoted_hours: e.target.value })} /></label>
					<button className="btn" disabled={update.isPending}>{update.isPending ? 'Saving…' : 'Save'}</button>
				</form>

				<div>
					<h3 className="group-title">Crew</h3>
					{assignees.length === 0 && <p className="muted">Nobody assigned yet.</p>}
					<ul className="plain-list" style={{ margin: '8px 0 12px' }}>
						{assignees.map((a) => (
							<li key={a.linkId} className="actions" style={{ alignItems: 'center' }}>
								<strong>{a.name ?? 'Unknown'}</strong> <span className="muted" style={{ textTransform: 'capitalize' }}>{a.role}</span>
								<button
									className="btn btn-ghost btn-sm"
									aria-label={`Remove ${a.name ?? 'person'} from this task`}
									disabled={unassign.isPending}
									onClick={() => {
										if (window.confirm(`Remove ${a.name ?? 'this person'} from the task? Their unfinished checklists are cleared.`)) {
											unassign.mutate(a.personId, { onSuccess: () => notify('Removed from the task'), onError: (er) => notify(errText(er), 'error') });
										}
									}}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							</li>
						))}
					</ul>
					<button className="btn btn-ghost btn-sm" onClick={() => setAddingCrew(true)}>Add a person</button>
					{addingCrew && (
					<Dialog title="Add a person to the crew" onClose={() => setAddingCrew(false)}>
					<form
						className="inline-form"
						style={bare}
						onSubmit={(e) => {
							e.preventDefault();
							assign.mutate({ person_id: person, role }, { onSuccess: () => { setPerson(''); notify('Added to the task'); }, onError: (er) => notify(errText(er), 'error') });
						}}
					>
						<label>
							<span className="toolbar__label">Add a person</span>
							<select value={person} onChange={(e) => setPerson(e.target.value)} required>
								<option value="">Choose…</option>
								{free.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
							</select>
						</label>
						<label style={{ flex: '0 1 150px' }}>
							<span className="toolbar__label">Role</span>
							<select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
						</label>
						<button className="btn" disabled={assign.isPending || !person}>Add</button>
					</form>
					</Dialog>
					)}
				</div>

				{canSubtask && (
					<>
					<button className="btn btn-ghost" onClick={() => setAddingSub(true)}>Add subtask</button>
					{addingSub && <AddSubtaskDialog taskId={taskId} onClose={() => setAddingSub(false)} />}
					</>
				)}
			</div>
		</Card>
	);
}

/** Book hours on a task by hand (the post-job checklist also books them). A manager can book for someone else. */
export function HoursPanel({ taskId, assignees, isManager }: { taskId: string; assignees: Assignee[]; isManager: boolean }) {
	const add = useAddTime(taskId);
	const { notify } = useToast();
	const [f, setF] = useState({ work_date: today(), hours: '', unbilled: '', person_id: '' });
	return (
		<Card title="Book hours">
			<form
				className="inline-form"
				style={bare}
				onSubmit={(e) => {
					e.preventDefault();
					add.mutate(
						{ work_date: f.work_date, hours: Number(f.hours), unbilled_hours: f.unbilled ? Number(f.unbilled) : undefined, person_id: f.person_id || undefined },
						{ onSuccess: () => { setF({ ...f, hours: '', unbilled: '' }); notify('Hours booked'); }, onError: (er) => notify(errText(er), 'error') },
					);
				}}
			>
				<label><span className="toolbar__label">Date</span><input type="date" value={f.work_date} max={today()} required onChange={(e) => setF({ ...f, work_date: e.target.value })} /></label>
				<label><span className="toolbar__label">Hours</span><input type="number" min={0.25} max={16} step={0.25} inputMode="decimal" required value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
				<label><span className="toolbar__label">Unbilled hours</span><input type="number" min={0} max={16} step={0.25} inputMode="decimal" value={f.unbilled} onChange={(e) => setF({ ...f, unbilled: e.target.value })} /></label>
				{isManager && (
					<label>
						<span className="toolbar__label">For</span>
						<select value={f.person_id} onChange={(e) => setF({ ...f, person_id: e.target.value })}>
							<option value="">Me</option>
							{assignees.map((a) => <option key={a.personId} value={a.personId}>{a.name ?? a.personId}</option>)}
						</select>
					</label>
				)}
				<button className="btn" disabled={add.isPending || !f.hours}>{add.isPending ? 'Saving…' : 'Book hours'}</button>
			</form>
			<p className="muted" style={{ marginTop: 8 }}>More than 14 hours in a day gives a warning; more than 16 is refused.</p>
		</Card>
	);
}

/** Managers rate each crew member 1 to 5 once the work is done. */
export function RatingPanel({ taskId, assignees }: { taskId: string; assignees: Assignee[] }) {
	const rate = useRate(taskId);
	const { notify } = useToast();
	const [picked, setPicked] = useState<Record<string, number>>({});
	if (assignees.length === 0) return null;
	return (
		<Card title="Rate the crew">
			<ul className="plain-list">
				{assignees.map((a) => (
					<li key={a.personId} className="actions" style={{ alignItems: 'center' }}>
						<strong style={{ minWidth: 160 }}>{a.name ?? 'Unknown'}</strong>
						<div className="segmented" role="group" aria-label={`Rating for ${a.name ?? 'person'}`}>
							{[1, 2, 3, 4, 5].map((n) => (
								<button key={n} className={picked[a.personId] === n ? 'on' : ''} aria-pressed={picked[a.personId] === n} onClick={() => setPicked({ ...picked, [a.personId]: n })}>{n}</button>
							))}
						</div>
						<button
							className="btn btn-ghost btn-sm"
							disabled={!picked[a.personId] || rate.isPending}
							onClick={() => rate.mutate({ person_id: a.personId, rating: picked[a.personId] }, { onSuccess: () => notify('Rating saved'), onError: (er) => notify(errText(er), 'error') })}
						>
							Save
						</button>
					</li>
				))}
			</ul>
		</Card>
	);
}

const APPROVE_TO = ['Completed', 'Approved & Completed'];
const NEEDS_COMMENT = ['Rejected', 'Reopen'];
type Mover = ReturnType<typeof import('../api/queries').useTransitionTask>;

/**
 * Move a task to its next stage. Approving from Manager Review asks the PM-review questions (OH&S incident, needs management review);
 * sending back or reopening needs a reason. Everything else is one click. The server checks each move again.
 */
export function StageActions({ taskId, stage, nextStages, move, onDone }: { taskId: string; stage: string; nextStages: string[]; move: Mover; onDone: (to: string) => void }) {
	const [ask, setAsk] = useState<string | null>(null);
	const [comment, setComment] = useState('');
	const [ohs, setOhs] = useState<'Yes' | 'No'>('No');
	const [review, setReview] = useState(false);
	const { notify } = useToast();
	const approving = !!ask && stage === 'Manager Review' && APPROVE_TO.includes(ask);
	const go = (to: string, extra: { comment?: string; ohs?: 'Yes' | 'No'; management_review?: boolean } = {}) =>
		move.mutate({ taskId, to, ...extra }, { onSuccess: () => { setAsk(null); setComment(''); onDone(to); }, onError: (e) => notify(errText(e), 'error') });

	return (
		<Card title="Move this task">
			<div className="actions">
				{nextStages.map((s) => (
					<button key={s} className={'btn ' + (APPROVE_TO.includes(s) && stage === 'Manager Review' ? '' : 'btn-ghost')} aria-pressed={ask === s} disabled={move.isPending} onClick={() => (NEEDS_COMMENT.includes(s) || (stage === 'Manager Review' && APPROVE_TO.includes(s)) ? setAsk(ask === s ? null : s) : go(s))}>
						{stage === 'Manager Review' && APPROVE_TO.includes(s) ? 'Approve' : s}
					</button>
				))}
			</div>
			{ask && (
				<form
					className="stage-form"
					onSubmit={(e) => {
						e.preventDefault();
						go(ask, approving ? { comment: comment.trim() || undefined, ohs, management_review: review } : { comment: comment.trim() });
					}}
				>
					{approving && (
						<>
							<fieldset className="q">
								<legend className="q__label">Was there an OH&amp;S incident or concern on this task?</legend>
								<div className="q__choices">
									{(['No', 'Yes'] as const).map((v) => (
										<label key={v} className={'q__choice' + (ohs === v ? ' q__choice--on' : '')}>
											<input type="radio" name="ohs" checked={ohs === v} onChange={() => setOhs(v)} /> {v}
										</label>
									))}
								</div>
							</fieldset>
							<label className="check"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> Needs a management review</label>
						</>
					)}
					<label>
						<span className="toolbar__label">{approving ? 'Comment (optional)' : NEEDS_COMMENT.includes(ask) ? `Why? (needed to ${ask === 'Rejected' ? 'send it back' : 'reopen'})` : 'Comment'}</span>
						<textarea rows={2} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} required={NEEDS_COMMENT.includes(ask)} />
					</label>
					<div className="actions">
						<button className="btn" disabled={move.isPending}>{move.isPending ? 'Saving…' : approving ? 'Approve task' : `Confirm: ${ask}`}</button>
						<button type="button" className="btn btn-ghost" onClick={() => setAsk(null)}>Cancel</button>
					</div>
				</form>
			)}
			{move.isError && !ask && <p role="alert" style={{ marginTop: 12 }}>{move.error.message}</p>}
		</Card>
	);
}
