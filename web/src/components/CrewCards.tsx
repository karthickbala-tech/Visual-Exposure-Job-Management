import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { useAddShift, useNextStep } from '../api/more';
import { useStartChecklist } from '../api/queries';
import type { Task } from '../api/types';
import { Chip } from './Chip';
import { useToast } from './toast';
import { fmtDate } from './ui';

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const PHASE = { pre: 'pre-job checklist', post: 'post-job checklist' } as const;

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Book hours on a task without leaving the home page. Over 14 hours asks to confirm; 16 or more is refused (the server checks too). */
function BookHours({ taskId }: { taskId: string }) {
	const [open, setOpen] = useState(false);
	const [f, setF] = useState({ date: todayIso(), hours: '' });
	const add = useAddShift();
	const { notify } = useToast();
	const h = Number(f.hours);
	const problem = !f.hours ? '' : !(h >= 0.25) ? 'Enter at least 0.25 hours.' : h > 16 ? 'A shift cannot be longer than 16 hours.' : f.date > todayIso() ? 'Choose a day that has already started.' : '';
	if (!open) return <button type="button" className="btn btn-ghost btn-sm crew-book" onClick={() => setOpen(true)}>Book hours</button>;
	return (
		<form
			className="crew-book-form"
			onSubmit={(e) => {
				e.preventDefault();
				if (h > 14 && !window.confirm(`${h} hours is a very long shift. Save it anyway?`)) return;
				add.mutate({ taskId, work_date: f.date, hours: h }, { onSuccess: () => { notify('Hours booked'); setOpen(false); setF({ date: todayIso(), hours: '' }); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not book the hours', 'error') });
			}}
		>
			<input type="date" max={todayIso()} value={f.date} aria-label="Day" onChange={(e) => setF({ ...f, date: e.target.value })} required />
			<input type="number" min={0.25} max={16} step="0.25" inputMode="decimal" value={f.hours} aria-label="Hours" placeholder="Hours" onChange={(e) => setF({ ...f, hours: e.target.value })} required />
			<button className="btn btn-sm" disabled={add.isPending || !f.hours || !!problem}>{add.isPending ? 'Saving…' : 'Book'}</button>
			<button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
			{problem && <small role="alert">{problem}</small>}
		</form>
	);
}

/** Today's and coming-up tasks as big tappable cards, for people on a phone on site. */
export function CrewTasks({ tasks, today }: { tasks: Task[]; today: string }) {
	const open = tasks.filter((t) => !DONE.includes(t.stage));
	const due = open.filter((t) => t.scheduled_date && t.scheduled_date.slice(0, 10) <= today);
	const later = open.filter((t) => !due.includes(t));
	const group = (title: string, list: Task[]) =>
		list.length > 0 && (
			<section className="crew-group" aria-label={title}>
				<h2 className="group-title">{title}</h2>
				<ul className="crew-list">
					{list.map((t) => (
						<li key={t.ROWID}>
							<Link to={'/tasks/' + t.ROWID} className="crew-card">
								<span className="crew-main">
									<strong>{t.name}</strong>
									<small>{[t.kind, t.scheduled_date ? fmtDate(t.scheduled_date) : 'Not scheduled yet'].filter(Boolean).join(' · ')}</small>
								</span>
								<Chip status={t.stage} />
								<ArrowRight size={18} aria-hidden="true" />
							</Link>
							{t.stage === 'In Progress' && <BookHours taskId={t.ROWID} />}
						</li>
					))}
				</ul>
			</section>
		);
	if (open.length === 0) return <p className="table-empty">Nothing is assigned to you right now.</p>;
	return (
		<div className="stack">
			{group('Today and earlier', due)}
			{group('Coming up', later)}
		</div>
	);
}

/** The one thing a crew member should do next on a task: start or continue the right checklist. */
export function NextStepCard({ taskId }: { taskId: string }) {
	const q = useNextStep(taskId, true);
	const start = useStartChecklist(taskId);
	const navigate = useNavigate();
	const { notify } = useToast();
	if (!q.isSuccess || !q.data.action) return null;
	const s = q.data;
	if (s.action === 'done') {
		return (
			<section className="next-card next-card--done" aria-label="Your next step">
				<strong>All your checklists are done.</strong>
				<span>Thank you. Nothing else to do on this task.</span>
			</section>
		);
	}
	const label = s.action === 'start' ? `Start the ${PHASE[s.phase!]}` : `Continue the ${PHASE[s.phase!]}`;
	const go = () => {
		if (s.action === 'continue' && s.checklistId) return navigate('/checklists/' + s.checklistId);
		start.mutate(s.phase!, { onSuccess: (view) => navigate('/checklists/' + view.checklist.id), onError: (e) => notify(e instanceof Error ? e.message : 'Could not start the checklist', 'error') });
	};
	return (
		<section className="next-card" aria-label="Your next step">
			<span className="eyebrow">Your next step</span>
			<button className="btn next-btn" onClick={go} disabled={start.isPending}>
				<ClipboardCheck size={20} aria-hidden="true" /> {start.isPending ? 'Opening…' : label}
			</button>
			{s.next && <small>Next question: {s.next.label}</small>}
		</section>
	);
}
