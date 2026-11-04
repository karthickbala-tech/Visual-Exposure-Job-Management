import { useState } from 'react';
import { useSwms, useSwmsAction } from '../api/queries';
import type { Assignee } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';
import { FileDown } from 'lucide-react';
import { pdfUrl } from '../api/more';

const PM_ROLES = ['admin', 'project_manager', 'install_coordinator'];
const MANAGER_ROLES = [...PM_ROLES, 'fab_manager', 'second_ic'];

/** The SWMS for an install task: status, sign-off, declarations and (for managers) the edit form. */
export function SwmsPanel({ swmsId, roles, myPersonId, assignees }: { swmsId: string; roles: string[]; myPersonId: string | null; assignees: Assignee[] }) {
	const q = useSwms(swmsId);
	const act = useSwmsAction(swmsId);
	const { notify } = useToast();
	const [ppe, setPpe] = useState('');
	const [address, setAddress] = useState<string | null>(null);
	const [taskLines, setTaskLines] = useState('');

	if (q.isPending) return <p role="status">Loading SWMS…</p>;
	if (q.isError) return <p role="alert">Could not load the SWMS.</p>;

	const s = q.data.swms;
	const locked = s.status === 'TL Signed' || s.status === 'Not Required';
	const me = assignees.find((a) => a.personId === myPersonId);
	const canPm = roles.some((r) => PM_ROLES.includes(r)) && s.status === 'Created';
	const canTl = me?.role === 'lead' && s.status === 'PM Signed';
	const canDeclare = !!me && !locked && !s.declarations.some((d) => d.personId === myPersonId);
	const canEdit = roles.some((r) => MANAGER_ROLES.includes(r)) && !locked;
	const busy = act.isPending;

	const run = (v: Parameters<typeof act.mutate>[0], done: string) => act.mutate(v, { onSuccess: () => notify(done) });

	const save = () => {
		const body: Record<string, unknown> = {};
		if (address !== null) body.site_address = address;
		if (ppe.trim()) body.ppe = ppe.split(',').map((x) => x.trim()).filter(Boolean);
		if (taskLines.trim()) body.swms_tasks = taskLines.split('\n').map((l) => l.trim()).filter(Boolean).map((task) => ({ task }));
		if (Object.keys(body).length === 0) return;
		act.mutate(
			{ path: '', method: 'PATCH', body },
			{
				onSuccess: () => {
					setPpe('');
					setAddress(null);
					setTaskLines('');
					notify('SWMS saved');
				},
			},
		);
	};

	return (
		<Card title="Safe work method statement (SWMS)" action={<Chip status={s.status} />} label="Safe work method statement">
			<dl className="swms__facts">
				<dt>Site address</dt>
				<dd>{s.siteAddress || '-'}</dd>
				<dt>PPE</dt>
				<dd>{s.ppe.length ? s.ppe.join(', ') : '-'}</dd>
				<dt>Work steps</dt>
				<dd>
					{s.tasks.length ? (
						<ol>
							{s.tasks.map((t, i) => (
								<li key={i}>{t.task}</li>
							))}
						</ol>
					) : (
						'-'
					)}
				</dd>
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
				{canPm && (
					<button className="btn" disabled={busy} onClick={() => run({ path: '/sign', method: 'POST', body: { as: 'pm' } }, 'Signed as project manager')}>
						Sign as project manager
					</button>
				)}
				{canTl && (
					<button className="btn" disabled={busy} onClick={() => run({ path: '/sign', method: 'POST', body: { as: 'tl' } }, 'Signed as team leader')}>
						Sign as team leader
					</button>
				)}
				{canDeclare && (
					<button className="btn btn-ghost" disabled={busy} onClick={() => run({ path: '/declare', method: 'POST' }, 'Declaration added')}>
						Add my declaration
					</button>
				)}
			</div>
			{act.isError && <p role="alert" style={{ marginTop: 12 }}>{act.error.message}</p>}

			{canEdit && (
				<form
					className="inline-form"
					style={{ marginTop: 20, marginInline: -22, marginBottom: -22 }}
					onSubmit={(e) => {
						e.preventDefault();
						save();
					}}
				>
					<label>
						<span className="toolbar__label">Site address</span>
						<input value={address ?? s.siteAddress} onChange={(e) => setAddress(e.target.value)} maxLength={2000} />
					</label>
					<label>
						<span className="toolbar__label">Add PPE (comma separated)</span>
						<input value={ppe} onChange={(e) => setPpe(e.target.value)} placeholder="e.g. hard hat, boots…" />
					</label>
					<label style={{ flexBasis: '100%' }}>
						<span className="toolbar__label">Work steps (one per line, replaces the list)</span>
						<textarea rows={3} value={taskLines} onChange={(e) => setTaskLines(e.target.value)} />
					</label>
					<button className="btn" disabled={busy}>
						Save SWMS
					</button>
				</form>
			)}
		</Card>
	);
}
