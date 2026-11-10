import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus } from 'lucide-react';
import { useUpdatePerson, usePerson, usePersonCompliance, useRatings } from '../api/more';
import type { PersonFull } from '../api/more';
import { useComplianceTypes, useCreateCompliance, useMe, useUpdateCompliance } from '../api/queries';
import { ApiError } from '../api/client';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, PageHeader, fmtDate } from '../components/ui';
import { addYears, validityYears } from '../lib/validity';

const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const todayIso = () => new Date().toISOString().slice(0, 10);
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

/** Edit one worker. The hourly rate and the Active tick are for administrators; the server checks that too. */
function EditWorker({ p, isAdmin, onClose }: { p: PersonFull; isAdmin: boolean; onClose: () => void }) {
	const update = useUpdatePerson();
	const { notify } = useToast();
	const [f, setF] = useState({
		first_name: p.first_name,
		last_name: p.last_name ?? '',
		person_kind: p.person_kind ?? 'staff',
		job_title: p.job_title ?? '',
		phone: p.phone ?? '',
		email: p.email ?? '',
		hourly_rate: p.hourly_rate !== undefined && p.hourly_rate !== null ? String(p.hourly_rate) : '',
		is_active: p.is_active !== false,
	});
	const emailBad = !!f.email && !EMAIL.test(f.email);
	const rate = f.hourly_rate === '' ? undefined : Number(f.hourly_rate);
	const rateBad = rate !== undefined && (!Number.isFinite(rate) || rate < 0);
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				update.mutate(
					{
						id: p.ROWID,
						first_name: f.first_name.trim(),
						last_name: f.last_name.trim(),
						person_kind: f.person_kind,
						job_title: f.job_title.trim(),
						phone: f.phone.trim(),
						...(f.email.trim() ? { email: f.email.trim() } : {}),
						...(isAdmin ? { hourly_rate: rate, is_active: f.is_active } : {}),
					},
					{ onSuccess: () => { notify('Worker saved'); onClose(); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label><span className="toolbar__label">First name *</span><input value={f.first_name} required maxLength={100} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
			<label><span className="toolbar__label">Last name</span><input value={f.last_name} maxLength={100} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label>
			<label style={{ flex: '0 1 170px' }}>
				<span className="toolbar__label">Employer</span>
				<select value={f.person_kind} onChange={(e) => setF({ ...f, person_kind: e.target.value })}><option value="staff">Visual Exposure</option><option value="subcontractor">Subcontractor</option></select>
			</label>
			<label><span className="toolbar__label">Job title</span><input value={f.job_title} maxLength={100} onChange={(e) => setF({ ...f, job_title: e.target.value })} /></label>
			<label><span className="toolbar__label">Phone</span><input type="tel" value={f.phone} maxLength={30} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
			<label><span className="toolbar__label">Email</span><input type="email" value={f.email} maxLength={100} spellCheck={false} aria-invalid={emailBad} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
			{isAdmin && (
				<>
					<label style={{ flex: '0 1 140px' }}><span className="toolbar__label">Hourly rate ($)</span><input type="number" min={0} max={1000} step="0.01" value={f.hourly_rate} aria-invalid={rateBad} onChange={(e) => setF({ ...f, hourly_rate: e.target.value })} /></label>
					<label className="check" style={{ flex: '0 1 auto' }}><input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Active (untick when the worker leaves; records are kept)</label>
				</>
			)}
			<button className="btn" disabled={update.isPending || !f.first_name.trim() || emailBad || rateBad}>{update.isPending ? 'Saving…' : 'Save'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{emailBad && <p role="alert">Enter a valid email address.</p>}
		</form>
	);
}

interface RecordRow { id: string; typeName: string | null; referenceNo: string; issueDate?: string | null; expiryDate: string | null }

/** Edit one ticket, induction or document: reference, issue date, expiry, with a button that suggests the expiry. */
function EditRecord({ r, onClose }: { r: RecordRow; onClose: () => void }) {
	const update = useUpdateCompliance();
	const { notify } = useToast();
	const [f, setF] = useState({ reference_no: r.referenceNo ?? '', issue_date: (r.issueDate ?? '').slice(0, 10), expiry_date: (r.expiryDate ?? '').slice(0, 10) });
	const years = validityYears(r.typeName);
	const problem = f.issue_date > todayIso() ? 'The issue date cannot be in the future.' : f.issue_date && f.expiry_date && f.expiry_date <= f.issue_date ? 'The expiry date must be after the issue date.' : '';
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				update.mutate(
					{ id: r.id, reference_no: f.reference_no.trim(), issue_date: f.issue_date || null, expiry_date: f.expiry_date || null },
					{ onSuccess: () => { notify('Record saved'); onClose(); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label><span className="toolbar__label">Reference</span><input value={f.reference_no} maxLength={100} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></label>
			<label><span className="toolbar__label">Issued</span><input type="date" max={todayIso()} value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></label>
			<label><span className="toolbar__label">Expires</span><input type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></label>
			{years !== null && (
				<button type="button" className="btn btn-ghost btn-sm" disabled={!f.issue_date} title={f.issue_date ? undefined : 'Enter the issue date first'} onClick={() => setF({ ...f, expiry_date: addYears(f.issue_date, years) })}>
					Set expiry {years} {years === 1 ? 'year' : 'years'} after issue
				</button>
			)}
			<button className="btn" disabled={update.isPending || !!problem}>{update.isPending ? 'Saving…' : 'Save'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{problem && <p role="alert">{problem}</p>}
		</form>
	);
}

/** Add a ticket or induction to this person: only types they do not have yet are offered. */
function AddRecord({ personId, held, onClose }: { personId: string; held: Set<string>; onClose: () => void }) {
	const types = useComplianceTypes();
	const create = useCreateCompliance();
	const { notify } = useToast();
	const [f, setF] = useState({ type_id: '', reference_no: '', issue_date: '', expiry_date: '' });
	const free = (types.data?.items ?? []).filter((t) => t.kind !== 'company_document' && !held.has(t.id));
	const type = free.find((t) => t.id === f.type_id);
	const years = validityYears(type?.name);
	const problem = f.issue_date > todayIso() ? 'The issue date cannot be in the future.' : f.issue_date && f.expiry_date && f.expiry_date <= f.issue_date ? 'The expiry date must be after the issue date.' : '';
	if (types.isSuccess && free.length === 0) {
		return <Dialog title="Add a ticket or induction" onClose={onClose}><p className="muted">This person already has every ticket and induction type. <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button></p></Dialog>;
	}
	return (
		<Dialog title="Add a ticket or induction" onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				create.mutate(
					{ person_id: personId, type_id: f.type_id, reference_no: f.reference_no.trim() || undefined, issue_date: f.issue_date || undefined, expiry_date: f.expiry_date || undefined },
					{ onSuccess: () => { notify('Record added'); onClose(); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label style={{ flex: '2 1 220px' }}>
				<span className="toolbar__label">Ticket or induction *</span>
				<select value={f.type_id} required onChange={(e) => setF({ ...f, type_id: e.target.value })}>
					<option value="">Choose…</option>
					{free.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
				</select>
			</label>
			<label><span className="toolbar__label">Reference</span><input value={f.reference_no} maxLength={100} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></label>
			<label><span className="toolbar__label">Issued</span><input type="date" max={todayIso()} value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></label>
			<label><span className="toolbar__label">Expires{type?.requiresExpiry ? ' *' : ''}</span><input type="date" value={f.expiry_date} required={!!type?.requiresExpiry} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></label>
			{years !== null && (
				<button type="button" className="btn btn-ghost btn-sm" disabled={!f.issue_date} onClick={() => setF({ ...f, expiry_date: addYears(f.issue_date, years) })}>
					Set expiry {years} {years === 1 ? 'year' : 'years'} after issue
				</button>
			)}
			<button className="btn" disabled={create.isPending || !f.type_id || !!problem}>{create.isPending ? 'Saving…' : 'Add'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{problem && <p role="alert">{problem}</p>}
		</form>
		</Dialog>
	);
}

/** One person: contact details, their rating from site managers, and their tickets and inductions. Managers can edit all of it. */
export function PersonDetail() {
	const { id } = useParams();
	const q = usePerson(id);
	const ratings = useRatings(id);
	const comp = usePersonCompliance(id);
	const me = useMe();
	const canEdit = !!me.data?.permissions.createJob; // managers; the server decides for real
	const isAdmin = !!me.data?.roles.includes('admin');
	const [editing, setEditing] = useState(false);
	const [adding, setAdding] = useState(false);
	const [editRow, setEditRow] = useState<string | null>(null);

	if (q.isPending) return <p role="status">Loading…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Person not found</h1>;
	if (q.isError) return <p role="alert">Could not load this person.</p>;
	const p = q.data.person;
	const name = `${p.first_name} ${p.last_name ?? ''}`.trim();
	const held = new Set((comp.data?.items ?? []).map((c) => c.typeId).filter(Boolean) as string[]);

	return (
		<>
			<Link className="back-link" to="/people"><ArrowLeft size={16} aria-hidden="true" /> All people</Link>
			<PageHeader eyebrow={p.person_kind === 'subcontractor' ? 'Subcontractor' : 'Staff'} title={name}>
				<Chip status={p.is_active === false ? 'Inactive' : 'Active'} />
				{canEdit && !editing && <button className="btn btn-ghost" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /> Edit</button>}
			</PageHeader>

			<Card title="Details" flush={editing}>
				{editing && <EditWorker p={p} isAdmin={isAdmin} onClose={() => setEditing(false)} />}
				{!editing && (
					<dl className="facts">
						<div className="fact"><dt>Email</dt><dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '-'}</dd></div>
						<div className="fact"><dt>Phone</dt><dd>{p.phone ? <a href={`tel:${p.phone.replace(/\s+/g, '')}`}>{p.phone}</a> : '-'}</dd></div>
						<div className="fact"><dt>Job title</dt><dd>{p.job_title || '-'}</dd></div>
						<div className="fact"><dt>Roles</dt><dd style={{ textTransform: 'capitalize' }}>{parseRoles(p.roles).map((r) => r.replace(/_/g, ' ')).join(', ') || '-'}</dd></div>
						{isAdmin && <div className="fact"><dt>Hourly rate</dt><dd>{p.hourly_rate ? `$${Number(p.hourly_rate).toFixed(2)}` : '-'}</dd></div>}
					</dl>
				)}
			</Card>

			<div className="grid-2">
				<Card title="Rating from site managers">
					{ratings.isPending && <p role="status" className="muted">Loading…</p>}
					{ratings.isError && <p role="alert">Could not load ratings.</p>}
					{ratings.isSuccess && ratings.data.count === 0 && <p className="muted">No ratings yet.</p>}
					{ratings.isSuccess && ratings.data.count > 0 && (
						<>
							<p className="lead"><strong className="num" style={{ fontSize: 28 }}>{ratings.data.average}</strong> out of 5, from {ratings.data.count} {ratings.data.count === 1 ? 'task' : 'tasks'}</p>
							<ul className="plain-list" style={{ marginTop: 12 }}>
								{ratings.data.items.slice(0, 8).map((r, i) => (
									<li key={i}>
										<Link className="row-link" to={'/tasks/' + r.taskId}>
											<span role="img" aria-label={`${r.rating} out of 5`} style={{ color: 'var(--brand-strong)', letterSpacing: 2 }}>{stars(r.rating)}</span>
										</Link>{' '}
										{r.comment && <small>{r.comment}</small>}
									</li>
								))}
							</ul>
						</>
					)}
				</Card>

				<Card title="Tickets and inductions" flush action={canEdit && !adding ? <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add</button> : undefined}>
					{adding && canEdit && <AddRecord personId={p.ROWID} held={held} onClose={() => setAdding(false)} />}
					{comp.isPending && <p role="status" className="table-empty">Loading…</p>}
					{comp.isError && <p role="alert">Could not load tickets.</p>}
					{comp.isSuccess && comp.data.items.length === 0 && <p className="table-empty">Nothing recorded.</p>}
					{comp.isSuccess && comp.data.items.length > 0 && (
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">Tickets and inductions</caption>
								<thead><tr><th scope="col">Type</th><th scope="col">Issued</th><th scope="col">Expires</th><th scope="col">Status</th>{canEdit && <th scope="col"><span className="sr-only">Update</span></th>}</tr></thead>
								<tbody>
									{comp.data.items.map((c) => (
										<tr key={c.id}>
											<td data-label="Type" className="cell-primary"><strong>{c.typeName ?? 'Record'}</strong>{c.referenceNo && <><br /><small>{c.referenceNo}</small></>}</td>
											<td data-label="Issued">{fmtDate(c.issueDate ?? null)}</td>
											<td data-label="Expires">{fmtDate(c.expiryDate)}</td>
											<td data-label="Status"><Chip status={c.status} /></td>
											{canEdit && <td data-label="Update"><button className="btn btn-ghost btn-sm" aria-expanded={editRow === c.id} onClick={() => setEditRow(editRow === c.id ? null : c.id)}>Update</button></td>}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					{editRow && comp.isSuccess && (() => {
						const r = comp.data.items.find((c) => c.id === editRow);
						return r ? <EditRecord key={r.id} r={r as RecordRow} onClose={() => setEditRow(null)} /> : null;
					})()}
				</Card>
			</div>
		</>
	);
}
