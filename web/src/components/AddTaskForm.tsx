import { useState } from 'react';
import { useCreateTask, usePeople, useSignGroups, useSites } from '../api/queries';
import { TASK_NAMES } from '../lib/names';
import { SPEC_FIELDS, TASK_KINDS } from '../lib/taskKinds';
import type { TaskType } from '../lib/taskKinds';
import { useToast } from './toast';
import { Dialog } from './Dialog';

const TYPE_LABEL: Record<TaskType, string> = { design: 'Design', fabrication: 'Fabrication', install: 'Install' };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Add a task to a job with what the old wizard asked for (TSK-6, JOB-4): type, kind, name, dates, quoted and proposed hours,
 * a note, the location, the sign group, the cost type, the fab spec for the chosen fab type, and the crew (or the designer).
 * With a date and a team leader the task starts as "Scheduled" (a design task with its designer as "Assigned", TSK-3);
 * otherwise "Awaiting Scheduling" (or "To be Assigned" for design), exactly as before. The server checks all of it again.
 */
export function AddTaskForm({ jobId, onClose, type = 'install', kind = '' }: { jobId: string; onClose: () => void; type?: TaskType; kind?: string }) {
	const add = useCreateTask(jobId);
	const people = usePeople(true);
	const sites = useSites();
	const groups = useSignGroups(jobId);
	const { notify } = useToast();
	const initial = { type, kind, name: '', scheduled: '', finish: '', quoted: '', proposed: '', description: '', site: '', group: '', costType: '', lead: '', members: [] as string[], spec: {} as Record<string, string> };
	const [f, setF] = useState(initial);
	const datesBad = !!f.scheduled && !!f.finish && f.scheduled > f.finish;
	const hoursBad = [f.quoted, f.proposed].some((h) => h !== '' && !(Number(h) >= 0));
	const specFields = f.type === 'fabrication' && f.kind ? SPEC_FIELDS[f.kind] ?? [] : [];
	const specBad = specFields.some((x) => x.type === 'number' && f.spec[x.key] && !(Number(f.spec[x.key]) >= 0));
	const active = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const fullName = (p: { first_name: string; last_name?: string | null }) => `${p.first_name} ${p.last_name ?? ''}`.trim();
	const isDesign = f.type === 'design';
	const startsAs = isDesign ? (f.lead ? 'Assigned' : 'To be Assigned') : f.scheduled && f.lead ? 'Scheduled' : 'Awaiting Scheduling';

	return (
		<Dialog title={`Add ${TYPE_LABEL[type].toLowerCase()} task`} onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				const spec = Object.fromEntries(
					specFields.filter((x) => (f.spec[x.key] ?? '').trim() !== '').map((x) => [x.key, x.type === 'number' ? Number(f.spec[x.key]) : f.spec[x.key].trim()]),
				);
				const crew = [...(f.lead ? [{ person_id: f.lead, role: 'lead' as const }] : []), ...(isDesign ? [] : f.members.filter((m) => m !== f.lead).map((m) => ({ person_id: m, role: 'member' as const })))];
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
						site_id: f.site || undefined,
						sign_group_id: f.group || undefined,
						cost_type: f.costType ? (f.costType as 'Fab' | 'Parent') : undefined,
						spec: Object.keys(spec).length ? spec : undefined,
						crew: crew.length ? crew : undefined,
					},
					{ onSuccess: () => { notify('Task added'); onClose(); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not add the task', 'error') },
				);
			}}
		>
			<label style={{ flex: '0 1 150px' }}>
				<span className="toolbar__label">Type *</span>
				<select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as TaskType, kind: '', spec: {}, members: [] })}>
					{(Object.keys(TYPE_LABEL) as TaskType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
				</select>
			</label>
			<label style={{ flex: '0 1 200px' }}>
				<span className="toolbar__label">{TASK_NAMES[f.type].typeLabel}</span>
				<select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value, spec: {} })}>
					<option value="">Not set</option>
					{TASK_KINDS[f.type].map((k) => <option key={k}>{k}</option>)}
				</select>
			</label>
			<label style={{ flex: '2 1 260px' }}><span className="toolbar__label">Task Name *</span><input value={f.name} required maxLength={200} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
			<label style={{ flex: '0 1 160px' }}><span className="toolbar__label">{f.type === 'design' ? 'Scheduled Date' : TASK_NAMES[f.type].dateLabel}</span><input type="date" min={todayIso()} value={f.scheduled} onChange={(e) => setF({ ...f, scheduled: e.target.value })} /></label>
			<label style={{ flex: '0 1 160px' }}><span className="toolbar__label">Required Finish</span><input type="date" value={f.finish} aria-invalid={datesBad} onChange={(e) => setF({ ...f, finish: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">{f.type === 'install' ? 'Quoted Man Hours' : 'Quoted Hours'}</span><input type="number" min={0} step="0.25" inputMode="decimal" value={f.quoted} onChange={(e) => setF({ ...f, quoted: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">{f.type === 'install' ? 'Expected Job Hours' : 'Proposed Hours'}</span><input type="number" min={0} step="0.25" inputMode="decimal" value={f.proposed} onChange={(e) => setF({ ...f, proposed: e.target.value })} /></label>
			<label style={{ flex: '1 1 200px' }}>
				<span className="toolbar__label">Location</span>
				<select value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })}>
					<option value="">Not set</option>
					{(sites.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
				</select>
			</label>
			{(groups.data?.items ?? []).length > 0 && (
				<label style={{ flex: '1 1 200px' }}>
					<span className="toolbar__label">Sign group</span>
					<select value={f.group} onChange={(e) => setF({ ...f, group: e.target.value })}>
						<option value="">Not set</option>
						{(groups.data?.items ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
					</select>
				</label>
			)}
			<label style={{ flex: '0 1 150px' }}>
				<span className="toolbar__label">Cost Type</span>
				<select value={f.costType} onChange={(e) => setF({ ...f, costType: e.target.value })}>
					<option value="">Not set</option>
					<option>Parent</option>
					<option>Fab</option>
				</select>
			</label>
			{specFields.map((x) => (
				<label key={x.key} style={{ flex: '0 1 150px' }}>
					<span className="toolbar__label">{x.label}</span>
					<input type={x.type === 'number' ? 'number' : 'text'} min={x.type === 'number' ? 0 : undefined} step="any" maxLength={200} value={f.spec[x.key] ?? ''} onChange={(e) => setF({ ...f, spec: { ...f.spec, [x.key]: e.target.value } })} />
				</label>
			))}
			<label style={{ flex: '1 1 200px' }}>
				<span className="toolbar__label">{isDesign ? 'Designer' : 'Team Leader'}</span>
				<select value={f.lead} onChange={(e) => setF({ ...f, lead: e.target.value, members: f.members.filter((m) => m !== e.target.value) })}>
					<option value="">{people.isPending ? 'Loading…' : 'Not set'}</option>
					{active.map((p) => <option key={p.ROWID} value={p.ROWID}>{fullName(p)}</option>)}
				</select>
			</label>
			{!isDesign && (
				<fieldset style={{ flex: '2 1 280px', border: 0, padding: 0, margin: 0 }}>
					<legend className="toolbar__label">Team Members{f.members.length ? ` (${f.members.length})` : ''}</legend>
					<div className="check-list">
						{active.filter((p) => p.ROWID !== f.lead).map((p) => (
							<label key={p.ROWID} className="check">
								<input type="checkbox" checked={f.members.includes(p.ROWID)} disabled={!f.members.includes(p.ROWID) && f.members.length >= 19} onChange={(e) => setF({ ...f, members: e.target.checked ? [...f.members, p.ROWID] : f.members.filter((m) => m !== p.ROWID) })} />
								{fullName(p)}
							</label>
						))}
					</div>
				</fieldset>
			)}
			<label style={{ flex: '1 1 100%' }}><span className="toolbar__label">Task Description</span><textarea rows={2} value={f.description} maxLength={9000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
			<button className="btn" disabled={add.isPending || !f.name.trim() || datesBad || hoursBad || specBad}>{add.isPending ? 'Adding…' : 'Submit'}</button>
			<button type="button" className="btn btn-ghost" onClick={() => setF(initial)}>Reset</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{datesBad && <p role="alert">The scheduled date cannot be after the required finish date.</p>}
			{specBad && <p role="alert">Spec sizes and quantities must be numbers.</p>}
			<p className="muted" style={{ flex: '1 1 100%', margin: 0 }}>
				The task starts as "{startsAs}".{!isDesign && startsAs === 'Awaiting Scheduling' ? ' With a date and a team leader it starts as "Scheduled".' : ''}
			</p>
		</form>
		</Dialog>
	);
}
