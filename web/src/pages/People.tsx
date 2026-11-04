import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useMe, usePeople } from '../api/queries';
import { useCreatePerson } from '../api/more';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};
const EMPTY = { first_name: '', last_name: '', email: '', phone: '', person_kind: 'staff' };

/** Everyone who works with the company. Pay rates are shown to administrators only (the server decides). */
export function People() {
	const me = useMe();
	const q = usePeople(true);
	const showRate = me.data?.roles.includes('admin') ?? false;
	const canAdd = me.data?.permissions.createJob ?? false; // managers; the server decides for real
	const create = useCreatePerson();
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [f, setF] = useState(EMPTY);

	return (
		<>
			<PageHeader eyebrow="Team" title="People" subtitle="Staff and subcontractors who work on jobs.">
				{canAdd && !open && (
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add a person
					</button>
				)}
			</PageHeader>
			<Card flush>
				{canAdd && open && (
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							create.mutate(
								{ first_name: f.first_name.trim(), last_name: f.last_name.trim() || undefined, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined, person_kind: f.person_kind },
								{
									onSuccess: () => {
										setOpen(false);
										setF(EMPTY);
										notify('Person added');
									},
									onError: (er) => notify(er instanceof Error ? er.message : 'Could not add the person', 'error'),
								},
							);
						}}
					>
						<label><span className="toolbar__label">First name</span><input value={f.first_name} required maxLength={100} autoComplete="off" onChange={(e) => setF({ ...f, first_name: e.target.value })} /></label>
						<label><span className="toolbar__label">Last name</span><input value={f.last_name} maxLength={100} autoComplete="off" onChange={(e) => setF({ ...f, last_name: e.target.value })} /></label>
						<label><span className="toolbar__label">Email</span><input type="email" value={f.email} maxLength={100} autoComplete="off" spellCheck={false} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
						<label><span className="toolbar__label">Phone</span><input type="tel" value={f.phone} maxLength={30} autoComplete="off" onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
						<label style={{ flex: '0 1 170px' }}>
							<span className="toolbar__label">Type</span>
							<select value={f.person_kind} onChange={(e) => setF({ ...f, person_kind: e.target.value })}>
								<option value="staff">Staff</option>
								<option value="subcontractor">Subcontractor</option>
							</select>
						</label>
						<button className="btn" disabled={create.isPending || !f.first_name.trim()}>{create.isPending ? 'Saving…' : 'Add person'}</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
					</form>
				)}
				{q.isPending && <p role="status" className="table-empty">Loading…</p>}
				{q.isError && <p role="alert">Could not load people.</p>}
				{q.isSuccess && q.data.items.length === 0 && <p className="table-empty">No people yet.</p>}
				{q.isSuccess && q.data.items.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">People</caption>
							<thead>
								<tr>
									<th scope="col">Name</th>
									<th scope="col">Roles</th>
									<th scope="col">Email</th>
									<th scope="col">Status</th>
									{showRate && <th scope="col">Hourly rate</th>}
								</tr>
							</thead>
							<tbody>
								{q.data.items.map((p) => (
									<tr key={p.ROWID}>
										<td data-label="Name" className="cell-primary">
											<Link to={'/people/' + p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</Link>
										</td>
										<td data-label="Roles" style={{ textTransform: 'capitalize' }}>
											{parseRoles(p.roles).map(roleLabel).join(', ') || '-'}
										</td>
										<td data-label="Email">{p.email || '-'}</td>
										<td data-label="Status">
											<Chip status={p.is_active === false ? 'Inactive' : 'Active'} />
										</td>
										{showRate && <td data-label="Hourly rate">{p.hourly_rate ? `$${Number(p.hourly_rate).toFixed(2)}` : '-'}</td>}
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
