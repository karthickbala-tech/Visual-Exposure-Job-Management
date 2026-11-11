import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { AlertTriangle, Download, ExternalLink, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useJobs, useMe, usePeople } from '../api/queries';
import { useDeleteJobs } from '../api/more';
import { num } from '../api/types';
import type { Job, JobTabCounts } from '../api/types';
import { StageCell } from '../components/StageCell';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { Card, PageHeader } from '../components/ui';
import { ContextMenu } from '../components/ContextMenu';
import type { MenuItem } from '../components/ContextMenu';
import { useConfirm } from '../components/Messages';
import { useToast } from '../components/toast';
import { GridStatusBar, Pagination, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';

const VIEWS: { key: keyof JobTabCounts; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'all_open', label: 'All open' },
	{ key: 'my_open', label: 'My open' },
	{ key: 'my_jobs', label: 'My jobs' },
	{ key: 'preparation', label: 'Preparation' },
	{ key: 'ongoing', label: 'Ongoing' },
	{ key: 'completed', label: 'Completed' },
];
const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];
const COLS_KEY = 've.jobs.columns';
/** Rows per page. The jobs are loaded once (up to 300) and paged in the browser, so changing page costs no request. */
const PAGE_SIZE = 50;
type SearchOp = 'contains' | 'equals' | 'starts';
const OPS: { key: SearchOp; label: string }[] = [
	{ key: 'contains', label: 'Contains' },
	{ key: 'equals', label: 'Equals' },
	{ key: 'starts', label: 'Starts with' },
];
/** The search and filter values the panel edits before they are applied. */
interface Draft { field: string; op: SearchOp; text: string; stage: string; pm: string; fab: string }
const emptyDraft: Draft = { field: 'name', op: 'contains', text: '', stage: '', pm: '', fab: '' };
const matchesOp = (value: string, needle: string, op: SearchOp) => (op === 'equals' ? value === needle : op === 'starts' ? value.startsWith(needle) : value.includes(needle));

/** 26-Jun-2026 04:18:06 PM, the way the old Creator list showed dates and times. */
function fmtStamp(v?: string | null, withTime = true) {
	if (!v) return '';
	const d = new Date(v.length <= 10 ? v + 'T00:00:00' : v.replace(' ', 'T'));
	if (Number.isNaN(d.getTime())) return v;
	const date = `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-AU', { month: 'short' })}-${d.getFullYear()}`;
	if (!withTime || v.length <= 10) return date;
	const h = d.getHours() % 12 || 12;
	return `${date} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
}
const money = (v: unknown) => (v === undefined || v === null || v === '' ? '' : Number(v).toFixed(2));
const hours = (v: unknown) => (v === undefined || v === null || Number(v) === 0 ? '' : Number(v).toFixed(2));

interface Col {
	key: string;
	label: string;
	width: number;
	admin?: boolean; // money: only shown to people who may see it
	value: (j: Job) => string | number;
	cell: (j: Job) => ReactNode;
	right?: boolean;
}
const pct = (v: string | number | null | undefined) => (v === undefined || v === null || v === '' ? '' : String(num(v)));
/** Open and Edit links for one job, as in Creator's row actions. Edit only shows for people who may edit jobs. */
function JobRowActions({ id }: { id: string }) {
	const me = useMe();
	const location = useLocation();
	return (
		<span className="row-actions">
			<Link to={`/jobs/${id}`}>Open</Link>
			{me.data?.permissions.editJob && <Link to={`/jobs/${id}/edit`} state={{ background: location }}>Edit</Link>}
			{me.data?.permissions.createTask && (
				<>
					<Link to={`/jobs/${id}?add=design`}>+ Design</Link>
					<Link to={`/jobs/${id}?add=fab`}>+ Fab</Link>
					<Link to={`/jobs/${id}?add=install`}>+ Install</Link>
				</>
			)}
		</span>
	);
}

const COLS: Col[] = [
	{ key: 'name', label: 'Job Name', width: 280, value: (j) => j.name, cell: (j) => {
		const risks = j.risk ?? [];
		return (
			<>
				<Link to={`/jobs/${j.ROWID}`} title={j.name}>{j.name}</Link>
				{risks.length > 0 && <span className="risk-flag" title={risks.join(' · ')}><AlertTriangle size={12} aria-label={`${risks.length} warning${risks.length > 1 ? 's' : ''}`} /></span>}
				<span className="risk-lines">{risks.map((r) => <small key={r} className="risk"><AlertTriangle size={12} aria-hidden="true" /> {r}</small>)}</span>
			</>
		);
	} },
	{ key: 'stage', label: 'Stage', width: 190, value: (j) => j.stage, cell: (j) => <StageCell stage={j.stage} /> },
	{ key: 'pfab', label: '% Fab Completed', width: 132, right: true, value: (j) => pct(j.percent_fab), cell: (j) => pct(j.percent_fab) },
	{ key: 'pjob', label: '% Job Completed', width: 132, right: true, value: (j) => pct(j.percent_job), cell: (j) => pct(j.percent_job) },
	{ key: 'pinst', label: '% Install Completed', width: 146, right: true, value: (j) => pct(j.percent_install), cell: (j) => pct(j.percent_install) },
	{ key: 'pm', label: 'Project Manager', width: 150, value: (j) => j.pm_name ?? '', cell: (j) => j.pm_name ?? '' },
	{ key: 'fabm', label: 'Fab Manager', width: 150, value: (j) => j.fab_manager_name ?? '', cell: (j) => j.fab_manager_name ?? '' },
	{ key: 'created', label: 'Job Created Date', width: 215, value: (j) => fmtStamp(j.CREATEDTIME ?? j.created_date), cell: (j) => fmtStamp(j.CREATEDTIME ?? j.created_date) },
	{ key: 'description', label: 'Description', width: 300, value: (j) => j.description ?? '', cell: (j) => j.description ?? '' },
	{ key: 'completed_date', label: 'Job Completed Date', width: 170, value: (j) => fmtStamp(j.completed_date, false), cell: (j) => fmtStamp(j.completed_date, false) },
	{ key: 'wd', label: 'Workdrive Link', width: 150, value: (j) => j.workdrive_url ?? '', cell: (j) => (j.workdrive_url ? <a href={j.workdrive_url} target="_blank" rel="noreferrer">Workdrive Folder <ExternalLink size={12} aria-hidden="true" /></a> : '') },
	{ key: 'dh', label: 'Design Hours Booked', width: 150, right: true, value: (j) => hours(j.design_hours_booked), cell: (j) => hours(j.design_hours_booked) },
	{ key: 'dc', label: 'Design Labour Cost', width: 150, right: true, admin: true, value: (j) => money(j.design_labour_cost), cell: (j) => money(j.design_labour_cost) },
	{ key: 'dcp', label: 'Design Labour Cost - Parent', width: 190, right: true, admin: true, value: (j) => money(j.design_labour_cost_parent), cell: (j) => money(j.design_labour_cost_parent) },
	{ key: 'dcf', label: 'Design Labour Cost - Fab', width: 180, right: true, admin: true, value: (j) => money(j.design_labour_cost_fab), cell: (j) => money(j.design_labour_cost_fab) },
	{ key: 'fcp', label: 'Fab Labour Cost - Parent', width: 180, right: true, admin: true, value: (j) => money(j.fab_labour_cost_parent), cell: (j) => money(j.fab_labour_cost_parent) },
	{ key: 'fcf', label: 'Fab Labour Cost - Fab', width: 170, right: true, admin: true, value: (j) => money(j.fab_labour_cost_fab), cell: (j) => money(j.fab_labour_cost_fab) },
	{ key: 'icp', label: 'Install Labour Cost - Parent', width: 200, right: true, admin: true, value: (j) => money(j.install_labour_cost_parent), cell: (j) => money(j.install_labour_cost_parent) },
	{ key: 'icf', label: 'Install Labour Cost - Fab', width: 190, right: true, admin: true, value: (j) => money(j.install_labour_cost_fab), cell: (j) => money(j.install_labour_cost_fab) },
	{ key: 'ih', label: 'Install Hours Booked', width: 150, right: true, value: (j) => hours(j.install_hours_booked), cell: (j) => hours(j.install_hours_booked) },
	{ key: 'ic', label: 'Install Labour Cost', width: 150, right: true, admin: true, value: (j) => money(j.install_labour_cost), cell: (j) => money(j.install_labour_cost) },
	{ key: 'fh', label: 'Fab Hours Booked', width: 146, right: true, value: (j) => hours(j.fab_hours_booked), cell: (j) => hours(j.fab_hours_booked) },
	{ key: 'fc', label: 'Fab Labour Cost', width: 146, right: true, admin: true, value: (j) => money(j.fab_labour_cost), cell: (j) => money(j.fab_labour_cost) },
	{ key: 'exp', label: 'Expected Job Finish', width: 150, value: (j) => fmtStamp(j.expected_finish, false), cell: (j) => fmtStamp(j.expected_finish, false) },
	{ key: 'afab', label: 'Agreed Fab Finish Date', width: 170, value: (j) => fmtStamp(j.agreed_fab_finish, false), cell: (j) => fmtStamp(j.agreed_fab_finish, false) },
	{ key: 'rfab', label: 'Required Fab Finish Date', width: 170, value: (j) => fmtStamp(j.required_fab_finish, false), cell: (j) => fmtStamp(j.required_fab_finish, false) },
	{ key: 'quote', label: 'Related Quote', width: 150, value: (j) => j.quote_ref ?? '', cell: (j) => j.quote_ref ?? '' },
	{ key: 'deal', label: 'Deal', width: 170, value: (j) => j.crm_deal_id ?? '', cell: (j) => j.crm_deal_id ?? '' },
	{ key: 'id', label: 'ID', width: 150, value: (j) => j.ROWID, cell: (j) => j.ROWID },
	{ key: 'path', label: 'Folder Location on VE Server', width: 250, value: (j) => j.server_path ?? '', cell: (j) => j.server_path ?? '' },
	{ key: 'status', label: 'Job Status', width: 130, value: (j) => j.job_status ?? '', cell: (j) => j.job_status ?? '' },
	{ key: 'modified', label: 'Modified Time', width: 215, value: (j) => fmtStamp(j.MODIFIEDTIME), cell: (j) => fmtStamp(j.MODIFIEDTIME) },
	{ key: 'actions', label: 'Actions', width: 260, value: () => '', cell: (j) => <JobRowActions id={j.ROWID} /> },
	{ key: 'closure', label: 'Closure Email Sent', width: 150, value: (j) => (j.closure_email_sent ? 'true' : 'false'), cell: (j) => (j.closure_email_sent ? 'true' : 'false') },
];
const DEFAULT_WIDTHS = gridWidths(COLS);
/** What the search box can look in, like the "Job Name : contains" box of the old list. */
const SEARCH_FIELDS = ['name', 'stage', 'pm', 'fabm', 'deal', 'id', 'status'];

/** One CSV cell; values that start with = + - @ are prefixed so a spreadsheet never runs them as a formula. */
const csvCell = (v: unknown) => {
	let s = v === null || v === undefined ? '' : String(v);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportCsv(rows: Job[], cols: Col[]) {
	const lines = [cols.map((c) => c.label).join(',')].concat(rows.map((j) => cols.map((c) => csvCell(c.value(j))).join(',')));
	const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = 'jobs.csv';
	a.click();
	URL.revokeObjectURL(url);
}

/** Columns added after the first release: shown by default for everyone, even when a list was saved before they existed. */
const NEW_COLS = ['exp', 'afab', 'rfab', 'quote'];

/** The visible columns, remembered per browser. `known` records which columns the user has already seen, so a new column is shown once, not forever. */
function readCols(): string[] {
	const all = COLS.map((c) => c.key);
	try {
		const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null');
		if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return [...v, ...NEW_COLS.filter((k) => !v.includes(k))];
		if (v && Array.isArray(v.visible) && Array.isArray(v.known)) {
			const unseen = all.filter((k) => !v.known.includes(k));
			return [...v.visible, ...unseen.filter((k) => !v.visible.includes(k))];
		}
	} catch { /* none saved */ }
	return all;
}

/** The jobs list as a wide grid with the same columns as the old "All Jobs" report, plus our views, filters, column picker and CSV. */
export function Jobs() {
	const [params, setParams] = useSearchParams();
	const text = params.get('q') ?? '';
	const [field, setField] = useState('name');
	const [stage, setStage] = useState('');
	const [pm, setPm] = useState('');
	const [fab, setFab] = useState('');
	const [op, setOp] = useState<SearchOp>('contains');
	const [panelOpen, setPanelOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const [view, setView] = useState<keyof JobTabCounts>('all');
	const [picked, setPicked] = useState<string[]>([]);
	const [visible, setVisible] = useState<string[]>(readCols);
	const grid = useGridLayout('ve.grid.jobs', DEFAULT_WIDTHS);
	const jobs = useJobs(stage || undefined, view, { pm_id: pm || undefined, fab_manager_id: fab || undefined });
	const me = useMe();
	const canManage = !!me.data?.permissions.createJob;
	const canEdit = !!me.data?.permissions.editJob;
	const canDelete = !!me.data?.permissions.deleteJob;
	const confirm = useConfirm();
	const { notify } = useToast();
	const deleteJobs = useDeleteJobs();
	const [menu, setMenu] = useState<{ x: number; y: number; job: Job } | null>(null);
	const seesMoney = !!me.data?.roles.includes('admin');
	const people = usePeople(canManage);
	const navigate = useNavigate();
	const location = useLocation();

	const cols = useMemo(() => COLS.filter((c) => visible.includes(c.key) && (!c.admin || seesMoney)), [visible, seesMoney]);
		const needle = useMemo(() => text.trim().toLowerCase(), [text]);
	const searchCol = useMemo(() => COLS.find((c) => c.key === field) ?? COLS[0], [field]);
	const all = useMemo(() => jobs.data?.items ?? [], [jobs.data]);
	const shown = useMemo(() => all.filter((j) => !needle || matchesOp(String(searchCol.value(j)).toLowerCase(), needle, op)), [all, needle, searchCol, op]);
	// The page goes back to 1 whenever the search, view or filters change, without an effect: the page is only valid for the filters it was chosen under.
	const filterKey = [view, stage, pm, fab, field, op, needle].join('|');
	const [pageAt, setPageAt] = useState<{ key: string; page: number }>({ key: '', page: 0 });
	const pageCount = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
	const page = Math.min(pageAt.key === filterKey ? pageAt.page : 0, pageCount - 1);
	const pageRows = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
	const rangeFrom = shown.length ? page * PAGE_SIZE + 1 : 0;
	const rangeTo = Math.min(shown.length, (page + 1) * PAGE_SIZE);
	const counts = jobs.data?.counts;
	const activeFilters = [stage, pm, fab].filter(Boolean).length;
	const managers = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const managerName = (id: string) => { const p = managers.find((m) => m.ROWID === id); return p ? `${p.first_name} ${p.last_name ?? ''}`.trim() : id; };
	const searchActive = !!needle || activeFilters > 0 || view !== 'all';
	const opLabel = OPS.find((o) => o.key === op)?.label.toLowerCase() ?? 'contains';
	const clearAll = () => { setView('all'); setPicked([]); setField('name'); setOp('contains'); setStage(''); setPm(''); setFab(''); setParams({}, { replace: true }); };
	const openPanel = () => { setDraft({ field, op, text, stage, pm, fab }); setPanelOpen(true); };
	const clearDraft = () => setDraft(emptyDraft);
	const applyPanel = () => {
		setField(draft.field); setOp(draft.op); setStage(draft.stage); setPm(draft.pm); setFab(draft.fab);
		setParams(draft.text.trim() ? { q: draft.text.trim() } : {}, { replace: true });
		setPanelOpen(false);
	};
	const chips: ActiveChip[] = [
		...(view !== 'all' ? [{ key: 'view', label: `View: ${VIEWS.find((v) => v.key === view)?.label ?? view}`, onRemove: () => { setView('all'); setPicked([]); } }] : []),
		...(needle ? [{ key: 'q', label: `${searchCol.label} ${opLabel} "${text.trim()}"`, onRemove: () => setParams({}, { replace: true }) }] : []),
		...(stage ? [{ key: 'stage', label: `Stage: ${stage}`, onRemove: () => setStage('') }] : []),
		...(pm ? [{ key: 'pm', label: `Project manager: ${managerName(pm)}`, onRemove: () => setPm('') }] : []),
		...(fab ? [{ key: 'fab', label: `Fab manager: ${managerName(fab)}`, onRemove: () => setFab('') }] : []),
	];
	const chosen = shown.filter((j) => picked.includes(j.ROWID));
	const editJob = (id: string) => navigate(`/jobs/${id}/edit`, { state: { background: location } });
	/** Ask first, then delete the given jobs in one request. The server says why when it refuses (booked hours, unfinished tasks). */
	const askDelete = async (list: Job[]) => {
		const what = list.length === 1 ? `"${list[0].name}"` : `these ${list.length} jobs`;
		if (!(await confirm({ message: `Delete ${what}? ${list.length === 1 ? 'It disappears' : 'They disappear'} from every list and cannot be restored from the app.`, confirmLabel: 'Delete' }))) return;
		deleteJobs.mutate(list.map((j) => j.ROWID), {
			onSuccess: () => { setPicked((cur) => cur.filter((id) => !list.some((j) => j.ROWID === id))); notify(list.length === 1 ? 'Job deleted' : `${list.length} jobs deleted`); },
			onError: (e) => notify(e instanceof Error ? e.message : 'Could not delete', 'error'),
		});
	};
	const menuItems = (job: Job): MenuItem[] => [
		...(canEdit ? [{ label: 'Edit', onSelect: () => editJob(job.ROWID) }] : []),
		...(canDelete ? [{ label: 'Delete', onSelect: () => askDelete([job]) }] : []),
	];

	const toggleCol = (key: string) => {
		const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
		if (next.length === 0) return;
		setVisible(next);
		try { localStorage.setItem(COLS_KEY, JSON.stringify({ visible: next, known: COLS.map((c) => c.key) })); } catch { /* not saved */ }
	};

	return (
		<>
			<PageHeader eyebrow="Projects" title="All Jobs" subtitle="Every job from deal to finished install.">
				<ListToolbarButtons
					searchOpen={panelOpen}
					onSearchOpen={openPanel}
					searchActive={searchActive}
					viewOptions={(
											<>
												<p className="filter-pop__title">Row height</p>
												<RowHeightPicker value={grid.rows} onChange={grid.setRows} />
												<p className="filter-pop__title">Columns</p>
												<div className="lt-cols">
													{COLS.filter((c) => !c.admin || seesMoney).map((c) => (
														<label key={c.key} className="check"><input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}</label>
													))}
												</div>
												<div className="filter-pop__actions">
													<button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVisible(COLS.map((c) => c.key)); try { localStorage.removeItem(COLS_KEY); } catch { /* ignore */ } }}>Show all columns</button>
													<button type="button" className="btn btn-ghost btn-sm" onClick={grid.reset}>Reset widths</button>
												</div>
											</>
										)}
					actions={(
											<button type="button" className="btn btn-ghost lt-btn" onClick={() => exportCsv(chosen.length ? chosen : shown, cols.filter((c) => c.key !== 'actions'))} disabled={shown.length === 0}>
												<Download size={14} aria-hidden="true" /> Export CSV
											</button>
										)}
				/>
				{canManage && (
					<button className="btn" onClick={() => navigate('/jobs/new', { state: { background: location } })}>
						<Plus size={16} aria-hidden="true" /> Add
					</button>
				)}
			</PageHeader>

			<Card flush>
				<ListToolbar
					label="Jobs list"
					searchOpen={panelOpen}
					panelTitle="Search jobs"
					onPanelClose={() => setPanelOpen(false)}
					onPanelApply={applyPanel}
					onPanelClear={clearDraft}
					panelBody={(
						<>
							<PanelSection title="Show" summary={VIEWS.find((v) => v.key === view)?.label} defaultOpen={false}>
								<div className="lt-views" role="radiogroup" aria-label="Views">
									{VIEWS.map((v) => (
										<button key={v.key} type="button" role="radio" aria-checked={view === v.key} className={'lt-view' + (view === v.key ? ' is-on' : '')} onClick={() => { setView(v.key); setPicked([]); }}>
											<span>{v.label}</span>
											<span className="lt-count num">{counts?.[v.key] ?? 0}</span>
										</button>
									))}
								</div>
							</PanelSection>
							<div className="lt-form">
								<span className="toolbar__label">Search in</span>
								<div className="lt-form__row">
									<select aria-label="Field" value={draft.field} onChange={(e) => setDraft({ ...draft, field: e.target.value })}>
										{SEARCH_FIELDS.map((k) => <option key={k} value={k}>{COLS.find((c) => c.key === k)?.label}</option>)}
									</select>
									<select aria-label="Condition" value={draft.op} onChange={(e) => setDraft({ ...draft, op: e.target.value as SearchOp })}>
										{OPS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
									</select>
								</div>
								<input type="search" aria-label="Search text" placeholder="Type to search" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
							</div>
							<div className="lt-form">
								<span className="toolbar__label">Stage</span>
								<select aria-label="Stage" value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value })}>
									<option value="">All stages</option>
									{STAGES.map((s) => <option key={s}>{s}</option>)}
								</select>
							</div>
							{canManage && (
								<>
									<div className="lt-form">
										<span className="toolbar__label">Project manager</span>
										<select aria-label="Project manager" value={draft.pm} onChange={(e) => setDraft({ ...draft, pm: e.target.value })}>
											<option value="">Anyone</option>
											{managers.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
										</select>
									</div>
									<div className="lt-form">
										<span className="toolbar__label">Fab manager</span>
										<select aria-label="Fab manager" value={draft.fab} onChange={(e) => setDraft({ ...draft, fab: e.target.value })}>
											<option value="">Anyone</option>
											{managers.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
										</select>
									</div>
								</>
							)}
						</>
					)}
										chips={chips}
					onClearAll={clearAll}
				/>

				{chosen.length > 0 && (
					<div className="bulk-bar" role="region" aria-label="Selected jobs">
						<strong className="num">{chosen.length}</strong> selected
						{chosen.length === 1 && canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => editJob(chosen[0].ROWID)}><Pencil size={14} aria-hidden="true" /> Edit</button>}
						{canDelete && <button type="button" className="btn btn-danger btn-sm" disabled={deleteJobs.isPending} onClick={() => askDelete(chosen)}><Trash2 size={14} aria-hidden="true" /> Delete</button>}
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>Clear</button>
					</div>
				)}

				{jobs.isPending && <p role="status" className="table-empty">Loading jobs…</p>}
				{jobs.isError && (
					<p role="alert">Could not load jobs. <button className="btn btn-ghost btn-sm" onClick={() => jobs.refetch()}>Try again</button></p>
				)}
				{jobs.isSuccess && shown.length === 0 && <p className="table-empty">{needle ? 'No jobs match that search.' : 'No jobs to show.'}</p>}

				{jobs.isSuccess && shown.length > 0 && (
					<ResizableGrid
						layout={grid}
						label="All jobs"
						columns={cols.map((c) => ({ key: c.key, label: c.label, width: c.width, right: c.right, cell: (j: Job) => c.cell(j) }))}
						key={filterKey + '|' + page}
						rows={pageRows}
						rowKey={(j) => j.ROWID}
						picked={canManage ? picked : undefined}
						onPick={canManage ? setPicked : undefined}
						rowMenu={canEdit || canDelete ? (j: Job) => (
							<button type="button" className="row-menu-btn" aria-label={`Actions for ${j.name}`} aria-haspopup="menu" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.left, y: r.bottom + 4, job: j }); }}>
								<MoreHorizontal size={16} aria-hidden="true" />
							</button>
						) : undefined}
					/>
				)}
			</Card>
			{menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.job)} onClose={() => setMenu(null)} />}
			{jobs.isSuccess && (
				<GridStatusBar
					pager={<Pagination page={page} pageCount={pageCount} onPage={(p) => setPageAt({ key: filterKey, page: p })} />}
					text={<><span>{pageCount > 1 ? `Showing ${rangeFrom}–${rangeTo} of ${shown.length}` : `Showing ${shown.length} of ${jobs.data.total ?? all.length}`}{jobs.data.truncated ? ' (the first 300 jobs)' : ''}</span><span>{chosen.length > 0 ? `${chosen.length} selected` : ''}</span></>}
				/>
			)}
		</>
	);
}
