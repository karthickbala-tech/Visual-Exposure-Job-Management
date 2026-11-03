import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCompanies, useMe, useRegisterWrite, useSites } from '../api/queries';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';

const KINDS = ['subcontractor', 'supplier', 'client', 'internal'] as const;

/** Companies (subcontractors, suppliers, clients) and the sites jobs are done at. */
export function Directory() {
	const me = useMe();
	const canWrite = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'install_coordinator'].includes(r));
	const [tab, setTab] = useState<'companies' | 'sites'>('companies');
	return (
		<>
			<PageHeader eyebrow="Reference data" title="Companies and sites" subtitle="Who we work with and where the work happens." />
			<div className="inline-form" role="tablist" aria-label="Directory">
				{(['companies', 'sites'] as const).map((t) => (
					<button key={t} role="tab" aria-selected={tab === t} className={'btn' + (tab === t ? '' : ' btn-ghost')} onClick={() => setTab(t)}>
						{t === 'companies' ? 'Companies' : 'Sites'}
					</button>
				))}
			</div>
			{tab === 'companies' ? <Companies canWrite={canWrite} /> : <Sites canWrite={canWrite} />}
		</>
	);
}

function Companies({ canWrite }: { canWrite: boolean }) {
	const list = useCompanies();
	const write = useRegisterWrite(['companies']);
	const { notify } = useToast();
	const empty = { name: '', kind: 'subcontractor', contact_name: '', phone: '', email: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	return (
		<Card flush>
			{canWrite && !open && (
				<div className="inline-form">
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add company
					</button>
				</div>
			)}
			{canWrite && open && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{ method: 'POST', path: '/companies', body: { name: form.name, kind: form.kind, contact_name: form.contact_name || undefined, phone: form.phone || undefined, email: form.email || undefined } },
							{
								onSuccess: () => {
									setOpen(false);
									setForm(empty);
									notify('Company added');
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">Name *</span>
						<input value={form.name} onChange={set('name')} required maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Kind</span>
						<select value={form.kind} onChange={set('kind')} style={{ width: '100%' }}>
							{KINDS.map((k) => (
								<option key={k}>{k}</option>
							))}
						</select>
					</label>
					<label>
						<span className="toolbar__label">Contact</span>
						<input value={form.contact_name} onChange={set('contact_name')} maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Phone</span>
						<input value={form.phone} onChange={set('phone')} maxLength={40} />
					</label>
					<label>
						<span className="toolbar__label">Email</span>
						<input type="email" value={form.email} onChange={set('email')} maxLength={200} />
					</label>
					<button className="btn" disabled={write.isPending}>
						{write.isPending ? 'Saving...' : 'Save'}
					</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
						Cancel
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
			)}
			{list.isPending && <p role="status" className="table-empty">Loading...</p>}
			{list.isError && <p role="alert">Could not load companies.</p>}
			{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No companies yet.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Companies</caption>
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Kind</th>
								<th scope="col">Contact</th>
								<th scope="col">Status</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((c) => (
								<tr key={c.id}>
									<td data-label="Name" className="cell-primary">
										<strong>{c.name}</strong>
									</td>
									<td data-label="Kind">
										<Chip status={c.kind} />
									</td>
									<td data-label="Contact">{[c.contactName, c.phone, c.email].filter(Boolean).join(' / ') || '-'}</td>
									<td data-label="Status">
										<Chip status={c.isActive ? 'Active' : 'Inactive'} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

function Sites({ canWrite }: { canWrite: boolean }) {
	const list = useSites();
	const write = useRegisterWrite(['sites']);
	const { notify } = useToast();
	const empty = { name: '', street: '', suburb: '', state: '', post_code: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
	return (
		<Card flush>
			{canWrite && !open && (
				<div className="inline-form">
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add site
					</button>
				</div>
			)}
			{canWrite && open && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{ method: 'POST', path: '/sites', body: { name: form.name, street: form.street || undefined, suburb: form.suburb || undefined, state: form.state || undefined, post_code: form.post_code || undefined } },
							{
								onSuccess: () => {
									setOpen(false);
									setForm(empty);
									notify('Site added');
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">Name *</span>
						<input value={form.name} onChange={set('name')} required maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Street</span>
						<input value={form.street} onChange={set('street')} maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Suburb</span>
						<input value={form.suburb} onChange={set('suburb')} maxLength={100} />
					</label>
					<label>
						<span className="toolbar__label">State</span>
						<input value={form.state} onChange={set('state')} maxLength={10} />
					</label>
					<label>
						<span className="toolbar__label">Post code</span>
						<input value={form.post_code} onChange={set('post_code')} maxLength={10} />
					</label>
					<button className="btn" disabled={write.isPending}>
						{write.isPending ? 'Saving...' : 'Save'}
					</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
						Cancel
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
			)}
			{list.isPending && <p role="status" className="table-empty">Loading...</p>}
			{list.isError && <p role="alert">Could not load sites.</p>}
			{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No sites yet.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Sites</caption>
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Address</th>
								<th scope="col">Status</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((s) => (
								<tr key={s.id}>
									<td data-label="Name" className="cell-primary">
										<strong>{s.name}</strong>
									</td>
									<td data-label="Address">{s.address || '-'}</td>
									<td data-label="Status">
										<Chip status={s.isActive ? 'Active' : 'Inactive'} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}
