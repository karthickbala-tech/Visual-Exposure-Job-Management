import { useState } from 'react';
import { useSwms, useSwmsAction } from '../api/queries';
import { Chip } from '../components/Chip';
import type { Assignee } from '../api/types';

const PM_ROLES = ['admin', 'project_manager', 'install_coordinator'];
const MANAGER_ROLES = [...PM_ROLES, 'fab_manager', 'second_ic'];

/** The SWMS for an install task: status, sign-off, declarations and (for managers) the edit form. */
export function SwmsPanel({ swmsId, roles, myPersonId, assignees }: { swmsId: string; roles: string[]; myPersonId: string | null; assignees: Assignee[] }) {
	const q = useSwms(swmsId);
	const act = useSwmsAction(swmsId);
	const [ppe, setPpe] = useState('');
	const [address, setAddress] = useState<string | null>(null);
	const [taskLines, setTaskLines] = useState('');

	if (q.isPending) return <p role="status">Loading SWMS...</p>;
	if (q.isError) return <p role="alert">Could not load the SWMS.</p>;

	const s = q.data.swms;
	const locked = s.status === 'TL Signed' || s.status === 'Not Required';
	const me = assignees.find((a) => a.personId === myPersonId);
	const canPm = roles.some((r) => PM_ROLES.includes(r)) && s.status === 'Created';
	const canTl = me?.role === 'lead' && s.status === 'PM Signed';
	const canDeclare = !!me && !locked && !s.declarations.some((d) => d.personId === myPersonId);
	const canEdit = roles.some((r) => MANAGER_ROLES.includes(r)) && !locked;
	const busy = act.isPending;

	const save = () => {
		const body: Record<string, unknown> = {};
		if (address !== null) body.site_address = address;
		if (ppe.trim()) body.ppe = ppe.split(',').map((x) => x.trim()).filter(Boolean);
		if (taskLines.trim()) body.swms_tasks = taskLines.split('\n').map((l) => l.trim()).filter(Boolean).map((task) => ({ task }));
		if (Object.keys(body).length === 0) return;
		act.mutate({ path: '', method: 'PATCH', body }, { onSuccess: () => { setPpe(''); setAddress(null); setTaskLines(''); } });
	};

	return (
		<section className="swms" aria-label="Safe work method statement">
			<h2 className="group__title">SWMS</h2>
			<p>
				<Chip status={s.status} />
			</p>

			<dl className="swms__facts">
				<dt>Site address</dt>
				<dd>{s.siteAddress || '-'}</dd>
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
				{canPm && <button className="btn btn-primary" disabled={busy} onClick={() => act.mutate({ path: '/sign', method: 'POST', body: { as: 'pm' } })}>Sign as project manager</button>}
				{canTl && <button className="btn btn-primary" disabled={busy} onClick={() => act.mutate({ path: '/sign', method: 'POST', body: { as: 'tl' } })}>Sign as team leader</button>}
				{canDeclare && <button className="btn btn-ghost" disabled={busy} onClick={() => act.mutate({ path: '/declare', method: 'POST' })}>Add my declaration</button>}
			</div>
			{act.isError && <p role="alert">{act.error.message}</p>}

			{canEdit && (
				<form className="inline-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
					<label>
						<span className="toolbar__label">Site address</span>
						<input value={address ?? s.siteAddress} onChange={(e) => setAddress(e.target.value)} maxLength={2000} />
					</label>
					<label>
						<span className="toolbar__label">Add PPE (comma separated)</span>
						<input value={ppe} onChange={(e) => setPpe(e.target.value)} placeholder="hardhat, boots" />
					</label>
					<label>
						<span className="toolbar__label">Work steps (one per line, replaces the list)</span>
						<textarea rows={3} value={taskLines} onChange={(e) => setTaskLines(e.target.value)} />
					</label>
					<button className="btn" disabled={busy}>Save SWMS</button>
				</form>
			)}
		</section>
	);
}
