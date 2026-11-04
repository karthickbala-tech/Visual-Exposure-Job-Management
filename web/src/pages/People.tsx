import { useMe, usePeople } from '../api/queries';
import { Chip } from '../components/Chip';
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

/** Everyone who works with the company. Pay rates are shown to administrators only (the server decides). */
export function People() {
	const me = useMe();
	const q = usePeople(true);
	const showRate = me.data?.roles.includes('admin') ?? false;

	return (
		<>
			<PageHeader eyebrow="Team" title="People" subtitle="Staff and subcontractors who work on jobs." />
			<Card flush>
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
											<strong>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</strong>
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
