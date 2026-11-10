import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCompanies, useMe, useRegisterWrite, useSites } from '../api/queries';
import type { CompanyItem, SiteItem } from '../api/types';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn, GridLayout } from '../components/GridKit';

/** The state list of the Creator company form (Companies1.State). */
const AU_STATES = ['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];
const KINDS = ['subcontractor', 'supplier', 'client', 'internal'] as const;

const COMPANY_COLUMNS: GridColumn<CompanyItem>[] = [
	{ key: 'name', label: 'Name', width: 240, cell: (c) => <strong>{c.name}</strong> },
	{ key: 'kind', label: 'Kind', width: 150, cell: (c) => <Chip status={c.kind} /> },
	{ key: 'contact', label: 'Contact', width: 320, cell: (c) => [c.contactName, c.phone, c.email].filter(Boolean).join(' / ') || '-' },
	{ key: 'status', label: 'Status', width: 130, cell: (c) => <Chip status={c.isActive ? 'Active' : 'Inactive'} /> },
];
const SITE_COLUMNS: GridColumn<SiteItem>[] = [
	{ key: 'name', label: 'Name', width: 240, cell: (s) => <strong>{s.name}</strong> },
	{ key: 'address', label: 'Address', width: 360, cell: (s) => s.address || '-' },
	{ key: 'status', label: 'Status', width: 130, cell: (s) => <Chip status={s.isActive ? 'Active' : 'Inactive'} /> },
];
const COMPANY_WIDTHS = gridWidths(COMPANY_COLUMNS);
const SITE_WIDTHS = gridWidths(SITE_COLUMNS);

/** Companies (subcontractors, suppliers, clients) and the sites jobs are done at. The Show section in the panel picks the table. */
export function Directory() {
	const me = useMe();
	const canWrite = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'install_coordinator'].includes(r));
	const [tab, setTab] = useState<'companies' | 'sites'>('companies');
	const [panelOpen, setPanelOpen] = useState(false);
	const companiesGrid = useGridLayout('ve.grid.companies', COMPANY_WIDTHS);
	const sitesGrid = useGridLayout('ve.grid.sites', SITE_WIDTHS);
	const grid = tab === 'companies' ? companiesGrid : sitesGrid;
	const chips: ActiveChip[] = tab === 'sites' ? [{ key: 'view', label: 'View: Sites', onRemove: () => setTab('companies') }] : [];

	return (
		<>
			<PageHeader eyebrow="Reference data" title="Companies and sites" subtitle="Who we work with and where the work happens.">
				<ListToolbarButtons
					searchOpen={panelOpen}
					onSearchOpen={() => setPanelOpen(true)}
					searchActive={tab !== 'companies'}
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
			</PageHeader>

			<ListToolbar
				label="Directory"
				searchOpen={panelOpen}
				panelTitle="Show"
				onPanelClose={() => setPanelOpen(false)}
				panelBody={(
					<PanelSection title="Show" summary={tab === 'companies' ? 'Companies' : 'Sites'} defaultOpen={false}>
						<div className="lt-views" role="radiogroup" aria-label="Views">
							{(['companies', 'sites'] as const).map((t) => (
								<button key={t} type="button" role="radio" aria-checked={tab === t} className={'lt-view' + (tab === t ? ' is-on' : '')} onClick={() => setTab(t)}>
									<span>{t === 'companies' ? 'Companies' : 'Sites'}</span>
								</button>
							))}
						</div>
					</PanelSection>
				)}
				chips={chips}
				onClearAll={() => setTab('companies')}
			/>

			{tab === 'companies' ? <Companies canWrite={canWrite} grid={companiesGrid} /> : <Sites canWrite={canWrite} grid={sitesGrid} />}
		</>
	);
}

function Companies({ canWrite, grid }: { canWrite: boolean; grid: GridLayout }) {
	const list = useCompanies();
	const write = useRegisterWrite(['companies']);
	const { notify } = useToast();
	const empty = { name: '', kind: 'subcontractor', contact_name: '', phone: '', email: '', street: '', suburb: '', state: '', post_code: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
	return (
		<>
			<Card flush>
				{canWrite && !open && (
					<div className="inline-form">
						<button className="btn" onClick={() => setOpen(true)}>
							<Plus size={16} aria-hidden="true" /> Add company
						</button>
					</div>
				)}
				{canWrite && open && (
					<Dialog title="Add company" onClose={() => setOpen(false)}>
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							write.mutate(
								{ method: 'POST', path: '/companies', body: { name: form.name, kind: form.kind, contact_name: form.contact_name || undefined, phone: form.phone || undefined, email: form.email || undefined, street: form.street || undefined, suburb: form.suburb || undefined, state: form.state || undefined, post_code: form.post_code || undefined } },
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
						<label>
							<span className="toolbar__label">Street Address</span>
							<input value={form.street} onChange={set('street')} maxLength={200} />
						</label>
						<label>
							<span className="toolbar__label">Suburb</span>
							<input value={form.suburb} onChange={set('suburb')} maxLength={100} />
						</label>
						<label>
							<span className="toolbar__label">State</span>
							<select value={form.state} onChange={set('state')} style={{ width: '100%' }}>
								<option value="">Choose…</option>
								{AU_STATES.map((s) => (
									<option key={s}>{s}</option>
								))}
							</select>
						</label>
						<label>
							<span className="toolbar__label">Post Code</span>
							<input value={form.post_code} onChange={set('post_code')} maxLength={10} />
						</label>
						<button className="btn" disabled={write.isPending}>
							{write.isPending ? 'Saving…' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{write.isError && <p role="alert">{write.error.message}</p>}
					</form>
					</Dialog>
				)}
				{list.isPending && <p role="status" className="table-empty">Loading…</p>}
				{list.isError && <p role="alert">Could not load companies.</p>}
				{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No companies yet.</p>}
				{list.isSuccess && list.data.items.length > 0 && (
					<ResizableGrid layout={grid} label="Companies" columns={COMPANY_COLUMNS} rows={list.data.items} rowKey={(c) => c.id} />
				)}
			</Card>
			{list.isSuccess && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
		</>
	);
}

function Sites({ canWrite, grid }: { canWrite: boolean; grid: GridLayout }) {
	const list = useSites();
	const write = useRegisterWrite(['sites']);
	const { notify } = useToast();
	const empty = { name: '', street: '', suburb: '', state: '', post_code: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
	return (
		<>
			<Card flush>
				{canWrite && !open && (
					<div className="inline-form">
						<button className="btn" onClick={() => setOpen(true)}>
							<Plus size={16} aria-hidden="true" /> Add site
						</button>
					</div>
				)}
				{canWrite && open && (
					<Dialog title="Add site" onClose={() => setOpen(false)}>
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
							{write.isPending ? 'Saving…' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{write.isError && <p role="alert">{write.error.message}</p>}
					</form>
					</Dialog>
				)}
				{list.isPending && <p role="status" className="table-empty">Loading…</p>}
				{list.isError && <p role="alert">Could not load sites.</p>}
				{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No sites yet.</p>}
				{list.isSuccess && list.data.items.length > 0 && (
					<ResizableGrid layout={grid} label="Sites" columns={SITE_COLUMNS} rows={list.data.items} rowKey={(s) => s.id} />
				)}
			</Card>
			{list.isSuccess && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
		</>
	);
}
