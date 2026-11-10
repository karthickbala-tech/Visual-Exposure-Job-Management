import { useState } from 'react';
import { useCreateTask } from '../api/queries';
import { TASK_NAMES } from '../lib/names';
import { TASK_KINDS } from '../lib/taskKinds';
import type { TaskType } from '../lib/taskKinds';
import { useToast } from './toast';
import { Dialog } from './Dialog';

const TYPE_LABEL: Record<TaskType, string> = { design: 'Design', fabrication: 'Fabrication', install: 'Install' };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Add a task to a job with what the old wizard asked for: type, kind, name, dates, quoted and proposed hours, and a note.
 * A task with no date starts as "Awaiting Scheduling" (or "To be Assigned" for design), exactly as before.
 */
export function AddTaskForm({ jobId, onClose, type = 'install', kind = '' }: { jobId: string; onClose: () => void; type?: TaskType; kind?: string }) {
	const add = useCreateTask(jobId);
	const { notify } = useToast();
	const initial = { type, kind, name: '', scheduled: '', finish: '', quoted: '', proposed: '', description: '' };
	const [f, setF] = useState(initial);
	const datesBad = !!f.scheduled && !!f.finish && f.scheduled > f.finish;
	const hoursBad = [f.quoted, f.proposed].some((h) => h !== '' && !(Number(h) >= 0));
	return (
		<Dialog title={`Add ${TYPE_LABEL[type].toLowerCase()} task`} onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				add.mutate(
					{
						task_type: f.type,
						name: f.name.trim(),
						kind: f.kind || undefined,
						scheduled_date: f.scheduled || undefined,
						required_finish: f.finish || undefined,
						quoted_hours: f.quoted === '' ? undefined : Number(f.quoted),
						proposed_hours: f.proposed === '' ? undefined : Number(f.proposed),
						description: f.description.trim() || undefined,
					},
					{ onSuccess: () => { notify('Task added'); onClose(); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not add the task', 'error') },
				);
			}}
		>
			<label style={{ flex: '0 1 150px' }}>
				<span className="toolbar__label">Type *</span>
				<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TaskType, kind: '' })}>
					{(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
				</select>
			</label>
			<label style={{ flex: '0 1 200px' }}>
				<span className="toolbar__label">{TASK_NAMES[f.type].typeLabel}</span>
				<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
					<option value="">Not set</option>
					{TASK_KINDS[f.type].map((k) => <option key={k}>{k}</option>)}
				</select>
			</label>
			<label style={{ flex: '2 1 260px' }}><span className="toolbar__label">Task Name *</span><input value={f.name} required maxLength={200} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
			<label style={{ flex: '0 1 160px' }}><span className="toolbar__label">{f.type === 'design' ? 'Scheduled Date' : TASK_NAMES[f.type].dateLabel}</span><input type="date" min={todayIso()} value={f.scheduled} onChange={(e) => setF({ ...f, scheduled: e.target.value })} /></label>
			<label style={{ flex: '0 1 160px' }}><span className="toolbar__label">Required Finish</span><input type="date" value={f.finish} aria-invalid={datesBad} onChange={(e) => setF({ ...f, finish: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">{f.type === 'install' ? 'Quoted Man Hours' : 'Quoted Hours'}</span><input type="number" min={0} step="0.25" inputMode="decimal" value={f.quoted} onChange={(e) => setF({ ...f, quoted: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">{f.type === 'install' ? 'Expected Job Hours' : 'Proposed Hours'}</span><input type="number" min={0} step="0.25" inputMode="decimal" value={f.proposed} onChange={(e) => setF({ ...f, proposed: e.target.value })} /></label>
			<label style={{ flex: '1 1 100%' }}><span className="toolbar__label">Task Description</span><textarea rows={2} value={f.description} maxLength={9000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
			<button className="btn" disabled={add.isPending || !f.name.trim() || datesBad || hoursBad}>{add.isPending ? 'Adding…' : 'Submit'}</button>
			<button type="button" className="btn btn-ghost" onClick={() => setF(initial)}>Reset</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{datesBad && <p role="alert">The scheduled date cannot be after the required finish date.</p>}
			<p className="muted" style={{ flex: '1 1 100%', margin: 0 }}>With no date the task starts as {f.type === 'design' ? '"To be Assigned"' : '"Awaiting Scheduling"'}; a manager schedules it later.</p>
		</form>
		</Dialog>
	);
}
