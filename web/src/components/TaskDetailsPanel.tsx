import { useState } from 'react';
import { useEquipment } from '../api/queries';
import { useUpdateTask } from '../api/more';
import { SPEC_FIELDS, TASK_KINDS, parseSpec } from '../lib/taskKinds';
import type { TaskType } from '../lib/taskKinds';
import { Card } from './ui';
import { useToast } from './toast';

interface Props {
	taskId: string;
	type: TaskType;
	name: string;
	kind?: string;
	description?: string;
	proposedHours?: string | number;
	spec?: unknown;
	/** Install tasks that already started cannot change their type-defining fields. */
	started: boolean;
}

/**
 * Edit what a task is: name, kind, proposed hours, notes, the fabrication spec (by kind), and the hired equipment of an
 * install task. Equipment that must go off hire is switched off by the server when the install finishes on site (EQP-2).
 */
export function TaskDetailsPanel({ taskId, type, name, kind, description, proposedHours, spec, started }: Props) {
	const update = useUpdateTask(taskId);
	const equipment = useEquipment();
	const { notify } = useToast();
	const saved = parseSpec(spec);
	const fields = type === 'fabrication' && kind ? SPEC_FIELDS[kind] ?? [] : [];
	const [f, setF] = useState({ name, kind: kind ?? '', proposed: proposedHours === undefined || proposedHours === null ? '' : String(proposedHours), description: description ?? '' });
	const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map((x) => [x.key, saved[x.key] === undefined ? '' : String(saved[x.key])])));
	const [hired, setHired] = useState<string[]>(Array.isArray(saved.hired_equipment) ? (saved.hired_equipment as unknown[]).map(String) : []);
	const hiredList = (equipment.data?.items ?? []).filter((e) => e.offHireRequired || hired.includes(e.id));
	const hoursBad = f.proposed !== '' && !(Number(f.proposed) >= 0);
	const kinds = TASK_KINDS[type];

	const save = (e: React.FormEvent) => {
		e.preventDefault();
		const body: Record<string, unknown> = { name: f.name.trim(), description: f.description.trim() };
		if (f.kind && f.kind !== (kind ?? '')) body.kind = f.kind;
		if (f.proposed !== '') body.proposed_hours = Number(f.proposed);
		if (fields.length) {
			body.spec = Object.fromEntries(
				fields.map((x) => [x.key, vals[x.key] === '' ? null : x.type === 'number' ? Number(vals[x.key]) : vals[x.key]]),
			);
		}
		if (type === 'install') body.hired_equipment = hired;
		update.mutate(body, { onSuccess: () => notify('Task details saved'), onError: (er) => notify(er instanceof Error ? er.message : 'Could not save', 'error') });
	};

	return (
		<Card title="Task details">
			<form className="inline-form" style={{ background: 'transparent', border: 0, padding: 0 }} onSubmit={save}>
				<label style={{ flex: '2 1 260px' }}><span className="toolbar__label">Name *</span><input value={f.name} required maxLength={200} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
				<label style={{ flex: '0 1 200px' }}>
					<span className="toolbar__label">Kind</span>
					<select value={f.kind} disabled={started && type === 'install'} onChange={(e) => setF({ ...f, kind: e.target.value })}>
						<option value="">Not set</option>
						{[...new Set([...(kind ? [kind] : []), ...kinds])].map((k) => <option key={k}>{k}</option>)}
					</select>
				</label>
				<label style={{ flex: '0 1 130px' }}><span className="toolbar__label">Proposed hrs</span><input type="number" min={0} step="0.25" inputMode="decimal" value={f.proposed} aria-invalid={hoursBad} onChange={(e) => setF({ ...f, proposed: e.target.value })} /></label>
				{fields.map((x) => (
					<label key={x.key} style={{ flex: '0 1 170px' }}>
						<span className="toolbar__label">{x.label}</span>
						<input type={x.type === 'number' ? 'number' : 'text'} min={x.type === 'number' ? 0 : undefined} maxLength={200} value={vals[x.key] ?? ''} onChange={(e) => setVals({ ...vals, [x.key]: e.target.value })} />
					</label>
				))}
				<label style={{ flex: '1 1 100%' }}><span className="toolbar__label">Notes</span><textarea rows={2} value={f.description} maxLength={9000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
				{type === 'install' && (
					<fieldset style={{ flex: '1 1 100%', border: 0, padding: 0, margin: 0 }}>
						<legend className="toolbar__label">Hired equipment</legend>
						{equipment.isPending && <p className="muted">Loading equipment…</p>}
						{equipment.isSuccess && hiredList.length === 0 && <p className="muted">No equipment is marked as "off hire when finished". Mark it on the Equipment page first.</p>}
						<div className="check-grid">
							{hiredList.map((e) => (
								<label key={e.id} className="check">
									<input type="checkbox" checked={hired.includes(e.id)} onChange={(ev) => setHired(ev.target.checked ? [...hired, e.id] : hired.filter((x) => x !== e.id))} />
									{e.name} <small className="muted">{e.code}</small>
								</label>
							))}
						</div>
						{hired.length > 0 && <p className="muted" style={{ margin: '6px 0 0' }}>These go "Off hire" when the install is finished on site, and managers get one email.</p>}
					</fieldset>
				)}
				<button className="btn" disabled={update.isPending || !f.name.trim() || hoursBad}>{update.isPending ? 'Saving…' : 'Save details'}</button>
			</form>
		</Card>
	);
}
