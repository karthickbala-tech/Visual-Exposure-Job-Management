import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useComplianceTypes, useRegisterWrite } from '../api/queries';
import type { ComplianceType } from '../api/types';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';

const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const KINDS: [string, string][] = [['ticket', 'Ticket'], ['induction', 'Induction'], ['company_document', 'Company document']];
const kindLabel = (k: string) => KINDS.find(([v]) => v === k)?.[1] ?? k;
const EMPTY = { name: '', kind: 'ticket', requiresExpiry: true, mandatory: false, days: '' };
type Form = typeof EMPTY;

/** "60, 30, 14, 0" as whole days, or a message. Blank means the type follows the Admin setting. */
function parseDays(text: string): number[] | string {
	const parts = text.split(',').map((d) => d.trim()).filter(Boolean);
	const days = parts.map(Number);
	if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 365)) return 'Reminder days must be whole numbers from 0 to 365, like 60, 30, 14, 0.';
	if (days.length > 8) return 'Use at most 8 reminder days.';
	return days;
}

/**
 * Ticket, induction and company document types (FSD CMP-1, 5.14): what each record is, whether it expires, whether workers
 * must have it, and when reminders go out. Administrators only (the server checks it too).
 */
export function ComplianceTypesTab() {
	const list = useComplianceTypes();
	const write = useRegisterWrite(['compliance-types']);
	const seed = useRegisterWrite(['compliance-types']);
	const { notify } = useToast();
	// null: no form open; 'new': adding; a type: editing it.
	const [open, setOpen] = useState<'new' | ComplianceType | null>(null);
	const [form, setForm] = useState<Form>(EMPTY);
	const editing = open && open !== 'new' ? open : null;
	const days = parseDays(form.days);
	const problem = typeof days === 'string' ? days : '';
	const items = list.data?.items ?? [];

	const startEdit = (t: ComplianceType) => {
		setForm({ name: t.name, kind: t.kind, requiresExpiry: t.requiresExpiry, mandatory: t.mandatory, days: (t.ownOffsets ?? []).join(', ') });
		setOpen(t);
	};
	const close = () => { setOpen(null); setForm(EMPTY); };

	return (
		<Card
			title="Compliance types"
			flush
			action={!open ? <button className="btn btn-ghost btn-sm" onClick={() => { setForm(EMPTY); setOpen('new'); }}><Plus size={14} aria-hidden="true" /> Add type</button> : undefined}
		>
			<p className="lead card-note">
				The tickets, inductions and company documents the app tracks. Reminder days are how many days before expiry the reminders go out; leave them blank to use the
				Admin setting.
			</p>
			{open && (
				<Dialog title={editing ? `Edit type: ${editing.name}` : 'Add a compliance type'} onClose={close}>
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							if (typeof days === 'string') return;
							const body = { name: form.name.trim(), compliance_kind: form.kind, requires_expiry: form.requiresExpiry, is_mandatory_type: form.mandatory, reminder_offsets: days };
							write.mutate(editing ? { method: 'PATCH', path: '/compliance/types/' + editing.id, body } : { method: 'POST', path: '/compliance/types', body }, {
								onSuccess: () => { close(); notify(editing ? 'Type saved' : 'Type added'); },
								onError: (er) => notify(errText(er), 'error'),
							});
						}}
					>
						<label><span className="toolbar__label">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} /></label>
						<label>
							<span className="toolbar__label">Kind</span>
							<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
						</label>
						<label><span className="toolbar__label">Reminder days before expiry</span><input value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} placeholder="Blank: the Admin setting" /></label>
						<label className="check" style={{ flex: '0 1 auto' }}><input type="checkbox" checked={form.requiresExpiry} onChange={(e) => setForm({ ...form, requiresExpiry: e.target.checked })} /> Has an expiry date</label>
						<label className="check" style={{ flex: '0 1 auto' }}><input type="checkbox" checked={form.mandatory} onChange={(e) => setForm({ ...form, mandatory: e.target.checked })} /> Required</label>
						<button className="btn" disabled={write.isPending || !!problem || !form.name.trim()}>{write.isPending ? 'Saving…' : editing ? 'Save' : 'Add'}</button>
						<button type="button" className="btn btn-ghost" onClick={close}>Cancel</button>
						{problem && <p role="alert">{problem}</p>}
					</form>
				</Dialog>
			)}
			{list.isPending && <p role="status" className="table-empty">Loading…</p>}
			{list.isError && <p role="alert">Could not load the compliance types.</p>}
			{list.isSuccess && items.length === 0 && <p className="table-empty">No compliance types yet. Add one, or load the starter list below.</p>}
			{items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Compliance types</caption>
						<thead>
							<tr><th scope="col">Name</th><th scope="col">Kind</th><th scope="col">Expires</th><th scope="col">Required</th><th scope="col">Reminder days</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
						</thead>
						<tbody>
							{items.map((t) => (
								<tr key={t.id}>
									<td data-label="Name" className="cell-primary"><strong>{t.name}</strong></td>
									<td data-label="Kind">{kindLabel(t.kind)}</td>
									<td data-label="Expires">{t.requiresExpiry ? 'Yes' : 'No'}</td>
									<td data-label="Required">{t.mandatory ? 'Yes' : 'No'}</td>
									<td data-label="Reminder days">{t.ownOffsets && t.ownOffsets.length ? t.ownOffsets.join(', ') : <span className="muted">Admin setting</span>}</td>
									<td data-label=""><button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(t)} aria-label={`Edit ${t.name}`}>Edit</button></td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<div className="inline-form" style={{ background: 'transparent', border: 0 }}>
				<button
					type="button"
					className="btn btn-ghost btn-sm"
					disabled={seed.isPending}
					onClick={() => seed.mutate({ method: 'POST', path: '/admin/seed-compliance-types' }, {
						onSuccess: (r) => {
							const out = r as { added?: string[]; repaired?: string[] };
							notify(`${out.added?.length ?? 0} starter types added${out.repaired?.length ? `, ${out.repaired.length} repaired` : ''}`);
						},
						onError: (er) => notify(errText(er), 'error'),
					})}
				>
					Load the starter types
				</button>
				<span className="muted">Adds any missing starter types and repairs older ones. Safe to run again.</span>
			</div>
		</Card>
	);
}
