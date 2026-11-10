import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Plus } from 'lucide-react';
import { useChemicals, useEquipment, useLocations, useMe, useRegisterWrite } from '../api/queries';
import type { ChemicalItem, EquipmentItem, WorkshopLocation } from '../api/types';
import { Chip } from '../components/Chip';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn, GridLayout } from '../components/GridKit';

type Tab = 'equipment' | 'chemicals' | 'locations';
const TABS: { id: Tab; label: string }[] = [
	{ id: 'equipment', label: 'Equipment' },
	{ id: 'chemicals', label: 'Chemicals' },
	{ id: 'locations', label: 'Workshop locations' },
];

type EqView = 'all' | 'service' | 'off' | 'overdue';
const EQ_VIEWS: { key: EqView; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'service', label: 'In service' },
	{ key: 'off', label: 'Off hire' },
	{ key: 'overdue', label: 'Overdue' },
];
/** The search and filter values of the equipment list. The panel edits a draft; Search applies it. */
interface EqFilter { view: EqView; text: string; kind: string }
const EQ_EMPTY: EqFilter = { view: 'all', text: '', kind: '' };
type EqQuery = ReturnType<typeof useEquipment>;

const EQ_COLUMNS: GridColumn<EquipmentItem>[] = [
	{ key: 'code', label: 'Code', width: 110, cell: (e) => <span className="num">{e.code}</span> },
	{ key: 'name', label: 'Name', width: 260, cell: (e) => (
		<>
			<strong>{e.name}</strong>
			{e.type && <div className="muted">{e.type}</div>}
		</>
	) },
	{ key: 'location', label: 'Location', width: 170, cell: (e) => e.locationName ?? '-' },
	{ key: 'status', label: 'Status', width: 130, cell: (e) => <Chip status={e.status} /> },
	{ key: 'last', label: 'Last checked', width: 140, cell: (e) => e.lastChecked ?? '-' },
	{ key: 'every', label: 'Every', width: 110, right: true, cell: (e) => (e.frequencyDays ? `${e.frequencyDays} days` : '-') },
	{ key: 'next', label: 'Next check', width: 220, cell: (e) => (
		<>
			{e.nextDue ?? '-'}
			{e.overdue && <span className="chip chip-red" style={{ marginLeft: 8 }}>{e.daysOverdue} days overdue</span>}
		</>
	) },
];
const EQ_ACTION_WIDTH = 170;
const EQ_WIDTHS = gridWidths([...EQ_COLUMNS, { key: 'action', width: EQ_ACTION_WIDTH }]);

const CHEM_COLUMNS: GridColumn<ChemicalItem>[] = [
	{ key: 'name', label: 'Name', width: 260, cell: (c) => <strong>{c.name}</strong> },
	{ key: 'location', label: 'Location', width: 180, cell: (c) => c.locationName ?? '-' },
	{ key: 'hazard', label: 'Hazard class', width: 170, cell: (c) => c.hazardClass || '-' },
	{ key: 'sds', label: 'Safety data sheet', width: 260, cell: (c) => (
		<>
			{c.sdsMissing ? <span className="chip chip-red">SDS missing</span> : <a href={c.sdsUrl} target="_blank" rel="noopener noreferrer">Open SDS</a>}
			{c.reviewDue && <span className="chip chip-amber" style={{ marginLeft: 8 }}>Review due</span>}
		</>
	) },
];
const CHEM_WIDTHS = gridWidths(CHEM_COLUMNS);

const LOC_COLUMNS: GridColumn<WorkshopLocation>[] = [
	{ key: 'name', label: 'Name', width: 300, cell: (l) => (
		<>
			<strong>{l.name}</strong>
			{l.description && <div className="muted">{l.description}</div>}
		</>
	) },
	{ key: 'supervisor', label: 'Area supervisor', width: 220, cell: (l) => l.supervisorName ?? '-' },
];
const LOC_WIDTHS = gridWidths(LOC_COLUMNS);

/** Equipment register, chemicals with safety data sheet (SDS) links, and workshop locations. */
export function Equipment() {
	const me = useMe();
	const canWrite = !!me.data?.permissions.createJob; // managers; the server decides for real
	const [tab, setTab] = useState<Tab>('equipment');
	const eq = useEquipment();
	const eqGrid = useGridLayout('ve.grid.equipment', EQ_WIDTHS);
	const chemGrid = useGridLayout('ve.grid.chemicals', CHEM_WIDTHS);
	const locGrid = useGridLayout('ve.grid.locations', LOC_WIDTHS);
	const [panelOpen, setPanelOpen] = useState(false);
	const [applied, setApplied] = useState<EqFilter>(EQ_EMPTY);
	const [draft, setDraft] = useState<EqFilter>(EQ_EMPTY);

	const items = useMemo(() => eq.data?.items ?? [], [eq.data]);
	const counts = { all: items.length, service: items.filter((e) => e.status === 'In service').length, off: items.filter((e) => e.status === 'Off hire').length, overdue: items.filter((e) => e.overdue).length };
	const types = [...new Set(items.map((e) => e.type).filter(Boolean))];
	const needle = applied.text.trim().toLowerCase();
	const shown = items.filter((e) => (applied.view === 'all' || (applied.view === 'service' && e.status === 'In service') || (applied.view === 'off' && e.status === 'Off hire') || (applied.view === 'overdue' && e.overdue)) && (!applied.kind || e.type === applied.kind) && (!needle || `${e.code} ${e.name} ${e.locationName ?? ''}`.toLowerCase().includes(needle)));

	const onEquipment = tab === 'equipment';
	const grid = tab === 'equipment' ? eqGrid : tab === 'chemicals' ? chemGrid : locGrid;
	const searchActive = onEquipment && (applied.view !== 'all' || !!needle || !!applied.kind);
	const openPanel = () => { setDraft(applied); setPanelOpen(true); };
	const applyPanel = () => { setApplied(draft); setPanelOpen(false); };
	const clearDraft = () => setDraft(EQ_EMPTY);
	const clearAll = () => setApplied(EQ_EMPTY);
	const chips: ActiveChip[] = onEquipment ? [
		...(applied.view !== 'all' ? [{ key: 'view', label: `View: ${EQ_VIEWS.find((v) => v.key === applied.view)?.label ?? applied.view}`, onRemove: () => setApplied({ ...applied, view: 'all' }) }] : []),
		...(needle ? [{ key: 'q', label: `Search "${applied.text.trim()}"`, onRemove: () => setApplied({ ...applied, text: '' }) }] : []),
		...(applied.kind ? [{ key: 'kind', label: `Type: ${applied.kind}`, onRemove: () => setApplied({ ...applied, kind: '' }) }] : []),
	] : [];

	const toolbar = (
		<ListToolbar
			label="Equipment list"
			searchOpen={panelOpen}
			panelTitle="Search equipment"
			onPanelClose={() => setPanelOpen(false)}
			onPanelApply={onEquipment ? applyPanel : undefined}
			onPanelClear={clearDraft}
			panelBody={onEquipment ? (
				<>
					<PanelSection title="Show" summary={EQ_VIEWS.find((v) => v.key === draft.view)?.label} defaultOpen={false}>
						<div className="lt-views" role="radiogroup" aria-label="Views">
							{EQ_VIEWS.map((v) => (
								<button key={v.key} type="button" role="radio" aria-checked={draft.view === v.key} className={'lt-view' + (draft.view === v.key ? ' is-on' : '')} onClick={() => setDraft({ ...draft, view: v.key })}>
									<span>{v.label}</span>
									<span className="lt-count num">{counts[v.key]}</span>
								</button>
							))}
						</div>
					</PanelSection>
					<div className="lt-form">
						<span className="toolbar__label">Search in</span>
						<input type="search" aria-label="Search equipment" placeholder="Code, name or location" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
					</div>
					{types.length > 1 && (
						<div className="lt-form">
							<span className="toolbar__label">Type</span>
							<select aria-label="Type" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
								<option value="">All types</option>
								{types.map((t) => <option key={t}>{t}</option>)}
							</select>
						</div>
					)}
				</>
			) : (
				<p className="muted">This list has no search or filters.</p>
			)}
			chips={chips}
			onClearAll={onEquipment ? clearAll : undefined}
		/>
	);

	return (
		<>
			<PageHeader eyebrow="Workshop" title="Equipment" subtitle="Equipment checks, chemicals and where things are kept.">
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
			</PageHeader>
			<div className="inline-form" role="tablist" aria-label="Register">
				{TABS.map((t) => (
					<button key={t.id} role="tab" aria-selected={tab === t.id} className={'btn' + (tab === t.id ? '' : ' btn-ghost')} onClick={() => setTab(t.id)}>
						{t.label}
					</button>
				))}
			</div>
			{tab === 'equipment' && <EquipmentTab canWrite={canWrite} list={eq} items={items} shown={shown} grid={eqGrid} toolbar={toolbar} />}
			{tab === 'chemicals' && <ChemicalsTab canWrite={canWrite} grid={chemGrid} toolbar={toolbar} />}
			{tab === 'locations' && <LocationsTab canWrite={canWrite} grid={locGrid} toolbar={toolbar} />}
		</>
	);
}

function State({ q, empty }: { q: { isPending: boolean; isError: boolean; data?: { items: unknown[] } }; empty: string }) {
	if (q.isPending) return <p role="status" className="table-empty">Loading…</p>;
	if (q.isError) return <p role="alert">Could not load this list.</p>;
	if (q.data && q.data.items.length === 0) return <p className="table-empty">{empty}</p>;
	return null;
}

function EquipmentTab({ canWrite, list, items, shown, grid, toolbar }: { canWrite: boolean; list: EqQuery; items: EquipmentItem[]; shown: EquipmentItem[]; grid: GridLayout; toolbar: ReactNode }) {
	const locs = useLocations();
	const write = useRegisterWrite(['equipment']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({ name: '', type: '', location_id: '', frequency_days: '', off_hire_required: false });
	const checked = (id: string) => write.mutate({ method: 'POST', path: `/equipment/${id}/checked` }, { onSuccess: () => notify('Marked as checked today') });
	const columns: GridColumn<EquipmentItem>[] = canWrite
		? [...EQ_COLUMNS, { key: 'action', label: 'Action', width: EQ_ACTION_WIDTH, cell: (e) => (
			e.status === 'In service' ? (
				<button className="btn btn-ghost" onClick={() => checked(e.id)} disabled={write.isPending}>
					<Check size={15} aria-hidden="true" /> Checked today
				</button>
			) : null
		) }]
		: EQ_COLUMNS;

	return (
		<>
		<Card flush>
			{canWrite && (
				<div className="inline-form">
					{!open && (
						<button className="btn" onClick={() => setOpen(true)}>
							<Plus size={16} aria-hidden="true" /> Add equipment
						</button>
					)}
				</div>
			)}
			{canWrite && open && (
				<Dialog title="Add equipment" onClose={() => setOpen(false)}>
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{
								method: 'POST',
								path: '/equipment',
								body: {
									name: form.name,
									type: form.type || undefined,
									location_id: form.location_id || undefined,
									frequency_days: form.frequency_days ? Number(form.frequency_days) : undefined,
									off_hire_required: form.off_hire_required,
								},
							},
							{
								onSuccess: () => {
									setOpen(false);
									setForm({ name: '', type: '', location_id: '', frequency_days: '', off_hire_required: false });
									notify('Equipment added');
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">Name *</span>
						<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Type</span>
						<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} maxLength={100} />
					</label>
					<label>
						<span className="toolbar__label">Location</span>
						<select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} style={{ width: '100%' }}>
							<option value="">None</option>
							{locs.data?.items.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className="toolbar__label">Check every (days)</span>
						<input type="number" min={1} max={3650} value={form.frequency_days} onChange={(e) => setForm({ ...form, frequency_days: e.target.value })} />
					</label>
					<label className="login__check">
						<input type="checkbox" checked={form.off_hire_required} onChange={(e) => setForm({ ...form, off_hire_required: e.target.checked })} /> Hired (off hire when the job ends)
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
			<State q={list} empty="No equipment yet." />
			{list.isSuccess && items.length > 0 && toolbar}
			{list.isSuccess && items.length > 0 && shown.length === 0 && <p className="table-empty">Nothing matches.</p>}
			{list.isSuccess && shown.length > 0 && (
				<ResizableGrid layout={grid} label="Equipment register" columns={columns} rows={shown} rowKey={(e) => e.id} />
			)}
		</Card>
		{list.isSuccess && items.length > 0 && <GridStatusBar text={`Showing ${shown.length} of ${items.length}`} />}
		</>
	);
}

function ChemicalsTab({ canWrite, grid, toolbar }: { canWrite: boolean; grid: GridLayout; toolbar: ReactNode }) {
	const list = useChemicals();
	const locs = useLocations();
	const write = useRegisterWrite(['chemicals']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const empty = { name: '', location_id: '', sds_url: '', review_date: '', hazard_class: '' };
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

	return (
		<>
		<Card flush>
			{canWrite && !open && (
				<div className="inline-form">
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add chemical
					</button>
				</div>
			)}
			{canWrite && open && (
				<Dialog title="Add chemical" onClose={() => setOpen(false)}>
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{
								method: 'POST',
								path: '/chemicals',
								body: { name: form.name, location_id: form.location_id || undefined, sds_url: form.sds_url, review_date: form.review_date || undefined, hazard_class: form.hazard_class || undefined },
							},
							{
								onSuccess: () => {
									setOpen(false);
									setForm(empty);
									notify('Chemical added');
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
						<span className="toolbar__label">Location</span>
						<select value={form.location_id} onChange={set('location_id')} style={{ width: '100%' }}>
							<option value="">None</option>
							{locs.data?.items.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className="toolbar__label">SDS link (https://...)</span>
						<input type="url" value={form.sds_url} onChange={set('sds_url')} maxLength={500} pattern="https?://.+" />
					</label>
					<label>
						<span className="toolbar__label">SDS review date</span>
						<input type="date" value={form.review_date} onChange={set('review_date')} />
					</label>
					<label>
						<span className="toolbar__label">Hazard class</span>
						<input value={form.hazard_class} onChange={set('hazard_class')} maxLength={100} />
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
			<State q={list} empty="No chemicals yet." />
			{list.isSuccess && list.data.items.length > 0 && toolbar}
			{list.isSuccess && list.data.items.length > 0 && (
				<ResizableGrid layout={grid} label="Chemical register" columns={CHEM_COLUMNS} rows={list.data.items} rowKey={(c) => c.id} />
			)}
		</Card>
		{list.isSuccess && list.data.items.length > 0 && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
		</>
	);
}

function LocationsTab({ canWrite, grid, toolbar }: { canWrite: boolean; grid: GridLayout; toolbar: ReactNode }) {
	const list = useLocations();
	const write = useRegisterWrite(['locations']);
	const { notify } = useToast();
	const [name, setName] = useState('');
	const [open, setOpen] = useState(false);
	return (
		<>
		<Card flush>
			{canWrite && !open && (
				<div className="inline-form">
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add location
					</button>
				</div>
			)}
			{canWrite && open && (
				<Dialog title="Add location" onClose={() => setOpen(false)}>
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate({ method: 'POST', path: '/locations', body: { name } }, { onSuccess: () => { setName(''); setOpen(false); notify('Location added'); } });
					}}
				>
					<label>
						<span className="toolbar__label">New location</span>
						<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
					</label>
					<button className="btn" disabled={write.isPending}>
						<Plus size={16} aria-hidden="true" /> Add
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
				</Dialog>
			)}
			<State q={list} empty="No workshop locations yet." />
			{list.isSuccess && list.data.items.length > 0 && toolbar}
			{list.isSuccess && list.data.items.length > 0 && (
				<ResizableGrid layout={grid} label="Workshop locations" columns={LOC_COLUMNS} rows={list.data.items} rowKey={(l) => l.id} />
			)}
		</Card>
		{list.isSuccess && list.data.items.length > 0 && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
		</>
	);
}
