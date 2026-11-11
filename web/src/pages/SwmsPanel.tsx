import { useState } from 'react';
import { FileDown, PenLine } from 'lucide-react';
import { useSwms, useSwmsAction } from '../api/queries';
import { pdfUrl, useSwmsOptions } from '../api/more';
import type { Assignee, SwmsView } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/Messages';
import { Card } from '../components/ui';

const PM_ROLES = ['admin', 'project_manager', 'install_coordinator'];
const MANAGER_ROLES = [...PM_ROLES, 'fab_manager', 'second_ic'];
const DECLARATION = {
	pm: 'I have reviewed this safe work method statement and I am satisfied the controls are adequate for the work.',
	tl: 'I have briefed the crew on this statement and I accept responsibility for the work being done as described.',
	crew: 'I have read and understood this statement and I will follow it.',
} as const;

/** The signing steps as a strip: project manager, then team leader, then the crew's declarations. */
export function SigningSteps({ pm, tl, crewSigned, crewTotal }: { pm: boolean; tl: boolean; crewSigned: number; crewTotal: number }) {
	const steps = [
		{ label: 'Project manager', done: pm },
		{ label: 'Team leader', done: tl },
		{ label: crewTotal ? `Crew ${crewSigned}/${crewTotal}` : `Crew ${crewSigned}`, done: crewTotal > 0 && crewSigned >= crewTotal },
	];
	return (
		<ol className="steps" aria-label="Signing progress">
			{steps.map((s) => (
				<li key={s.label} className={s.done ? 'done' : ''}>
					<span className="steps-dot" aria-hidden="true" />
					<span>{s.label}</span>
					<span className="sr-only">{s.done ? ' signed' : ' not yet'}</span>
				</li>
			))}
		</ol>
	);
}

/** Sign or declare: tick the declaration in your own words and type your full name. Nothing is sent until both are done. */
function SignDialog({ as, summary, onCancel, onSign, busy }: { as: 'pm' | 'tl' | 'crew'; summary: string; onCancel: () => void; onSign: (name: string) => void; busy: boolean }) {
	const [name, setName] = useState('');
	const [ticked, setTicked] = useState(false);
	const ok = ticked && name.trim().length >= 2;
	return (
		<form
			className="sign-dialog"
			aria-label="Sign the SWMS"
			onSubmit={(e) => {
				e.preventDefault();
				if (ok) onSign(name.trim());
			}}
		>
			<p className="lead">{summary}</p>
			<label className="check">
				<input type="checkbox" checked={ticked} onChange={(e) => setTicked(e.target.checked)} /> {DECLARATION[as]}
			</label>
			<label>
				<span className="toolbar__label">Type your full name to sign</span>
				<input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required />
			</label>
			{!ok && (name || ticked) && <p className="muted">Tick the declaration and type your full name to sign.</p>}
			<div className="actions">
				<button className="btn" disabled={!ok || busy}>
					<PenLine size={16} aria-hidden="true" /> {busy ? 'Signing…' : as === 'crew' ? 'Add my declaration' : 'Sign'}
				</button>
				<button type="button" className="btn btn-ghost" onClick={onCancel}>
					Cancel
				</button>
			</div>
		</form>
	);
}

/** The edit form for a SWMS: site, high-risk work (ticking one ticks the PPE it needs), PPE, and the work steps. */
function EditForm({ s, busy, onSave }: { s: SwmsView; busy: boolean; onSave: (body: Record<string, unknown>) => void }) {
	const opts = useSwmsOptions();
	const [address, setAddress] = useState(s.siteAddress);
	const [hazards, setHazards] = useState<string[]>(s.hazards ?? []);
	const [ppe, setPpe] = useState<string[]>(s.ppe);
	const [steps, setSteps] = useState(s.tasks.map((t) => t.task).join('\n'));
	const locked = new Set(s.ppe); // PPE already saved only ever grows
	const toggleHazard = (key: string, on: boolean) => {
		setHazards(on ? [...hazards, key] : hazards.filter((h) => h !== key));
		if (on && opts.data) setPpe((cur) => [...new Set([...cur, ...(opts.data.ppeFor[key] ?? [])])]);
	};
	if (opts.isPending) return <p role="status" className="muted">Loading the form…</p>;
	if (opts.isError) return <p role="alert">Could not load the SWMS form.</p>;
	return (
		<form
			className="swms-edit"
			onSubmit={(e) => {
				e.preventDefault();
				onSave({ site_address: address, hazards, ppe, swms_tasks: steps.split('\n').map((l) => l.trim()).filter(Boolean).map((task) => ({ task })) });
			}}
		>
			<label>
				<span className="toolbar__label">Site address</span>
				<input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={2000} />
			</label>
			<fieldset className="check-grid">
				<legend className="toolbar__label">High-risk work on this job</legend>
				{opts.data.hazards.map((h) => (
					<label key={h.key} className="check">
						<input type="checkbox" checked={hazards.includes(h.key)} onChange={(e) => toggleHazard(h.key, e.target.checked)} /> {h.label}
					</label>
				))}
			</fieldset>
			<fieldset className="check-grid">
				<legend className="toolbar__label">PPE required (ticking high-risk work ticks the PPE it needs)</legend>
				{opts.data.ppe.map((p) => (
					<label key={p} className="check">
						<input type="checkbox" checked={ppe.includes(p)} disabled={locked.has(p)} onChange={(e) => setPpe(e.target.checked ? [...ppe, p] : ppe.filter((x) => x !== p))} /> {p}
					</label>
				))}
			</fieldset>
			<label>
				<span className="toolbar__label">Work steps (one per line)</span>
				<textarea rows={4} value={steps} onChange={(e) => setSteps(e.target.value)} />
			</label>
			<div className="actions">
				<button className="btn" disabled={busy}>
					Save SWMS
				</button>
			</div>
		</form>
	);
}

/** The SWMS for an install task: status, signing steps, what is signed, and (for managers) the edit form. Signing is a declaration plus a typed name. */
export function SwmsPanel({ swmsId, roles, myPersonId, assignees }: { swmsId: string; roles: string[]; myPersonId: string | null; assignees: Assignee[] }) {
	const q = useSwms(swmsId);
	const act = useSwmsAction(swmsId);
	const opts = useSwmsOptions();
	const { notify } = useToast();
	const confirm = useConfirm();
	const [dialog, setDialog] = useState<'pm' | 'tl' | 'crew' | null>(null);
	const [editing, setEditing] = useState(false);

	if (q.isPending) return <p role="status">Loading SWMS…</p>;
	if (q.isError) return <p role="alert">Could not load the SWMS.</p>;

	const s = q.data.swms;
	const locked = ['TL Signed', 'Not Required', 'Completed', 'Closed'].includes(s.status);
	const me = assignees.find((a) => a.personId === myPersonId);
	const canPm = roles.some((r) => PM_ROLES.includes(r)) && s.status === 'Created';
	const canTl = me?.role === 'lead' && s.status === 'PM Signed';
	const canDeclare = !!me && !locked && !s.declarations.some((d) => d.personId === myPersonId);
	const canEdit = roles.some((r) => MANAGER_ROLES.includes(r)) && !locked;
	const busy = act.isPending;
	// The project manager completes, then closes, a statement the team leader has signed.
	const canAdvance = roles.some((r) => PM_ROLES.includes(r)) && (s.status === 'TL Signed' || s.status === 'Completed');
	const advance = async () => {
		if (s.status === 'Completed' && !(await confirm({ title: 'Close this SWMS', message: 'Closing locks the statement for good. Close it?', confirmLabel: 'Close SWMS' }))) return;
		act.mutate({ path: '/advance', method: 'POST' }, { onSuccess: () => notify(s.status === 'TL Signed' ? 'SWMS completed' : 'SWMS closed') });
	};
	const hazardLabel = (k: string) => opts.data?.hazards.find((h) => h.key === k)?.label ?? k;

	const sign = (as: 'pm' | 'tl', typed_name: string) =>
		act.mutate({ path: '/sign', method: 'POST', body: { as, typed_name, declaration: true } }, { onSuccess: () => { setDialog(null); notify(as === 'pm' ? 'Signed as project manager' : 'Signed as team leader'); } });
	const declare = (typed_name: string) =>
		act.mutate({ path: '/declare', method: 'POST', body: { typed_name } }, { onSuccess: () => { setDialog(null); notify('Declaration added'); } });

	return (
		<Card title="Safe work method statement (SWMS)" action={<Chip status={s.status} />} label="Safe work method statement">
			<SigningSteps pm={!!s.signoff.pm} tl={!!s.signoff.tl} crewSigned={s.declarations.length} crewTotal={assignees.length} />
			<dl className="swms__facts">
				<dt>SWMS number</dt>
				<dd>{s.number || '-'}</dd>
				<dt>Site address</dt>
				<dd>{s.siteAddress || '-'}</dd>
				<dt>High-risk work</dt>
				<dd>{(s.hazards ?? []).length ? (s.hazards ?? []).map(hazardLabel).join('; ') : 'None ticked'}</dd>
				<dt>PPE</dt>
				<dd>{s.ppe.length ? s.ppe.join(', ') : '-'}</dd>
				<dt>Work steps</dt>
				<dd>{s.tasks.length ? <ol>{s.tasks.map((t, i) => <li key={i}>{t.task}</li>)}</ol> : '-'}</dd>
				<dt>Signed off</dt>
				<dd>
					{s.signoff.pm ? 'Project manager: ' + (s.signoff.pm.name ?? 'Unknown') + ' (' + s.signoff.pm.at + ')' : 'Project manager: not yet'}
					<br />
					{s.signoff.tl ? 'Team leader: ' + (s.signoff.tl.name ?? 'Unknown') + ' (' + s.signoff.tl.at + ')' : 'Team leader: not yet'}
				</dd>
				<dt>Declarations</dt>
				<dd>{s.declarations.length ? s.declarations.map((d) => d.name ?? 'Unknown').join(', ') : 'None yet'}</dd>
			</dl>

			<div className="actions">
				<a className="btn btn-ghost" href={pdfUrl(`/swms/${swmsId}/pdf`)} target="_blank" rel="noreferrer"><FileDown size={16} aria-hidden="true" /> PDF</a>
				{canPm && <button className="btn" disabled={busy} aria-pressed={dialog === 'pm'} onClick={() => setDialog(dialog === 'pm' ? null : 'pm')}>Sign as project manager</button>}
				{canTl && <button className="btn" disabled={busy} aria-pressed={dialog === 'tl'} onClick={() => setDialog(dialog === 'tl' ? null : 'tl')}>Sign as team leader</button>}
				{canAdvance && <button className="btn" disabled={busy} onClick={advance}>{s.status === 'TL Signed' ? 'Mark completed' : 'Close SWMS'}</button>}
				{canDeclare && <button className="btn btn-ghost" disabled={busy} aria-pressed={dialog === 'crew'} onClick={() => setDialog(dialog === 'crew' ? null : 'crew')}>Add my declaration</button>}
				{canEdit && <button className="btn btn-ghost" aria-expanded={editing} onClick={() => setEditing(!editing)}>{editing ? 'Close editor' : 'Edit SWMS'}</button>}
			</div>
			{dialog && (
				<SignDialog
					as={dialog}
					busy={busy}
					summary={`${s.siteAddress || 'Site not set'} · ${(s.hazards ?? []).length} high-risk categories · ${s.ppe.length} PPE items · ${s.tasks.length} work steps`}
					onCancel={() => setDialog(null)}
					onSign={(name) => (dialog === 'crew' ? declare(name) : sign(dialog, name))}
				/>
			)}
			{act.isError && <p role="alert" style={{ marginTop: 12 }}>{act.error.message}</p>}
			{canEdit && editing && <EditForm s={s} busy={busy} onSave={(body) => act.mutate({ path: '', method: 'PATCH', body }, { onSuccess: () => { setEditing(false); notify('SWMS saved'); } })} />}
		</Card>
	);
}
