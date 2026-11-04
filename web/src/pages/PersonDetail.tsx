import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePerson, usePersonCompliance, useRatings } from '../api/more';
import { ApiError } from '../api/client';
import { Chip } from '../components/Chip';
import { Card, PageHeader, fmtDate } from '../components/ui';

const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};
const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** One person: contact details, their rating from site managers, and their tickets and inductions. */
export function PersonDetail() {
	const { id } = useParams();
	const q = usePerson(id);
	const ratings = useRatings(id);
	const comp = usePersonCompliance(id);

	if (q.isPending) return <p role="status">Loading…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) return <h1 className="page-title">Person not found</h1>;
	if (q.isError) return <p role="alert">Could not load this person.</p>;
	const p = q.data.person;
	const name = `${p.first_name} ${p.last_name ?? ''}`.trim();

	return (
		<>
			<Link className="back-link" to="/people"><ArrowLeft size={16} aria-hidden="true" /> All people</Link>
			<PageHeader eyebrow={p.person_kind === 'subcontractor' ? 'Subcontractor' : 'Staff'} title={name}>
				<Chip status={p.is_active === false ? 'Inactive' : 'Active'} />
			</PageHeader>

			<Card title="Details">
				<dl className="facts">
					<div className="fact"><dt>Email</dt><dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '-'}</dd></div>
					<div className="fact"><dt>Phone</dt><dd>{p.phone ? <a href={`tel:${p.phone.replace(/\s+/g, '')}`}>{p.phone}</a> : '-'}</dd></div>
					<div className="fact"><dt>Job title</dt><dd>{p.job_title || '-'}</dd></div>
					<div className="fact"><dt>Roles</dt><dd style={{ textTransform: 'capitalize' }}>{parseRoles(p.roles).map((r) => r.replace(/_/g, ' ')).join(', ') || '-'}</dd></div>
				</dl>
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

				<Card title="Tickets and inductions" flush>
					{comp.isPending && <p role="status" className="table-empty">Loading…</p>}
					{comp.isError && <p role="alert">Could not load tickets.</p>}
					{comp.isSuccess && comp.data.items.length === 0 && <p className="table-empty">Nothing recorded.</p>}
					{comp.isSuccess && comp.data.items.length > 0 && (
						<div className="table-wrap">
							<table className="table">
								<caption className="sr-only">Tickets and inductions</caption>
								<thead><tr><th scope="col">Type</th><th scope="col">Expires</th><th scope="col">Status</th></tr></thead>
								<tbody>
									{comp.data.items.map((c) => (
										<tr key={c.id}>
											<td data-label="Type" className="cell-primary"><strong>{c.typeName ?? 'Record'}</strong>{c.referenceNo && <><br /><small>{c.referenceNo}</small></>}</td>
											<td data-label="Expires">{fmtDate(c.expiryDate)}</td>
											<td data-label="Status"><Chip status={c.status} /></td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</Card>
			</div>
		</>
	);
}
