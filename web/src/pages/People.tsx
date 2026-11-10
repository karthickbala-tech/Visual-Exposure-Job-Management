import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useCompanies, useComplianceItems, useComplianceTypes, useCreateCompliance, useMe, usePeople } from '../api/queries';
import { useCreatePerson, useRoles } from '../api/more';
import type { ComplianceItem } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, Kpi, PageHeader, fmtDate } from '../components/ui';

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const todayIso = () => new Date().toISOString().slice(0, 10);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Tab = 've' | 'sub' | 'tickets' | 'docs';
const TABS: { key: Tab; label: string }[] = [
	{ key: 've', label: 'VE workers' },
	{ key: 'sub', label: 'Subcontractors' },
	{ key: 'tickets', label: 'Tickets and inductions' },
	{ key: 'docs', label: 'Company documents' },
];

/** The worst compliance state of one person's records, and how many need action (expired or expiring). */
function stateOf(items: ComplianceItem[]) {
	const act = items.filter((i) => i.status === 'Expired' || i.status === 'Expiring').length;
	const label = items.some((i) => i.status === 'Expired') ? 'Expired' : items.some((i) => i.status === 'Expiring') ? 'Expiring' : items.length ? 'Valid' : 'No records';
	return { label, act };
}

function AddPerson({ onClose }: { onClose: () => void }) {
	const create = useCreatePerson();
	const roles = useRoles();
	const { notify } = useToast();
	const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '', person_kind: 'staff', role: '' });
	const emailBad = !!f.email && !EMAIL.test(f.email);
	const needRole = f.person_kind === 'staff' && !f.role;
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				create.mutate(
					{ first_name: f.first_name.trim(), last_name: f.last_name.trim() || undefined, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined, person_kind: f.person_kind, roles: f.role ? [f.role] : undefined },
					{ onSuccess: () => { onClose(); notify('Person added'); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label><span className="toolbar__label">First name *</span><input value={f.first_name} required maxLength={100} autoComplete="off" onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
			<label><span className="toolbar__label">Last name</span><input value={f.last_name} maxLength={100} autoComplete="off" onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label>
			<label style={{ flex: '0 1 170px' }}>
				<span className="toolbar__label">Employer</span>
				<select value={f.person_kind} onChange={(e) => setF({ ...f, person_kind: e.target.value })}>
					<option value="staff">Visual Exposure</option>
					<option value="subcontractor">Subcontractor</option>
				</select>
			</label>
			{f.person_kind === 'staff' && (
				<label style={{ flex: '0 1 200px' }}>
					<span className="toolbar__label">Primary role *</span>
					<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} required>
						<option value="">Choose…</option>
						{(roles.data?.items ?? []).filter((r) => r.key !== 'admin').map((r) => <option key={r.key} value={r.key}>{roleLabel(r.key)}</option>)}
					</select>
				</label>
			)}
			<label><span className="toolbar__label">Email</span><input type="email" value={f.email} maxLength={100} autoComplete="off" spellCheck={false} aria-invalid={emailBad} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
			<label><span className="toolbar__label">Phone</span><input type="tel" value={f.phone} maxLength={30} autoComplete="off" onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
			<button className="btn" disabled={create.isPending || !f.first_name.trim() || emailBad || needRole}>{create.isPending ? 'Saving…' : 'Add person'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{emailBad && <p role="alert">Enter a valid email address.</p>}
		</form>
	);
}

function AddRecord({ onClose }: { onClose: () => void }) {
	const types = useComplianceTypes();
	const people = usePeople(true);
	const create = useCreateCompliance();
	const { notify } = useToast();
	const [f, setF] = useState({ person_id: '', type_id: '', reference_no: '', issue_date: '', expiry_date: '' });
	const type = types.data?.items.find((t) => t.id === f.type_id);
	const problem = f.issue_date > todayIso() ? 'The issue date cannot be in the future.' : f.issue_date && f.expiry_date && f.expiry_date <= f.issue_date ? 'The expiry date must be after the issue date.' : '';
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				create.mutate(
					{ person_id: f.person_id, type_id: f.type_id, reference_no: f.reference_no || undefined, issue_date: f.issue_date || undefined, expiry_date: f.expiry_date || undefined },
					{ onSuccess: () => { onClose(); notify('Record saved'); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label><span className="toolbar__label">Person</span><select value={f.person_id} required onChange={(e) => setF({ ...f, person_id: e.target.value })}><option value="">Choose…</option>{(people.data?.items ?? []).filter((p) => p.is_active !== false).map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}</select></label>
			<label><span className="toolbar__label">Ticket or induction</span><select value={f.type_id} required onChange={(e) => setF({ ...f, type_id: e.target.value })}><option value="">Choose…</option>{(types.data?.items ?? []).filter((t) => t.kind !== 'company_document').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
			<label><span className="toolbar__label">Reference</span><input value={f.reference_no} maxLength={100} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></label>
			<label><span className="toolbar__label">Issued</span><input type="date" max={todayIso()} value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></label>
			<label><span className="toolbar__label">Expires{type?.requiresExpiry ? ' *' : ''}</span><input type="date" value={f.expiry_date} required={!!type?.requiresExpiry} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></label>
			<button className="btn" disabled={create.isPending || !!problem}>{create.isPending ? 'Saving…' : 'Save'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{problem && <p role="alert">{problem}</p>}
		</form>
	);
}

/** Everyone who works with the company, with their tickets and inductions: workers, subcontractors and the companies behind them, tickets, and company documents. */
export function People() {
	const me = useMe();
	const q = usePeople(true);
	const items = useComplianceItems();
	const companies = useCompanies();
	const canAdd = me.data?.permissions.createJob ?? false; // managers; the server decides for real
	const showRate = me.data?.roles.includes('admin') ?? false;
	const [tab, setTab] = useState<Tab>('ve');
	const [activeOnly, setActiveOnly] = useState(true);
	const [text, setText] = useState('');
	const [status, setStatus] = useState('');
	const [form, setForm] = useState<'person' | 'record' | null>(null);

	const people = useMemo(() => q.data?.items ?? [], [q.data]);
	const all = useMemo(() => items.data?.items ?? [], [items.data]);
	const byPerson = useMemo(() => {
		const m = new Map<string, ComplianceItem[]>();
		for (const i of all) if (i.personId) m.set(i.personId, [...(m.get(i.personId) ?? []), i]);
		return m;
	}, [all]);
	const needle = text.trim().toLowerCase();
	const visible = people.filter((p) => (!activeOnly || p.is_active !== false) && (!needle || `${p.first_name} ${p.last_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(needle)));
	const ve = visible.filter((p) => (p as { person_kind?: string }).person_kind !== 'subcontractor');
	const subs = visible.filter((p) => (p as { person_kind?: string }).person_kind === 'subcontractor');
	const records = all.filter((i) => (tab === 'docs' ? i.kind === 'company_document' : i.kind !== 'company_document') && (!status || i.status === status) && (!needle || `${i.personName ?? i.companyName ?? ''} ${i.typeName ?? ''}`.toLowerCase().includes(needle)));
	const expired = all.filter((i) => i.status === 'Expired').length;
	const expiring = all.filter((i) => i.status === 'Expiring').length;
	const activeAll = people.filter((p) => p.is_active !== false);
	const goStatus = (s: string) => { setTab('tickets'); setStatus(s); };

	const workerTable = (list: typeof people, withRole: boolean) => (
		<div className="table-wrap">
			<table className="table">
				<caption className="sr-only">Workers</caption>
				<thead>
					<tr>
						<th scope="col">Name</th>
						{withRole && <th scope="col">Primary role</th>}
						<th scope="col">Phone</th>
						<th scope="col">Compliance</th>
						<th scope="col">To action</th>
						{showRate && <th scope="col">Hourly rate</th>}
					</tr>
				</thead>
				<tbody>
					{list.map((p) => {
						const st = stateOf(byPerson.get(p.ROWID) ?? []);
						return (
							<tr key={p.ROWID}>
								<td data-label="Name" className="cell-primary">
									<Link to={'/people/' + p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</Link>
									{p.is_active === false && <small className="sub">Inactive</small>}
								</td>
								{withRole && <td data-label="Primary role" style={{ textTransform: 'capitalize' }}>{parseRoles(p.roles).map(roleLabel)[0] || '-'}</td>}
								<td data-label="Phone">{p.phone ? <a href={`tel:${p.phone.replace(/\s+/g, '')}`}>{p.phone}</a> : '-'}</td>
								<td data-label="Compliance">{st.label === 'No records' ? <span className="muted">No records</span> : <Chip status={st.label} />}</td>
								<td data-label="To action" className="num">{st.act || '-'}</td>
								{showRate && <td data-label="Hourly rate" className="num">{p.hourly_rate ? `$${Number(p.hourly_rate).toFixed(2)}` : '-'}</td>}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);

	return (
		<>
			<PageHeader eyebrow="Team" title="People" subtitle="Workers, subcontractors, and their tickets, inductions and documents.">
				{canAdd && !form && (
					<>
						<button className="btn" onClick={() => setForm('person')}><Plus size={16} aria-hidden="true" /> Add a person</button>
						<button className="btn btn-ghost" onClick={() => setForm('record')}><Plus size={16} aria-hidden="true" /> Add a ticket</button>
					</>
				)}
			</PageHeader>

			<section className="kpis" aria-label="Summary">
				<Kpi label="VE workers" value={activeAll.filter((p) => (p as { person_kind?: string }).person_kind !== 'subcontractor').length} />
				<Kpi label="Subcontractors" value={activeAll.filter((p) => (p as { person_kind?: string }).person_kind === 'subcontractor').length} />
				<button type="button" className={'kpi kpi-btn' + (expired ? ' kpi-danger' : '')} aria-pressed={tab === 'tickets' && status === 'Expired'} onClick={() => goStatus('Expired')}>
					<span className="kpi-label">Expired</span><span className="kpi-value num">{expired}</span>
				</button>
				<button type="button" className="kpi kpi-btn" aria-pressed={tab === 'tickets' && status === 'Expiring'} onClick={() => goStatus('Expiring')}>
					<span className="kpi-label">Expiring within 30 days</span><span className="kpi-value num">{expiring}</span>
				</button>
			</section>

			<Card flush>
				{form === 'person' && canAdd && <AddPerson onClose={() => setForm(null)} />}
				{form === 'record' && canAdd && <AddRecord onClose={() => setForm(null)} />}
				<div className="list-toolbar">
					<div className="segmented" role="group" aria-label="People views">
						{TABS.map((t) => (
							<button key={t.key} className={tab === t.key ? 'on' : ''} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setStatus(''); }}>{t.label}</button>
						))}
					</div>
					<label className="search" style={{ flex: '1 1 200px', maxWidth: 320 }}>
						<Search size={16} aria-hidden="true" />
						<input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search…" aria-label="Search people" />
					</label>
					{(tab === 've' || tab === 'sub') && <label className="check"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active only</label>}
					{(tab === 'tickets' || tab === 'docs') && (
						<label>
							<span className="sr-only">Status</span>
							<select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
								<option value="">All statuses</option>
								{['Expired', 'Expiring', 'Valid', 'No expiry'].map((s) => <option key={s}>{s}</option>)}
							</select>
						</label>
					)}
				</div>

				{(q.isPending || items.isPending) && <p role="status" className="table-empty">Loading…</p>}
				{(q.isError || items.isError) && <p role="alert">Could not load people.</p>}

				{q.isSuccess && tab === 've' && (ve.length ? workerTable(ve, true) : <p className="table-empty">No workers match.</p>)}
				{q.isSuccess && tab === 'sub' && (
					<>
						{subs.length ? workerTable(subs, false) : <p className="table-empty">No subcontractors match.</p>}
						{companies.isSuccess && companies.data.items.length > 0 && (
							<div className="table-wrap" style={{ borderTop: '1px solid var(--line)' }}>
								<table className="table">
									<caption className="sr-only">Companies</caption>
									<thead><tr><th scope="col">Company</th><th scope="col">Type</th><th scope="col">State</th><th scope="col">Contact</th></tr></thead>
									<tbody>
										{companies.data.items.filter((c) => c.kind !== 'internal' && (!activeOnly || c.isActive)).map((c) => (
											<tr key={c.id}>
												<td data-label="Company" className="cell-primary"><strong>{c.name}</strong></td>
												<td data-label="Type"><Chip status={c.kind} /></td>
												<td data-label="State">{c.state || '-'}</td>
												<td data-label="Contact">{c.contactName || c.email || c.phone || '-'}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</>
				)}
				{items.isSuccess && (tab === 'tickets' || tab === 'docs') && (
					records.length ? (
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">{tab === 'docs' ? 'Company documents' : 'Tickets and inductions'}</caption>
								<thead><tr><th scope="col">{tab === 'docs' ? 'Company' : 'Person'}</th><th scope="col">Type</th><th scope="col">Reference</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead>
								<tbody>
									{records.map((i) => (
										<tr key={i.id}>
											<td data-label="Who" className="cell-primary">{i.personId ? <Link to={'/people/' + i.personId}>{i.personName}</Link> : <strong>{i.companyName ?? '-'}</strong>}</td>
											<td data-label="Type">{i.typeName ?? i.kind}</td>
											<td data-label="Reference">{i.referenceNo || '-'}</td>
											<td data-label="Expires">{fmtDate(i.expiryDate)}{i.daysLeft !== null && i.daysLeft !== undefined ? <small className="sub">{i.daysLeft < 0 ? `${Math.abs(i.daysLeft)} days ago` : `in ${i.daysLeft} days`}</small> : null}</td>
											<td data-label="Status"><Chip status={i.status} /></td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : (
						<p className="table-empty">Nothing matches.</p>
					)
				)}
			</Card>
		</>
	);
}
