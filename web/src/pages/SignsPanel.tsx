import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useRegisterWrite, useSigns } from '../api/queries';
import type { SignItem } from '../api/types';
import { SIGN_STAGES } from '../lib/names';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, fmtDate } from '../components/ui';

const EMPTY = { name: '', revision: '', sign_number: '', qty: '1', medium: '', finishing: '', deal_stage: '', artwork_stage: '', manufacturing_stage: '', install_stage: '', install_date: '' };
type Form = typeof EMPTY;
const STAGE_KEYS = ['deal_stage', 'artwork_stage', 'manufacturing_stage', 'install_stage'] as const;

/** A sign as the form holds it, so Edit opens with the saved values. */
const toForm = (s: SignItem): Form => ({
	name: s.name,
	revision: s.revision ?? '',
	sign_number: s.signNumber ?? '',
	qty: String(s.qty ?? 1),
	medium: s.medium ?? '',
	finishing: s.finishing ?? '',
	deal_stage: s.dealStage ?? '',
	artwork_stage: s.artworkStage ?? '',
	manufacturing_stage: s.manufacturingStage ?? '',
	install_stage: s.installStage ?? '',
	install_date: s.installDate ? s.installDate.slice(0, 10) : '',
});

/**
 * The request body. Adding leaves empty fields out. Editing sends text as typed (so a field can be cleared) and clears the
 * date with null; a stage left on "Not set" is not sent, because the server only accepts the listed stage values.
 */
function toBody(form: Form, editing: boolean) {
	const text = (v: string) => (editing ? v : v || undefined);
	const body: Record<string, unknown> = {
		name: form.name,
		revision: text(form.revision),
		sign_number: text(form.sign_number),
		qty: Number(form.qty) || 1,
		medium: text(form.medium),
		finishing: text(form.finishing),
		install_date: form.install_date || (editing ? null : undefined),
	};
	for (const k of STAGE_KEYS) if (form[k]) body[k] = form[k];
	return body;
}

/** The signs of one job, with the names of the old Creator form: Sign Name, Version Number, the four stages and the install date. */
export function SignsPanel({ jobId, canWrite }: { jobId: string; canWrite: boolean }) {
	const list = useSigns(jobId);
	const write = useRegisterWrite(['signs']);
	const { notify } = useToast();
	// null: no form open; 'new': adding; a sign: editing that sign.
	const [open, setOpen] = useState<'new' | SignItem | null>(null);
	const [form, setForm] = useState<Form>(EMPTY);
	const editing = open !== null && open !== 'new' ? open : null;
	const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	const stage = (label: string, k: keyof Form, values: readonly string[]) => (
		<label>
			<span className="toolbar__label">{label}</span>
			<select value={form[k]} onChange={set(k)}>
				{/* A saved stage cannot be cleared on the server, so "Not set" is only offered while the stage is still empty. */}
				{!(editing && toForm(editing)[k]) && <option value="">Not set</option>}
				{values.map((v) => <option key={v}>{v}</option>)}
			</select>
		</label>
	);
	const startAdd = () => { setForm(EMPTY); setOpen('new'); };
	const startEdit = (s: SignItem) => { setForm(toForm(s)); setOpen(s); };
	const close = () => setOpen(null);
	const items = list.data?.items ?? [];

	return (
		<Card
			tone="sign"
			title="Signs in this job"
			flush
			action={canWrite && !open ? <button className="btn btn-ghost btn-sm" onClick={startAdd}><Plus size={14} aria-hidden="true" /> Add Sign</button> : undefined}
		>
			{canWrite && open && (
				<Dialog title={editing ? `Edit sign: ${editing.name}` : 'Add a sign'} onClose={close}>
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							editing
								? { method: 'PATCH', path: '/signs/' + editing.id, body: toBody(form, true) }
								: { method: 'POST', path: '/signs', body: { job_id: jobId, ...toBody(form, false) } },
							{
								onSuccess: () => { close(); setForm(EMPTY); notify(editing ? 'Sign saved' : 'Sign added'); },
								onError: (er) => notify(er instanceof Error ? er.message : editing ? 'Could not save the sign' : 'Could not add the sign', 'error'),
							},
						);
					}}
				>
					<label><span className="toolbar__label">Sign Name *</span><input value={form.name} onChange={set('name')} required maxLength={200} /></label>
					<label><span className="toolbar__label">Version Number</span><input value={form.revision} onChange={set('revision')} maxLength={20} /></label>
					<label><span className="toolbar__label">Sign Number</span><input value={form.sign_number} onChange={set('sign_number')} maxLength={30} /></label>
					<label><span className="toolbar__label">Qty</span><input type="number" min={1} value={form.qty} onChange={set('qty')} /></label>
					<label><span className="toolbar__label">Sign Medium Used</span><input value={form.medium} onChange={set('medium')} maxLength={100} /></label>
					<label><span className="toolbar__label">Finishing Details</span><input value={form.finishing} onChange={set('finishing')} maxLength={100} /></label>
					{stage('Sign - Deal Stage', 'deal_stage', SIGN_STAGES.deal)}
					{stage('Sign - Artwork Stage', 'artwork_stage', SIGN_STAGES.artwork)}
					{stage('Sign - Manufacturing Stage', 'manufacturing_stage', SIGN_STAGES.manufacturing)}
					{stage('Install Stage', 'install_stage', SIGN_STAGES.install)}
					<label><span className="toolbar__label">Proposed Install Date</span><input type="date" value={form.install_date} onChange={set('install_date')} /></label>
					<button className="btn" disabled={write.isPending}>{write.isPending ? 'Saving…' : editing ? 'Save' : 'Submit'}</button>
					<button type="button" className="btn btn-ghost" onClick={() => setForm(editing ? toForm(editing) : EMPTY)}>Reset</button>
					<button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
				</form>
				</Dialog>
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
								{canWrite && <th scope="col"><span className="sr-only">Actions</span></th>}
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
									{canWrite && (
										<td data-label="">
											<button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(s)} aria-label={`Edit sign ${s.name}`}>Edit</button>
										</td>
									)}
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
