import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useComplianceItems, useComplianceTypes, useCreateCompliance, useMe, usePeople } from '../api/queries';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, Kpi, PageHeader } from '../components/ui';
import { useComplianceDashboard } from '../api/more';

const KIND_LABEL: Record<string, string> = { ticket: 'Tickets', induction: 'Inductions', company_document: 'Company documents' };

const STATUSES = ['Expired', 'Expiring', 'Valid', 'No expiry'];
const EMPTY = { person_id: '', type_id: '', reference_no: '', expiry_date: '' };

/** Tickets, inductions and documents with their expiry, soonest first. Crew see only their own. */
export function Compliance() {
	const me = useMe();
	const canAdd = !!me.data?.permissions.createJob; // managers; the server decides for real
	const [status, setStatus] = useState('');
	const [activeOnly, setActiveOnly] = useState(true);
	const dash = useComplianceDashboard(activeOnly, canAdd);
	const items = useComplianceItems(status || undefined);
	const types = useComplianceTypes();
	const people = usePeople(canAdd);
	const create = useCreateCompliance();
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	const type = types.data?.items.find((t) => t.id === form.type_id);

	return (
		<>
			<PageHeader eyebrow="Workers and subcontractors" title="Compliance" subtitle="Tickets, inductions and documents, with expiry dates and reminders.">
				{canAdd && !open && (
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add a ticket or document
					</button>
				)}
			</PageHeader>

			{canAdd && dash.isSuccess && (
				<>
					<section className="kpis" aria-label="Expiry overview">
						{(Object.entries(dash.data.counts) as [string, { overdue: number; today: number; within30: number }][]).map(([kind, c]) => (
							<Kpi key={kind} label={`${KIND_LABEL[kind] ?? kind} overdue`} value={c.overdue} tone={c.overdue ? 'danger' : 'ok'} note={`${c.today} expire today, ${c.within30} within 30 days`} />
						))}
						<Kpi label="Active workers" value={dash.data.workers.ve + dash.data.workers.other} note={`${dash.data.workers.ve} Visual Exposure, ${dash.data.workers.other} others`} />
					</section>
					<label className="check"><input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} /> Active records only</label>
				</>
			)}

			<Card flush>
				{canAdd && open && (
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							create.mutate(
								{ person_id: form.person_id, type_id: form.type_id, reference_no: form.reference_no || undefined, expiry_date: form.expiry_date || undefined },
								{
									onSuccess: () => {
										setOpen(false);
										setForm(EMPTY);
										notify('Record saved');
									},
								},
							);
						}}
					>
						<label>
							<span className="toolbar__label">Person</span>
							<select value={form.person_id} onChange={set('person_id')} required style={{ width: '100%' }}>
								<option value="">Choose...</option>
								{people.data?.items.map((p) => (
									<option key={p.ROWID} value={p.ROWID}>
										{`${p.first_name} ${p.last_name ?? ''}`.trim()}
									</option>
								))}
							</select>
						</label>
						<label>
							<span className="toolbar__label">Type</span>
							<select value={form.type_id} onChange={set('type_id')} required style={{ width: '100%' }}>
								<option value="">Choose...</option>
								{types.data?.items.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</select>
						</label>
						<label>
							<span className="toolbar__label">Reference no.</span>
							<input value={form.reference_no} onChange={set('reference_no')} maxLength={100} />
						</label>
						<label>
							<span className="toolbar__label">Expiry date{type?.requiresExpiry ? ' *' : ''}</span>
							<input type="date" value={form.expiry_date} onChange={set('expiry_date')} required={!!type?.requiresExpiry} />
						</label>
						<button className="btn" disabled={create.isPending}>
							{create.isPending ? 'Saving...' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{create.isError && <p role="alert">{create.error.message}</p>}
					</form>
				)}

				<div className="inline-form">
					<label style={{ flex: '0 1 200px' }}>
						<span className="toolbar__label">Status</span>
						<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
							<option value="">All</option>
							{STATUSES.map((s) => (
								<option key={s}>{s}</option>
							))}
						</select>
					</label>
				</div>

				{items.isPending && <p role="status" className="table-empty">Loading...</p>}
				{items.isError && <p role="alert">Could not load compliance records.</p>}
				{items.isSuccess && items.data.items.length === 0 && <p className="table-empty">No records to show.</p>}
				{items.isSuccess && items.data.items.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">Compliance records</caption>
							<thead>
								<tr>
									<th scope="col">Person</th>
									<th scope="col">Type</th>
									<th scope="col">Reference</th>
									<th scope="col">Expires</th>
									<th scope="col">Status</th>
								</tr>
							</thead>
							<tbody>
								{items.data.items.map((i) => (
									<tr key={i.id}>
										<td data-label="Person" className="cell-primary">
											<strong>{i.personName ?? '-'}</strong>
										</td>
										<td data-label="Type">{i.typeName ?? i.kind}</td>
										<td data-label="Reference">{i.referenceNo || '-'}</td>
										<td data-label="Expires">
											{i.expiryDate ? `${i.expiryDate}${i.daysLeft !== null ? ` (${i.daysLeft < 0 ? Math.abs(i.daysLeft) + ' days ago' : i.daysLeft + ' days'})` : ''}` : '-'}
										</td>
										<td data-label="Status">
											<Chip status={i.status} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
