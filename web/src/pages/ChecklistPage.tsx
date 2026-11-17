import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, FileText } from 'lucide-react';

import { getDownloadUrl, useChecklist, useCompleteChecklist, useSaveAnswers, useUploadFile } from '../api/queries';
import type { ShiftInput } from '../api/queries';
import { ApiError } from '../api/client';
import type { ChecklistView, Question } from '../api/types';
import { Chip, Progress } from '../components/Chip';
import { useToast } from '../components/toast';
import { BackLink, Card, PageHeader } from '../components/ui';
import { useConfirm } from '../components/Messages';
import { splitPayHours } from '../lib/payRules';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * A photo question (CHK-8): the photo is uploaded to this checklist and its file id saved as the answer, which the server checks
 * belongs to this checklist. On a phone the picker offers the camera.
 */
function PhotoField({ checklistId, label, value, disabled, onChange }: { checklistId: string; label: React.ReactNode; value: string | number | undefined; disabled: boolean; onChange: (v: string | null) => void }) {
	const upload = useUploadFile('checklist', checklistId);
	const input = useRef<HTMLInputElement>(null);
	const { notify } = useToast();
	const view = async () => {
		const { url } = await getDownloadUrl(String(value));
		window.open(url, '_blank', 'noopener');
	};
	return (
		<div className="q">
			{label}
			{value !== undefined && (
				<p>
					<button type="button" className="btn btn-ghost btn-sm" onClick={view}><FileText size={14} aria-hidden="true" /> View photo</button>
					{!disabled && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Remove</button>}
				</p>
			)}
			{!disabled && (
				<label className="btn btn-ghost btn-sm">
					<Camera size={14} aria-hidden="true" /> {upload.isPending ? 'Uploading…' : value === undefined ? 'Add photo' : 'Replace photo'}
					<input
						ref={input}
						type="file"
						accept="image/jpeg,image/png,image/webp,image/heic"
						capture="environment"
						className="sr-only"
						disabled={upload.isPending}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							upload.mutate(file, {
								onSuccess: (r) => onChange(r.file.id),
								onError: (er) => notify(er instanceof Error ? er.message : 'The photo did not upload', 'error'),
								onSettled: () => { if (input.current) input.current.value = ''; },
							});
						}}
					/>
				</label>
			)}
		</div>
	);
}

/** One question, sized for a thumb. Saves as soon as the answer changes. */
function Field({ q, value, disabled, onChange, checklistId }: { q: Question; value: string | number | undefined; disabled: boolean; onChange: (v: string | number | null) => void; checklistId: string }) {
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
					<option value="">Choose…</option>
					{(q.options ?? []).map((o) => (
						<option key={o}>{o}</option>
					))}
				</select>
			</label>
		);
	}
	if (q.type === 'photo') return <PhotoField checklistId={checklistId} label={label} value={value} disabled={disabled} onChange={onChange} />;
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

/**
 * The shift on a post-job checklist (CHK-6, HRS-2). Shows the hours worked and the pay split before saving, asks to confirm a
 * shift over 14 hours and refuses one over 16 hours or with more unbilled hours than worked. The server checks the same.
 */
function ShiftForm({ taskBusy, onSubmit, error }: { taskBusy: boolean; onSubmit: (s: ShiftInput) => void; error?: string }) {
	const [s, setS] = useState({ work_date: today(), start: '07:00', end: '15:30', break_minutes: 30, unbilled_hours: 0 });
	const set = (k: keyof typeof s) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setS({ ...s, [k]: e.target.type === 'number' ? Number(e.target.value) : e.target.value });
	const confirm = useConfirm();
	const split = splitPayHours(s.work_date, s.start, s.end, s.break_minutes || 0);
	const pay = 'error' in split ? null : split;
	const problem = 'error' in split ? split.error
		: split.total > 16 ? 'A shift cannot be longer than 16 hours.'
		: s.unbilled_hours > split.total ? 'Unbilled hours cannot be more than the hours worked.' : '';

	return (
		<form
			onSubmit={async (e) => {
				e.preventDefault();
				if (pay && pay.total > 14 && !(await confirm({ message: `${pay.total} hours is a very long shift. Save it anyway?`, confirmLabel: 'Save shift' }))) return;
				onSubmit(s);
			}}
		>
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
			{pay && !problem && (
				<p className="muted" role="status">
					{pay.total} h worked: {pay.single} h single, {pay.x1_5} h time and a half, {pay.x2} h double.
				</p>
			)}
			{problem && <p role="alert">{problem}</p>}
			{error && <p role="alert">{error}</p>}
			<button className="btn btn-primary" disabled={taskBusy || !!problem}>
				{taskBusy ? 'Saving…' : 'Complete checklist'}
			</button>
		</form>
	);
}

function Body({ data }: { data: ChecklistView }) {
	const { checklist, definition, answers, progress } = data;
	const save = useSaveAnswers(checklist.id);
	const done = useCompleteChecklist(checklist.id, checklist.taskId);
	const { notify } = useToast();
	const complete = (body: ShiftInput | Record<string, never>) => done.mutate(body, { onSuccess: () => notify('Checklist completed') });
	const locked = checklist.status === 'Completed';
	const isPost = checklist.phase === 'post';

	// Hidden follow-up questions appear as soon as the answer that reveals them is saved.
	const visible = (q: Question) => !q.showIf || answers[q.showIf.key] === q.showIf.equals;

	const failMsg = (e: unknown) => (e instanceof ApiError ? e.message : e ? 'Something went wrong' : undefined);

	return (
		<>
			<BackLink fallback={'/tasks/' + checklist.taskId} fallbackLabel="Back to task" />
			<PageHeader eyebrow="Checklist" title={isPost ? 'Post-job checklist' : 'Pre-job checklist'}>
				<Chip status={checklist.status} />
			</PageHeader>

			<Card title="Progress">
				<div style={{ maxWidth: 480 }}>
					<Progress label="Answered" value={progress.percent} />
				</div>
			</Card>

			{definition.sections.map((s) => (
				<Card key={s.key} title={s.title ?? 'Questions'}>
					{s.questions.filter(visible).map((q) => (
						<Field key={q.key} q={q} checklistId={checklist.id} value={answers[q.key]} disabled={locked || save.isPending} onChange={(v) => save.mutate({ [q.key]: v })} />
					))}
				</Card>
			))}

			{progress.issues.length > 0 && <p className="q__hint">Answers like these raise an issue for the manager when you complete the checklist.</p>}
			{save.isError && <p role="alert">{failMsg(save.error)}</p>}

			{!locked && isPost && (
				<Card title="Your hours">
					<ShiftForm taskBusy={done.isPending || !progress.canComplete} onSubmit={(shift) => complete(shift)} error={failMsg(done.error)} />
				</Card>
			)}
			{!locked && !isPost && (
				<div>
					{done.isError && <p role="alert">{failMsg(done.error)}</p>}
					<button className="btn" disabled={!progress.canComplete || done.isPending} onClick={() => complete({})}>
						Complete checklist
					</button>
				</div>
			)}
			{!locked && !progress.canComplete && <p className="q__hint">Answer every question marked * to complete.</p>}
			{locked && isPost && <p>Hours booked: {String(checklist.hours ?? 0)}</p>}
		</>
	);
}

export function ChecklistPage() {
	const { id } = useParams();
	const q = useChecklist(id);

	if (q.isPending) return <p role="status">Loading checklist…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Checklist not found</h1>;
	if (q.isError) return <p role="alert">Could not load this checklist.</p>;
	return <Body data={q.data} />;
}
