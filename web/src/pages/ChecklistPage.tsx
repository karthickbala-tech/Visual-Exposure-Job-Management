import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useChecklist, useCompleteChecklist, useSaveAnswers } from '../api/queries';
import type { ShiftInput } from '../api/queries';
import { ApiError } from '../api/client';
import type { ChecklistView, Question } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import './Table.css';
import './Checklist.css';

const today = () => new Date().toISOString().slice(0, 10);

/** One question, sized for a thumb. Saves as soon as the answer changes. */
function Field({ q, value, disabled, onChange }: { q: Question; value: string | number | undefined; disabled: boolean; onChange: (v: string | number | null) => void }) {
	const label = (
		<span className="q__label">
			{q.label}
			{q.required && <span aria-hidden="true"> *</span>}
		</span>
	);

	if (q.type === 'yesno') {
		return (
			<fieldset className="q" disabled={disabled}>
				<legend>{label}</legend>
				<div className="q__choices">
					{(['yes', 'no'] as const).map((v) => (
						<label key={v} className={'q__choice' + (value === v ? ' q__choice--on' : '')}>
							<input type="radio" name={q.key} checked={value === v} onChange={() => onChange(v)} />
							{v === 'yes' ? 'Yes' : 'No'}
						</label>
					))}
				</div>
			</fieldset>
		);
	}
	if (q.type === 'choice') {
		return (
			<label className="q">
				{label}
				<select value={String(value ?? '')} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
					<option value="">Choose...</option>
					{(q.options ?? []).map((o) => (
						<option key={o}>{o}</option>
					))}
				</select>
			</label>
		);
	}
	if (q.type === 'photo') {
		return (
			<div className="q">
				{label}
				<p className="q__hint">Photo upload arrives with the files phase.</p>
			</div>
		);
	}
	return (
		<label className="q">
			{label}
			<input
				type={q.type === 'number' ? 'number' : 'text'}
				defaultValue={value === undefined ? '' : String(value)}
				disabled={disabled}
				maxLength={2000}
				onBlur={(e) => {
					const raw = e.target.value.trim();
					if (String(value ?? '') === raw) return;
					onChange(raw === '' ? null : q.type === 'number' ? Number(raw) : raw);
				}}
			/>
		</label>
	);
}

function ShiftForm({ taskBusy, onSubmit, error }: { taskBusy: boolean; onSubmit: (s: ShiftInput) => void; error?: string }) {
	const [s, setS] = useState({ work_date: today(), start: '07:00', end: '15:30', break_minutes: 30, unbilled_hours: 0 });
	const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setS({ ...s, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });

	return (
		<form
			className="shift"
			onSubmit={(e) => {
				e.preventDefault();
				onSubmit(s);
			}}
		>
			<h2 className="group__title">Your hours</h2>
			<div className="shift__grid">
				<label>
					<span className="toolbar__label">Date</span>
					<input type="date" value={s.work_date} onChange={set('work_date')} required />
				</label>
				<label>
					<span className="toolbar__label">Start</span>
					<input type="time" value={s.start} onChange={set('start')} required />
				</label>
				<label>
					<span className="toolbar__label">Finish</span>
					<input type="time" value={s.end} onChange={set('end')} required />
				</label>
				<label>
					<span className="toolbar__label">Break (minutes)</span>
					<input type="number" min={0} max={600} value={s.break_minutes} onChange={set('break_minutes')} />
				</label>
				<label>
					<span className="toolbar__label">Unbilled hours</span>
					<input type="number" min={0} max={16} step={0.25} value={s.unbilled_hours} onChange={set('unbilled_hours')} />
				</label>
			</div>
			{error && <p role="alert">{error}</p>}
			<button className="btn btn-primary" disabled={taskBusy}>
				{taskBusy ? 'Saving...' : 'Complete checklist'}
			</button>
		</form>
	);
}

function Body({ data }: { data: ChecklistView }) {
	const { checklist, definition, answers, progress } = data;
	const save = useSaveAnswers(checklist.id);
	const done = useCompleteChecklist(checklist.id, checklist.taskId);
	const locked = checklist.status === 'Completed';
	const isPost = checklist.phase === 'post';

	// Hidden follow-up questions appear as soon as the answer that reveals them is saved.
	const visible = (q: Question) => !q.showIf || answers[q.showIf.key] === q.showIf.equals;

	const failMsg = (e: unknown) => (e instanceof ApiError ? e.message : e ? 'Something went wrong' : undefined);

	return (
		<>
			<p>
				<Link to={'/tasks/' + checklist.taskId}>&larr; Back to task</Link>
			</p>
			<h1 className="page-title">{isPost ? 'Post-job checklist' : 'Pre-job checklist'}</h1>
			<p>
				<Chip status={checklist.status} />
			</p>
			<div className="panel">
				<Progress label="Answered" value={progress.percent} />
			</div>

			{definition.sections.map((s) => (
				<section key={s.key} className="group">
					{s.title && <h2 className="group__title">{s.title}</h2>}
					{s.questions.filter(visible).map((q) => (
						<Field key={q.key} q={q} value={answers[q.key]} disabled={locked || save.isPending} onChange={(v) => save.mutate({ [q.key]: v })} />
					))}
				</section>
			))}

			{progress.issues.length > 0 && <p className="q__hint">Some answers will be raised as issues for the manager once issues are switched on.</p>}
			{save.isError && <p role="alert">{failMsg(save.error)}</p>}

			{!locked && isPost && (
				<ShiftForm taskBusy={done.isPending || !progress.canComplete} onSubmit={(shift) => done.mutate(shift)} error={failMsg(done.error)} />
			)}
			{!locked && !isPost && (
				<>
					{done.isError && <p role="alert">{failMsg(done.error)}</p>}
					<button className="btn btn-primary" disabled={!progress.canComplete || done.isPending} onClick={() => done.mutate({})}>
						Complete checklist
					</button>
				</>
			)}
			{!locked && !progress.canComplete && <p className="q__hint">Answer every question marked * to complete.</p>}
			{locked && isPost && <p>Hours booked: {String(checklist.hours ?? 0)}</p>}
		</>
	);
}

export function ChecklistPage() {
	const { id } = useParams();
	const q = useChecklist(id);

	if (q.isPending) return <p role="status">Loading checklist...</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Checklist not found</h1>;
	if (q.isError) return <p role="alert">Could not load this checklist.</p>;
	return <Body data={q.data} />;
}
