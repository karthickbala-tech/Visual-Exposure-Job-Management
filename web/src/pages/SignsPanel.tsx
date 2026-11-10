import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRegisterWrite, useSigns } from '../api/queries';
import { SIGN_STAGES } from '../lib/names';
import { useToast } from '../components/toast';
import { Card, fmtDate } from '../components/ui';

const EMPTY = { name: '', revision: '', sign_number: '', qty: '1', medium: '', finishing: '', deal_stage: '', artwork_stage: '', manufacturing_stage: '', install_stage: '', install_date: '' };
type Form = typeof EMPTY;

/** The signs of one job, with the names of the old Creator form: Sign Name, Version Number, the four stages and the install date. */
export function SignsPanel({ jobId, canWrite }: { jobId: string; canWrite: boolean }) {
	const list = useSigns(jobId);
	const write = useRegisterWrite(['signs']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState<Form>(EMPTY);
	const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	const stage = (label: string, k: keyof Form, values: readonly string[]) => (
		<label>
			<span className="toolbar__label">{label}</span>
			<select value={form[k]} onChange={set(k)}><option value="">Not set</option>{values.map((v) => <option key={v}>{v}</option>)}</select>
		</label>
	);
	const items = list.data?.items ?? [];

	return (
		<Card
			title="Signs in this job"
			flush
			action={canWrite && !open ? <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}><Plus size={14} aria-hidden="true" /> Add Sign</button> : undefined}
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
									sign_number: form.sign_number || undefined,
									qty: Number(form.qty) || 1,
									medium: form.medium || undefined,
									finishing: form.finishing || undefined,
									deal_stage: form.deal_stage || undefined,
									artwork_stage: form.artwork_stage || undefined,
									manufacturing_stage: form.manufacturing_stage || undefined,
									install_stage: form.install_stage || undefined,
									install_date: form.install_date || undefined,
								},
							},
							{ onSuccess: () => { setOpen(false); setForm(EMPTY); notify('Sign added'); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not add the sign', 'error') },
						);
					}}
				>
					<label><span className="toolbar__label">Sign Name *</span><input value={form.name} onChange={set('name')} required maxLength={200} /></label>
					<label><span className="toolbar__label">Version Number</span><input value={form.revision} onChange={set('revision')} maxLength={30} /></label>
					<label><span className="toolbar__label">Sign Number</span><input value={form.sign_number} onChange={set('sign_number')} maxLength={30} /></label>
					<label><span className="toolbar__label">Qty</span><input type="number" min={1} value={form.qty} onChange={set('qty')} /></label>
					<label><span className="toolbar__label">Sign Medium Used</span><input value={form.medium} onChange={set('medium')} maxLength={100} /></label>
					<label><span className="toolbar__label">Finishing Details</span><input value={form.finishing} onChange={set('finishing')} maxLength={100} /></label>
					{stage('Sign - Deal Stage', 'deal_stage', SIGN_STAGES.deal)}
					{stage('Sign - Artwork Stage', 'artwork_stage', SIGN_STAGES.artwork)}
					{stage('Sign - Manufacturing Stage', 'manufacturing_stage', SIGN_STAGES.manufacturing)}
					{stage('Install Stage', 'install_stage', SIGN_STAGES.install)}
					<label><span className="toolbar__label">Proposed Install Date</span><input type="date" value={form.install_date} onChange={set('install_date')} /></label>
					<button className="btn" disabled={write.isPending}>{write.isPending ? 'Saving…' : 'Submit'}</button>
					<button type="button" className="btn btn-ghost" onClick={() => setForm(EMPTY)}>Reset</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
				</form>
			)}
			{list.isPending && <p role="status" className="table-empty">Loading…</p>}
			{list.isError && <p role="alert">Could not load signs.</p>}
			{list.isSuccess && items.length === 0 && <p className="table-empty">No Data Available</p>}
			{list.isSuccess && items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Signs in this job</caption>
						<thead>
							<tr>
								<th scope="col">Sign Name</th>
								<th scope="col">Version Number</th>
								<th scope="col">Sign Number</th>
								<th scope="col" className="num">Qty</th>
								<th scope="col">Sign - Deal Stage</th>
								<th scope="col">Sign - Artwork Stage</th>
								<th scope="col">Sign - Manufacturing Stage</th>
								<th scope="col">Install Stage</th>
								<th scope="col">Proposed Install Date</th>
							</tr>
						</thead>
						<tbody>
							{items.map((s) => (
								<tr key={s.id}>
									<td data-label="Sign Name" className="cell-primary"><strong>{s.name}</strong></td>
									<td data-label="Version Number">{s.revision || '-'}</td>
									<td data-label="Sign Number">{s.signNumber || '-'}</td>
									<td data-label="Qty" className="num">{s.qty}</td>
									<td data-label="Sign - Deal Stage">{s.dealStage || '-'}</td>
									<td data-label="Sign - Artwork Stage">{s.artworkStage || '-'}</td>
									<td data-label="Sign - Manufacturing Stage">{s.manufacturingStage || '-'}</td>
									<td data-label="Install Stage">{s.installStage || '-'}</td>
									<td data-label="Proposed Install Date">{s.installDate ? fmtDate(s.installDate) : '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<p className="grid-foot">Showing {items.length} of {items.length}</p>
		</Card>
	);
}
