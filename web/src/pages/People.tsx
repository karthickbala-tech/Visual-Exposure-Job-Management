import { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCompanies, useComplianceItems, useComplianceTypes, useCreateCompliance, useMe, usePeople } from '../api/queries';
import type { CompanyItem, ComplianceItem, Person } from '../api/types';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, Kpi, PageHeader, fmtDate, TableFooter } from '../components/ui';
import { ListToolbar, ListToolbarButtons } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn, GridLayout } from '../components/GridKit';

const roleLabel = (r: string) => r.replace(/_/g, ' ');
const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const todayIso = () => new Date().toISOString().slice(0, 10);

type Tab = 've' | 'sub' | 'tickets' | 'docs';
const TABS: { key: Tab; label: string }[] = [
	{ key: 've', label: 'VE workers' },
	{ key: 'sub', label: 'Subcontractors' },
	{ key: 'tickets', label: 'Tickets and inductions' },
	{ key: 'docs', label: 'Company documents' },
];
/** Years after the issue date that the expiry is set to, for the types that have a rule (REACT_APP_EXTRACTION P2). Matched by type name. */
const EXPIRY_YEARS: Record<string, number> = { 'Working at Heights': 2, 'Elevated Work Platform (EWP) licence': 5, 'Public liability insurance': 1 };
/** Issue date plus whole years, as YYYY-MM-DD. 29 February rolls to 1 March in a non-leap year. */
const addYears = (iso: string, years: number) => {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y + years, m - 1, d)).toISOString().slice(0, 10);
};
const STATUS_OPTIONS: [string, string][] = [['Expired', 'Expired'], ['Today', 'Expires today'], ['Expiring', 'Within 30 days'], ['Valid', 'Valid'], ['No expiry', 'No expiry']];

/** The search and filter values of the people lists. The panel edits a draft; Search applies it. */
interface PeopleFilter { text: string; status: string; activeOnly: boolean }
const PEOPLE_EMPTY: PeopleFilter = { text: '', status: '', activeOnly: true };

/** The worst compliance state of one person's records, and how many need action (expired or expiring). */
function stateOf(items: ComplianceItem[]) {
	const act = items.filter((i) => i.status === 'Expired' || i.status === 'Expiring').length;
	const label = items.some((i) => i.status === 'Expired') ? 'Expired' : items.some((i) => i.status === 'Expiring') ? 'Expiring' : items.length ? 'Valid' : 'No records';
	return { label, act };
}

/** Columns of a worker list. The compliance column needs the person's records, so the caller passes stateFor. */
function workerColumns(stateFor: (id: string) => { label: string; act: number }, withRole: boolean, showRate: boolean): GridColumn<Person>[] {
	return [
		{ key: 'name', label: 'Name', width: 240, cell: (p) => (
			<>
				<Link to={'/people/' + p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</Link>
				{p.is_active === false && <small className="sub">Inactive</small>}
			</>
		) },
		...(withRole ? [{ key: 'role', label: 'Primary role', width: 160, cell: (p: Person) => <span style={{ textTransform: 'capitalize' }}>{parseRoles(p.roles).map(roleLabel)[0] || '-'}</span> }] : []),
		{ key: 'phone', label: 'Phone', width: 150, cell: (p) => (p.phone ? <a href={`tel:${p.phone.replace(/\s+/g, '')}`}>{p.phone}</a> : '-') },
		{ key: 'compliance', label: 'Compliance', width: 130, cell: (p) => {
			const st = stateFor(p.ROWID);
			return st.label === 'No records' ? <span className="muted">No records</span> : <Chip status={st.label} />;
		} },
		{ key: 'action', label: 'To action', width: 110, right: true, cell: (p) => stateFor(p.ROWID).act || '-' },
		...(showRate ? [{ key: 'rate', label: 'Hourly rate', width: 130, right: true, cell: (p: Person) => (p.hourly_rate ? `$${Number(p.hourly_rate).toFixed(2)}` : '-') }] : []),
	];
}
const WORKER_WIDTHS = gridWidths(workerColumns(() => ({ label: '', act: 0 }), true, true));

const COMPANY_COLUMNS: GridColumn<CompanyItem>[] = [
	{ key: 'name', label: 'Company', width: 260, cell: (c) => <strong>{c.name}</strong> },
	{ key: 'kind', label: 'Type', width: 150, cell: (c) => <Chip status={c.kind} /> },
	{ key: 'state', label: 'State', width: 110, cell: (c) => c.state || '-' },
	{ key: 'contact', label: 'Contact', width: 220, cell: (c) => c.contactName || c.email || c.phone || '-' },
];
const COMPANY_WIDTHS = gridWidths(COMPANY_COLUMNS);

/** Columns of the tickets and inductions list, or of the company documents list. */
function recordColumns(docs: boolean): GridColumn<ComplianceItem>[] {
	return [
		{ key: 'who', label: docs ? 'Company' : 'Person', width: 220, cell: (i) => (i.personId ? <Link to={'/people/' + i.personId}>{i.personName}</Link> : <strong>{i.companyName ?? '-'}</strong>) },
		{ key: 'type', label: 'Type', width: 220, cell: (i) => i.typeName ?? i.kind },
		{ key: 'ref', label: 'Reference', width: 150, cell: (i) => i.referenceNo || '-' },
		{ key: 'expires', label: 'Expires', width: 170, cell: (i) => (
			<>
				{fmtDate(i.expiryDate)}
				{i.daysLeft !== null && i.daysLeft !== undefined ? <small className="sub">{i.daysLeft < 0 ? `${Math.abs(i.daysLeft)} days ago` : `in ${i.daysLeft} days`}</small> : null}
			</>
		) },
		{ key: 'status', label: 'Status', width: 130, cell: (i) => <Chip status={i.status} /> },
	];
}
const RECORD_WIDTHS = gridWidths(recordColumns(false));

function AddRecord({ onClose }: { onClose: () => void }) {
	const types = useComplianceTypes();
	const people = usePeople(true);
	const create = useCreateCompliance();
	const { notify } = useToast();
	const [f, setF] = useState({ person_id: '', type_id: '', reference_no: '', issue_date: '', expiry_date: '' });
	const type = types.data?.items.find((t) => t.id === f.type_id);
	const problem = f.issue_date > todayIso() ? 'The issue date cannot be in the future.' : f.issue_date && f.expiry_date && f.expiry_date <= f.issue_date ? 'The expiry date must be after the issue date.' : '';
	return (
		<Dialog title="Add a ticket" onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				create.mutate(
					{ person_id: f.person_id, type_id: f.type_id, reference_no: f.reference_no || undefined, issue_date: f.issue_date || undefined, expiry_date: f.expiry_date || undefined },
					{ onSuccess: () => { onClose(); notify('Record saved'); }, onError: (er) => notify(errText(er), 'error') },
				);
			}}
		>
			<label><span className="toolbar__label">Person</span><select value={f.person_id} required onChange={(e) => setF({ ...f, person_id: e.target.value })}><option value="">Choose…</option>{(people.data?.items ?? []).filter((p) => p.is_active !== false).map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}</select></label>
			<label><span className="toolbar__label">Ticket or induction</span><select value={f.type_id} required onChange={(e) => setF({ ...f, type_id: e.target.value })}><option value="">Choose…</option>{(types.data?.items ?? []).filter((t) => t.kind !== 'company_document').map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
			<label><span className="toolbar__label">Reference</span><input value={f.reference_no} maxLength={100} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></label>
			<label><span className="toolbar__label">Issued</span><input type="date" max={todayIso()} value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} /></label>
			<label><span className="toolbar__label">Expires{type?.requiresExpiry ? ' *' : ''}</span><input type="date" value={f.expiry_date} required={!!type?.requiresExpiry} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></label>
			{(type ? EXPIRY_YEARS[type.name] : undefined) && f.issue_date && (<button type="button" className="btn btn-ghost btn-sm" onClick={() => setF({ ...f, expiry_date: addYears(f.issue_date, EXPIRY_YEARS[type!.name]) })}>Set expiry {EXPIRY_YEARS[type!.name]} years after issue</button>)}
			<button className="btn" disabled={create.isPending || !!problem}>{create.isPending ? 'Saving…' : 'Save'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{problem && <p role="alert">{problem}</p>}
		</form>
		</Dialog>
	);
}

/** Everyone who works with the company, with their tickets and inductions: workers, subcontractors and the companies behind them, tickets, and company documents. */
export function People() {
	const navigate = useNavigate();
	const location = useLocation();
	const me = useMe();
	const q = usePeople(true);
	const items = useComplianceItems();
	const companies = useCompanies();
	const canAdd = me.data?.permissions.createJob ?? false; // managers; the server decides for real
	const showRate = me.data?.roles.includes('admin') ?? false;
	const [tab, setTab] = useState<Tab>('ve');
	const [form, setForm] = useState<'record' | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);
	const [applied, setApplied] = useState<PeopleFilter>(PEOPLE_EMPTY);
	const [draft, setDraft] = useState<PeopleFilter>(PEOPLE_EMPTY);
	const workersGrid = useGridLayout('ve.grid.people.workers', WORKER_WIDTHS);
	const subsGrid = useGridLayout('ve.grid.people.subcontractors', WORKER_WIDTHS);
	const companiesGrid = useGridLayout('ve.grid.people.companies', COMPANY_WIDTHS);
	const recordsGrid = useGridLayout('ve.grid.people.records', RECORD_WIDTHS);

	const people = useMemo(() => q.data?.items ?? [], [q.data]);
	const all = useMemo(() => items.data?.items ?? [], [items.data]);
	const byPerson = useMemo(() => {
		const m = new Map<string, ComplianceItem[]>();
		for (const i of all) if (i.personId) m.set(i.personId, [...(m.get(i.personId) ?? []), i]);
		return m;
	}, [all]);
	const stateFor = (id: string) => stateOf(byPerson.get(id) ?? []);
	const needle = applied.text.trim().toLowerCase();
	const visible = people.filter((p) => (!applied.activeOnly || p.is_active !== false) && (!needle || `${p.first_name} ${p.last_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(needle)));
	const ve = visible.filter((p) => (p as { person_kind?: string }).person_kind !== 'subcontractor');
	const subs = visible.filter((p) => (p as { person_kind?: string }).person_kind === 'subcontractor');
	const inTab = all.filter((i) => (tab === 'docs' ? i.kind === 'company_document' : i.kind !== 'company_document'));
	const records = all.filter((i) => (tab === 'docs' ? i.kind === 'company_document' : i.kind !== 'company_document') && (!applied.status || (applied.status === 'Today' ? i.daysLeft === 0 : i.status === applied.status)) && (!needle || `${i.personName ?? i.companyName ?? ''} ${i.typeName ?? ''}`.toLowerCase().includes(needle)));
	const companyRows = (companies.data?.items ?? []).filter((c) => c.kind !== 'internal' && (!applied.activeOnly || c.isActive));
	const expired = all.filter((i) => i.status === 'Expired').length;
	const expiring = all.filter((i) => i.status === 'Expiring' && i.daysLeft !== 0).length;
	const today0 = all.filter((i) => i.daysLeft === 0 && i.status !== 'Expired').length;
	const activeAll = people.filter((p) => p.is_active !== false);
	const goStatus = (s: string) => { setTab('tickets'); setApplied({ ...applied, status: s }); };

	const onRecords = tab === 'tickets' || tab === 'docs';
	const onWorkers = tab === 've' || tab === 'sub';
	const grid: GridLayout = tab === 've' ? workersGrid : tab === 'sub' ? subsGrid : recordsGrid;
	const statusOn = onRecords && !!applied.status;
	const inactiveOn = onWorkers && !applied.activeOnly;
	const searchActive = !!needle || statusOn || inactiveOn;
	const openPanel = () => { setDraft(applied); setPanelOpen(true); };
	const applyPanel = () => { setApplied(draft); setPanelOpen(false); };
	const clearDraft = () => setDraft(PEOPLE_EMPTY);
	const clearAll = () => setApplied(PEOPLE_EMPTY);
	const statusLabel = STATUS_OPTIONS.find(([v]) => v === applied.status)?.[1] ?? applied.status;
	const chips: ActiveChip[] = [
		...(needle ? [{ key: 'q', label: `Search "${applied.text.trim()}"`, onRemove: () => setApplied({ ...applied, text: '' }) }] : []),
		...(statusOn ? [{ key: 'status', label: `Status: ${statusLabel}`, onRemove: () => setApplied({ ...applied, status: '' }) }] : []),
		...(inactiveOn ? [{ key: 'inactive', label: 'Including inactive', onRemove: () => setApplied({ ...applied, activeOnly: true }) }] : []),
	];

	const toolbar = (
		<ListToolbar
			label="People list"
			searchOpen={panelOpen}
			panelTitle="Search people"
			onPanelClose={() => setPanelOpen(false)}
			onPanelApply={applyPanel}
			onPanelClear={clearDraft}
			panelBody={(
				<>
					<div className="lt-form">
						<span className="toolbar__label">Search in</span>
						<input type="search" aria-label="Search people" placeholder="Type to search" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
					</div>
					{onWorkers && <label className="check"><input type="checkbox" checked={draft.activeOnly} onChange={(e) => setDraft({ ...draft, activeOnly: e.target.checked })} /> Active only</label>}
					{onRecords && (
						<div className="lt-form">
							<span className="toolbar__label">Status</span>
							<select aria-label="Status" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
								<option value="">All statuses</option>
								{STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l} ({v === 'Today' ? today0 : inTab.filter((i) => i.status === v).length})</option>)}
							</select>
						</div>
					)}
				</>
			)}
			chips={chips}
			onClearAll={clearAll}
		/>
	);

	const workerTable = (list: Person[], withRole: boolean, layout: GridLayout, label: string) => (
		<ResizableGrid layout={layout} label={label} columns={workerColumns(stateFor, withRole, showRate)} rows={list} rowKey={(p) => p.ROWID} />
	);

	const barText = tab === 've' && q.isSuccess ? `Showing ${ve.length} of ${people.length}`
		: onRecords && items.isSuccess ? `Showing ${records.length} of ${inTab.length}`
		: null;

	return (
		<>
			<PageHeader eyebrow="Team" title="People" subtitle="Workers, subcontractors, and their tickets, inductions and documents.">
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
				{canAdd && !form && (
					<>
						<button className="btn" onClick={() => navigate('/people/new', { state: { background: location } })}><Plus size={16} aria-hidden="true" /> Add a person</button>
						<button className="btn btn-ghost" onClick={() => setForm('record')}><Plus size={16} aria-hidden="true" /> Add a ticket</button>
					</>
				)}
			</PageHeader>

			<section className="kpis" aria-label="Summary">
				<Kpi label="VE workers" value={activeAll.filter((p) => (p as { person_kind?: string }).person_kind !== 'subcontractor').length} />
				<Kpi label="Subcontractors" value={activeAll.filter((p) => (p as { person_kind?: string }).person_kind === 'subcontractor').length} />
				<button type="button" className={'kpi kpi-btn' + (expired ? ' kpi-danger' : '')} aria-pressed={tab === 'tickets' && applied.status === 'Expired'} onClick={() => goStatus('Expired')}>
					<span className="kpi-label">Expired</span><span className="kpi-value num">{expired}</span>
				</button>
				<button type="button" className={'kpi kpi-btn' + (today0 ? ' kpi-danger' : '')} aria-pressed={tab === 'tickets' && applied.status === 'Today'} onClick={() => goStatus('Today')}>
					<span className="kpi-label">Expires today</span><span className="kpi-value num">{today0}</span>
				</button>
				<button type="button" className="kpi kpi-btn" aria-pressed={tab === 'tickets' && applied.status === 'Expiring'} onClick={() => goStatus('Expiring')}>
					<span className="kpi-label">Expiring within 30 days</span><span className="kpi-value num">{expiring}</span>
				</button>
			</section>

			<Card flush>
				{form === 'record' && canAdd && <AddRecord onClose={() => setForm(null)} />}
				<div className="list-toolbar">
					<div className="segmented" role="group" aria-label="People views">
						{TABS.map((t) => (
							<button key={t.key} className={tab === t.key ? 'on' : ''} aria-pressed={tab === t.key} onClick={() => { setTab(t.key); setApplied({ ...applied, status: '' }); }}>{t.label}</button>
						))}
					</div>
				</div>
				{toolbar}

				{(q.isPending || items.isPending) && <p role="status" className="table-empty">Loading…</p>}
				{(q.isError || items.isError) && <p role="alert">Could not load people.</p>}

				{q.isSuccess && tab === 've' && (ve.length ? workerTable(ve, true, workersGrid, 'Workers') : <p className="table-empty">No workers match.</p>)}
				{q.isSuccess && tab === 'sub' && (
					<>
						{subs.length ? workerTable(subs, false, subsGrid, 'Subcontractors') : <p className="table-empty">No subcontractors match.</p>}
						{subs.length > 0 && <TableFooter shown={subs.length} total={people.filter((p) => (p as { person_kind?: string }).person_kind === 'subcontractor').length} />}
						{companies.isSuccess && companies.data.items.length > 0 && (
							<>
								<ResizableGrid layout={companiesGrid} label="Companies" columns={COMPANY_COLUMNS} rows={companyRows} rowKey={(c) => c.id} empty="Nothing matches." />
								<TableFooter shown={companyRows.length} total={companies.data.items.filter((c) => c.kind !== 'internal').length} />
							</>
						)}
					</>
				)}
				{items.isSuccess && onRecords && (
					records.length ? (
						<ResizableGrid layout={recordsGrid} label={tab === 'docs' ? 'Company documents' : 'Tickets and inductions'} columns={recordColumns(tab === 'docs')} rows={records} rowKey={(i) => i.id} />
					) : (
						<p className="table-empty">Nothing matches.</p>
					)
				)}
			</Card>
			{barText && <GridStatusBar text={barText} />}
		</>
	);
}
