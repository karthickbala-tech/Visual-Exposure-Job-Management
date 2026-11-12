import { createContext, useContext, useState } from 'react';
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
/** The company types of the Creator company form. Companies saved with an older kind keep it. */
const KINDS = ['Local - Installer', 'Local - Fabricator', 'Local - Supplier', 'Interstate - Installer', 'Interstate - Full Service'] as const;
/** Site states: the value saved is the short code the backend allows, the label is the full name from the Creator Sites form. */
const STATE_NAMES: [string, string][] = [['ACT', 'Australian Capital Territory'], ['NSW', 'New South Wales'], ['NT', 'Northern Territory'], ['QLD', 'Queensland'], ['SA', 'South Australia'], ['TAS', 'Tasmania'], ['VIC', 'Victoria'], ['WA', 'Western Australia']];
const stateName = (code?: string) => STATE_NAMES.find(([c]) => c === code)?.[1] ?? code ?? '';

/** The Edit button of a row reads its handler from the list that shows it; it is hidden for people who cannot edit. */
const CompanyEditCtx = createContext<((c: CompanyItem) => void) | null>(null);
const SiteEditCtx = createContext<((s: SiteItem) => void) | null>(null);
function EditCompany({ c }: { c: CompanyItem }) {
	const edit = useContext(CompanyEditCtx);
	return edit ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(c)}>Edit</button> : null;
}
function EditSite({ s }: { s: SiteItem }) {
	const edit = useContext(SiteEditCtx);
	return edit ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(s)}>Edit</button> : null;
}

/** The Creator company rate fields (AUD). Managers only: the API leaves them out for everyone else. */
const RATE_FIELDS: [string, string][] = [['weekday_business', 'Weekday - Business Hours'], ['weekday_ah', 'Weekday - AH Hours'], ['saturday_day', 'Saturday - Daytime Rate'], ['saturday_night', 'Saturday - Night time Rate'], ['sunday_day', 'Sunday - Daytime Rate'], ['sunday_night', 'Sunday - Night time Rate'], ['public_holiday', 'Public Holiday Rate']];
const RATE_ROLES = ['admin', 'project_manager', 'fab_manager', 'install_coordinator'];

const COMPANY_COLUMNS: GridColumn<CompanyItem>[] = [
	{ key: 'name', label: 'Name', width: 240, cell: (c) => <strong>{c.name}</strong> },
	{ key: 'kind', label: 'Kind', width: 150, cell: (c) => <Chip status={c.kind} /> },
	{ key: 'contact', label: 'Contact', width: 320, cell: (c) => [c.contactName, c.phone, c.email].filter(Boolean).join(' / ') || '-' },
	{ key: 'status', label: 'Status', width: 130, cell: (c) => <Chip status={c.isActive ? 'Active' : 'Inactive'} /> },
	{ key: 'edit', label: 'Actions', width: 90, cell: (c) => <EditCompany c={c} /> },
];
const SITE_COLUMNS: GridColumn<SiteItem>[] = [
	{ key: 'name', label: 'Name', width: 240, cell: (s) => <strong>{s.name}</strong> },
	{ key: 'address', label: 'Address', width: 360, cell: (s) => s.address || '-' },
	{ key: 'state', label: 'State', width: 200, cell: (s) => stateName(s.state) || '-' },
	{ key: 'status', label: 'Status', width: 130, cell: (s) => <Chip status={s.isActive ? 'Active' : 'Inactive'} /> },
	{ key: 'edit', label: 'Actions', width: 90, cell: (s) => <EditSite s={s} /> },
];
const COMPANY_WIDTHS = gridWidths(COMPANY_COLUMNS);
const SITE_WIDTHS = gridWidths(SITE_COLUMNS);

/** Companies (subcontractors, suppliers, clients) and the sites jobs are done at. The Show section in the panel picks the table. */
export function Directory() {
	const me = useMe();
	const canWrite = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'install_coordinator'].includes(r));
	const canRates = (me.data?.roles ?? []).some((r) => RATE_ROLES.includes(r));
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

			{tab === 'companies' ? <Companies canWrite={canWrite} canRates={canRates} grid={companiesGrid} /> : <Sites canWrite={canWrite} grid={sitesGrid} />}
		</>
	);
}

function Companies({ canWrite, canRates, grid }: { canWrite: boolean; canRates: boolean; grid: GridLayout }) {
	const list = useCompanies();
	const write = useRegisterWrite(['companies']);
	const { notify } = useToast();
	const empty = { name: '', kind: 'Local - Installer', contact_name: '', phone: '', email: '', street: '', suburb: '', state: '', post_code: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const [editing, setEditing] = useState<CompanyItem | null>(null);
	const [rates, setRates] = useState<Record<string, string>>({});
	const [billing, setBilling] = useState('');
	const close = () => { setOpen(false); setEditing(null); setForm(empty); setRates({}); setBilling(''); };
	/** The rates to send: numbers for the filled boxes, null for a cleared one. Nothing for people who cannot see rates. */
	const ratesBody = () => {
		if (!canRates) return undefined;
		const out: Record<string, number | string | null> = {};
		for (const [k] of RATE_FIELDS) if (rates[k] !== undefined) out[k] = rates[k] === '' ? null : Number(rates[k]);
		if (billing || editing) out.billing_notes = billing;
		return Object.keys(out).length ? out : undefined;
	};
	const startEdit = (c: CompanyItem) => {
		setForm({ name: c.name, kind: c.kind, contact_name: c.contactName, phone: c.phone, email: c.email, street: c.street ?? '', suburb: c.suburb ?? '', state: c.state, post_code: c.postCode ?? '' });
		setRates(Object.fromEntries(RATE_FIELDS.map(([k]) => [k, c.rates?.[k] == null ? '' : String(c.rates[k])])));
		setBilling(String(c.rates?.billing_notes ?? ''));
		setEditing(c);
		setOpen(true);
	};
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
					<Dialog title={editing ? 'Edit company' : 'Add company'} onClose={close}>
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							write.mutate(
								editing ? { method: 'PATCH', path: '/companies/' + editing.id, body: { ...form, rates: ratesBody() } } : { method: 'POST', path: '/companies', body: { name: form.name, kind: form.kind, contact_name: form.contact_name || undefined, phone: form.phone || undefined, email: form.email || undefined, street: form.street || undefined, suburb: form.suburb || undefined, state: form.state || undefined, post_code: form.post_code || undefined, rates: ratesBody() } },
								{
									onSuccess: () => {
										close();
										notify(editing ? 'Company saved' : 'Company added');
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
								{[...KINDS, ...(editing && !(KINDS as readonly string[]).includes(editing.kind) ? [editing.kind] : [])].map((k) => (
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
						{canRates && (
							<>
								{RATE_FIELDS.map(([key, label]) => (
									<label key={key}>
										<span className="toolbar__label">{label}</span>
										<input type="number" min={0} step="0.01" inputMode="decimal" value={rates[key] ?? ''} onChange={(e) => setRates({ ...rates, [key]: e.target.value })} />
									</label>
								))}
								<label>
									<span className="toolbar__label">Billing Notes</span>
									<textarea rows={3} value={billing} onChange={(e) => setBilling(e.target.value)} maxLength={2000} />
								</label>
							</>
						)}
						<button className="btn" disabled={write.isPending}>
							{write.isPending ? 'Saving…' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={close}>
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
					<CompanyEditCtx.Provider value={canWrite ? startEdit : null}>
						<ResizableGrid layout={grid} label="Companies" columns={COMPANY_COLUMNS} rows={list.data.items} rowKey={(c) => c.id} />
					</CompanyEditCtx.Provider>
				)}
				{list.isSuccess && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
			</Card>
		</>
	);
}

/** The other fields of the Creator Sites form, in its order: label, length and input kind. */
const SITE_FIELDS: ['country' | 'business_hours' | 'notes' | 'access_notes' | 'tenant_business' | 'tenant_contact' | 'tenant_phone' | 'tenant_email' | 'owner_name' | 'owner_phone' | 'owner_email', string, number, 'text' | 'email' | 'area'][] = [
	['country', 'Country', 50, 'text'],
	['business_hours', 'Business Hours', 200, 'text'],
	['notes', 'Location Notes', 2000, 'area'],
	['access_notes', 'Location Access Notes', 2000, 'area'],
	['tenant_business', 'Tenant Business Name', 200, 'text'],
	['tenant_contact', 'Tenant Contact Name', 200, 'text'],
	['tenant_phone', 'Tenant Contact Phone', 40, 'text'],
	['tenant_email', 'Tenant Contact Email', 200, 'email'],
	['owner_name', 'Location Owner Name', 200, 'text'],
	['owner_phone', 'Location Owner Phone', 40, 'text'],
	['owner_email', 'Location Owner Email', 200, 'email'],
];

function Sites({ canWrite, grid }: { canWrite: boolean; grid: GridLayout }) {
	const list = useSites();
	const write = useRegisterWrite(['sites']);
	const { notify } = useToast();
	const empty = { name: '', street: '', suburb: '', state: '', post_code: '', country: '', business_hours: '', notes: '', access_notes: '', tenant_business: '', tenant_contact: '', tenant_phone: '', tenant_email: '', owner_name: '', owner_phone: '', owner_email: '' };
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(empty);
	const [editing, setEditing] = useState<SiteItem | null>(null);
	const close = () => { setOpen(false); setEditing(null); setForm(empty); };
	const startEdit = (x: SiteItem) => {
		setForm({ name: x.name, street: x.street ?? '', suburb: x.suburb ?? '', state: x.state ?? '', post_code: x.postCode ?? '', country: x.country ?? '', business_hours: x.businessHours ?? '', notes: x.notes ?? '', access_notes: x.accessNotes ?? '', tenant_business: x.tenantBusiness ?? '', tenant_contact: x.tenantContact ?? '', tenant_phone: x.tenantPhone ?? '', tenant_email: x.tenantEmail ?? '', owner_name: x.ownerName ?? '', owner_phone: x.ownerPhone ?? '', owner_email: x.ownerEmail ?? '' });
		setEditing(x);
		setOpen(true);
	};
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
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
					<Dialog title={editing ? 'Edit site' : 'Add site'} onClose={close}>
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							write.mutate(
								editing ? { method: 'PATCH', path: '/sites/' + editing.id, body: form } : { method: 'POST', path: '/sites', body: Object.fromEntries(Object.entries(form).filter(([k, v]) => k === 'name' || v !== '')) },
								{
									onSuccess: () => {
										close();
										notify(editing ? 'Site saved' : 'Site added');
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
							<select value={form.state} onChange={set('state')} style={{ width: '100%' }}>
								<option value="">Choose…</option>
								{STATE_NAMES.map(([code, name]) => (
									<option key={code} value={code}>{name}</option>
								))}
								{form.state && !STATE_NAMES.some(([code]) => code === form.state) && <option value={form.state}>{form.state}</option>}
							</select>
						</label>
						<label>
							<span className="toolbar__label">Post code</span>
							<input value={form.post_code} onChange={set('post_code')} maxLength={10} />
						</label>
						{SITE_FIELDS.map(([key, label, max, kind]) => (
							<label key={key}>
								<span className="toolbar__label">{label}</span>
								{kind === 'area' ? <textarea rows={3} value={form[key]} onChange={set(key)} maxLength={max} /> : <input type={kind} value={form[key]} onChange={set(key)} maxLength={max} />}
							</label>
						))}
						<button className="btn" disabled={write.isPending}>
							{write.isPending ? 'Saving…' : 'Save'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={close}>
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
					<SiteEditCtx.Provider value={canWrite ? startEdit : null}>
						<ResizableGrid layout={grid} label="Sites" columns={SITE_COLUMNS} rows={list.data.items} rowKey={(s) => s.id} />
					</SiteEditCtx.Provider>
				)}
				{list.isSuccess && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
			</Card>
		</>
	);
}
