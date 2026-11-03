import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRegisterWrite, useSigns } from '../api/queries';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';

const EMPTY = { name: '', revision: '', qty: '1', medium: '', finishing: '', install_date: '' };

/** The signs that make up one job: name, revision, quantity, medium, finishing and install date. */
export function SignsPanel({ jobId, canWrite }: { jobId: string; canWrite: boolean }) {
	const list = useSigns(jobId);
	const write = useRegisterWrite(['signs']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(EMPTY);
	const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

	return (
		<Card
			title="Signs"
			flush
			action={
				canWrite && !open ? (
					<button className="btn btn-ghost" onClick={() => setOpen(true)}>
						<Plus size={15} aria-hidden="true" /> Add sign
					</button>
				) : undefined
			}
		>
			{canWrite && open && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{
								method: 'POST',
								path: '/signs',
								body: {
									job_id: jobId,
									name: form.name,
									revision: form.revision || undefined,
									qty: Number(form.qty) || 1,
									medium: form.medium || undefined,
									finishing: form.finishing || undefined,
									install_date: form.install_date || undefined,
								},
							},
							{
								onSuccess: () => {
									setOpen(false);
									setForm(EMPTY);
									notify('Sign added');
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
						<span className="toolbar__label">Revision</span>
						<input value={form.revision} onChange={set('revision')} maxLength={20} />
					</label>
					<label>
						<span className="toolbar__label">Qty</span>
						<input type="number" min={1} value={form.qty} onChange={set('qty')} />
					</label>
					<label>
						<span className="toolbar__label">Medium</span>
						<input value={form.medium} onChange={set('medium')} maxLength={100} />
					</label>
					<label>
						<span className="toolbar__label">Finishing</span>
						<input value={form.finishing} onChange={set('finishing')} maxLength={100} />
					</label>
					<label>
						<span className="toolbar__label">Install date</span>
						<input type="date" value={form.install_date} onChange={set('install_date')} />
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
			{list.isError && <p role="alert">Could not load signs.</p>}
			{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No signs on this job yet.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Signs on this job</caption>
						<thead>
							<tr>
								<th scope="col">Sign</th>
								<th scope="col">Rev</th>
								<th scope="col">Qty</th>
								<th scope="col">Medium</th>
								<th scope="col">Finishing</th>
								<th scope="col">Install date</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((s) => (
								<tr key={s.id}>
									<td data-label="Sign" className="cell-primary">
										<strong>{s.name}</strong>
									</td>
									<td data-label="Rev">{s.revision || '-'}</td>
									<td data-label="Qty" className="num">{s.qty}</td>
									<td data-label="Medium">{s.medium || '-'}</td>
									<td data-label="Finishing">{s.finishing || '-'}</td>
									<td data-label="Install date">{s.installDate ?? '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}
