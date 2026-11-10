import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCompanies, useComplianceItems, useComplianceTypes, useCreateCompliance, useMe, usePeople } from '../api/queries';
import type { ComplianceItem } from '../api/types';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, Kpi, PageHeader, fmtDate } from '../components/ui';
import { useComplianceDashboard } from '../api/more';
import { ListToolbar, ListToolbarButtons } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn } from '../components/GridKit';

const KIND_LABEL: Record<string, string> = { ticket: 'Tickets', induction: 'Inductions', company_document: 'Company documents' };

const STATUSES = ['Expired', 'Expiring', 'Valid', 'No expiry'];
const EMPTY = { person_id: '', company_id: '', type_id: '', reference_no: '', expiry_date: '' };

const COLUMNS: GridColumn<ComplianceItem>[] = [
	{ key: 'person', label: 'Person or company', width: 220, cell: (i) => <strong>{i.personName ?? i.companyName ?? '-'}</strong> },
	{ key: 'type', label: 'Type', width: 200, cell: (i) => i.typeName ?? i.kind },
	{ key: 'ref', label: 'Reference', width: 160, cell: (i) => i.referenceNo || '-' },
	{ key: 'expires', label: 'Expires', width: 220, cell: (i) => (i.expiryDate ? `${fmtDate(i.expiryDate)}${i.daysLeft !== null ? ` (${i.daysLeft < 0 ? Math.abs(i.daysLeft) + ' days ago' : i.daysLeft + ' days'})` : ''}` : '-') },
	{ key: 'status', label: 'Status', width: 130, cell: (i) => <Chip status={i.status} /> },
];
const WIDTHS = gridWidths(COLUMNS);

/** Tickets, inductions and documents with their expiry, soonest first. Crew see only their own. */
export function Compliance() {
	const me = useMe();
	const canAdd = !!me.data?.permissions.createJob; // managers; the server decides for real
	const [status, setStatus] = useState('');
	const [panelOpen, setPanelOpen] = useState(false);
	const [draftStatus, setDraftStatus] = useState('');
	const grid = useGridLayout('ve.grid.compliance', WIDTHS);
	const [activeOnly, setActiveOnly] = useState(true);
	const dash = useComplianceDashboard(activeOnly, canAdd);
	const items = useComplianceItems(status || undefined);
	const types = useComplianceTypes();
	const people = usePeople(canAdd);
	const companies = useCompanies();
	const create = useCreateCompliance();
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [forCompany, setForCompany] = useState(false); // a company document belongs to a company; tickets and inductions to a person
	const [form, setForm] = useState(EMPTY);
	const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	const type = types.data?.items.find((t) => t.id === form.type_id);
	const typeChoices = (types.data?.items ?? []).filter((t) => (t.kind === 'company_document') === forCompany);
	const searchActive = !!status;
	const openPanel = () => { setDraftStatus(status); setPanelOpen(true); };
	const applyPanel = () => { setStatus(draftStatus); setPanelOpen(false); };
	const clearDraft = () => setDraftStatus('');
	const clearAll = () => setStatus('');
	const chips: ActiveChip[] = status ? [{ key: 'status', label: `Status: ${status}`, onRemove: () => setStatus('') }] : [];

	return (
		<>
			<PageHeader eyebrow="Workers and subcontractors" title="Compliance" subtitle="Tickets, inductions and documents, with expiry dates and reminders.">
				<ListToolbarButtons
					searchOpen={panelOpen}
					onSearchOpen={openPanel}
					searchActive={searchActive}
					viewOptions={(
						<>
							<p className="filter-pop__title">Row height</p>
							<RowHeightPicker value={grid.rows} onChange={grid.setRows} />
							<div className="filter-pop__actions">
								<button type="button" className="btn btn-ghost btn-sm" onClick={grid.reset}>Reset widths</button>
							</div>
						</>
					)}
				/>
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
					<Dialog title="Add a ticket or document" onClose={() => setOpen(false)}>
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							create.mutate(
								{ ...(forCompany ? { company_id: form.company_id } : { person_id: form.person_id }), type_id: form.type_id, reference_no: form.reference_no || undefined, expiry_date: form.expiry_date || undefined },
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
						<div className="segmented" role="group" aria-label="This record is for" style={{ alignSelf: 'end' }}>
							<button type="button" className={!forCompany ? 'on' : ''} aria-pressed={!forCompany} onClick={() => { setForCompany(false); setForm({ ...form, type_id: '' }); }}>Person</button>
							<button type="button" className={forCompany ? 'on' : ''} aria-pressed={forCompany} onClick={() => { setForCompany(true); setForm({ ...form, type_id: '' }); }}>Company</button>
						</div>
						{forCompany ? (
							<label>
								<span className="toolbar__label">Company</span>
								<select value={form.company_id} onChange={set('company_id')} required style={{ width: '100%' }}>
									<option value="">Choose…</option>
									{companies.data?.items.map((c) => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
							</label>
						) : (
							<label>
								<span className="toolbar__label">Person</span>
								<select value={form.person_id} onChange={set('person_id')} required style={{ width: '100%' }}>
									<option value="">Choose…</option>
									{people.data?.items.map((p) => (
										<option key={p.ROWID} value={p.ROWID}>
											{`${p.first_name} ${p.last_name ?? ''}`.trim()}
										</option>
									))}
								</select>
							</label>
						)}
						<label>
							<span className="toolbar__label">Type</span>
							<select value={form.type_id} onChange={set('type_id')} required style={{ width: '100%' }}>
								<option value="">Choose…</option>
								{typeChoices.map((t) => (
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
							{create.isPending ? 'Saving…' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{create.isError && <p role="alert">{create.error.message}</p>}
					</form>
					</Dialog>
				)}

				<ListToolbar
					label="Compliance list"
					searchOpen={panelOpen}
					panelTitle="Search compliance"
					onPanelClose={() => setPanelOpen(false)}
					onPanelApply={applyPanel}
					onPanelClear={clearDraft}
					panelBody={(
						<div className="lt-form">
							<span className="toolbar__label">Status</span>
							<select aria-label="Status" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
								<option value="">All</option>
								{STATUSES.map((s) => <option key={s}>{s}</option>)}
							</select>
						</div>
					)}
					chips={chips}
					onClearAll={clearAll}
				/>

				{items.isPending && <p role="status" className="table-empty">Loading…</p>}
				{items.isError && <p role="alert">Could not load compliance records.</p>}
				{items.isSuccess && items.data.items.length === 0 && <p className="table-empty">No records to show.</p>}
				{items.isSuccess && items.data.items.length > 0 && (
					<ResizableGrid layout={grid} label="Compliance records" columns={COLUMNS} rows={items.data.items} rowKey={(i) => i.id} />
				)}
			</Card>
			{items.isSuccess && <GridStatusBar text={`Showing ${items.data.items.length} of ${items.data.items.length}`} />}
		</>
	);
}
