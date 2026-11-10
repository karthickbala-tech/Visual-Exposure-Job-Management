import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Columns3, Download, ExternalLink, Plus, Search } from 'lucide-react';
import { useJobs, useMe, usePeople } from '../api/queries';
import { num } from '../api/types';
import type { Job, JobTabCounts } from '../api/types';
import { StageCell } from '../components/StageCell';
import { FilterMenu } from '../components/FilterMenu';
import { Card, PageHeader } from '../components/ui';
import { useDismiss } from '../components/useDismiss';

const VIEWS: { key: keyof JobTabCounts; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'my_open', label: 'My open' },
	{ key: 'my_jobs', label: 'My jobs' },
	{ key: 'preparation', label: 'Preparation' },
	{ key: 'ongoing', label: 'Ongoing' },
	{ key: 'completed', label: 'Completed' },
];
const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];
const COLS_KEY = 've.jobs.columns';

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
const COLS: Col[] = [
	{ key: 'name', label: 'Job Name', width: 280, value: (j) => j.name, cell: (j) => (
		<>
			<Link to={`/jobs/${j.ROWID}`}>{j.name}</Link>
			{(j.risk ?? []).map((r) => <small key={r} className="risk"><AlertTriangle size={12} aria-hidden="true" /> {r}</small>)}
		</>
	) },
	{ key: 'stage', label: 'Stage', width: 150, value: (j) => j.stage, cell: (j) => <StageCell stage={j.stage} /> },
	{ key: 'pfab', label: '% Fab Completed', width: 120, right: true, value: (j) => pct(j.percent_fab), cell: (j) => pct(j.percent_fab) },
	{ key: 'pjob', label: '% Job Completed', width: 120, right: true, value: (j) => pct(j.percent_job), cell: (j) => pct(j.percent_job) },
	{ key: 'pinst', label: '% Install Completed', width: 130, right: true, value: (j) => pct(j.percent_install), cell: (j) => pct(j.percent_install) },
	{ key: 'pm', label: 'Project Manager', width: 150, value: (j) => j.pm_name ?? '', cell: (j) => j.pm_name ?? '' },
	{ key: 'fabm', label: 'Fab Manager', width: 150, value: (j) => j.fab_manager_name ?? '', cell: (j) => j.fab_manager_name ?? '' },
	{ key: 'created', label: 'Job Created Date', width: 190, value: (j) => fmtStamp(j.CREATEDTIME ?? j.created_date), cell: (j) => fmtStamp(j.CREATEDTIME ?? j.created_date) },
	{ key: 'wd', label: 'Workdrive Link', width: 140, value: (j) => j.workdrive_url ?? '', cell: (j) => (j.workdrive_url ? <a href={j.workdrive_url} target="_blank" rel="noreferrer">Workdrive Folder <ExternalLink size={12} aria-hidden="true" /></a> : '') },
	{ key: 'ih', label: 'Install Hours Booked', width: 120, right: true, value: (j) => hours(j.install_hours_booked), cell: (j) => hours(j.install_hours_booked) },
	{ key: 'ic', label: 'Install Labour Cost', width: 120, right: true, admin: true, value: (j) => money(j.install_labour_cost), cell: (j) => money(j.install_labour_cost) },
	{ key: 'fh', label: 'Fab Hours Booked', width: 120, right: true, value: (j) => hours(j.fab_hours_booked), cell: (j) => hours(j.fab_hours_booked) },
	{ key: 'fc', label: 'Fab Labour Cost', width: 120, right: true, admin: true, value: (j) => money(j.fab_labour_cost), cell: (j) => money(j.fab_labour_cost) },
	{ key: 'deal', label: 'Deal', width: 200, value: (j) => j.crm_deal_id ?? '', cell: (j) => j.crm_deal_id ?? '' },
	{ key: 'id', label: 'ID', width: 150, value: (j) => j.ROWID, cell: (j) => j.ROWID },
	{ key: 'path', label: 'Folder Location on VE Server', width: 260, value: (j) => j.server_path ?? '', cell: (j) => j.server_path ?? '' },
	{ key: 'status', label: 'Job Status', width: 130, value: (j) => j.job_status ?? '', cell: (j) => j.job_status ?? '' },
	{ key: 'modified', label: 'Modified Time', width: 190, value: (j) => fmtStamp(j.MODIFIEDTIME), cell: (j) => fmtStamp(j.MODIFIEDTIME) },
	{ key: 'closure', label: 'Closure Email Sent', width: 120, value: (j) => (j.closure_email_sent ? 'true' : 'false'), cell: (j) => (j.closure_email_sent ? 'true' : 'false') },
];
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

function readCols(): string[] {
	try {
		const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null');
		if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v;
	} catch { /* none saved */ }
	return COLS.map((c) => c.key);
}

/** The jobs list as a wide grid with the same columns as the old "All Jobs" report, plus our views, filters, column picker and CSV. */
export function Jobs() {
	const [params, setParams] = useSearchParams();
	const text = params.get('q') ?? '';
	const [field, setField] = useState('name');
	const [stage, setStage] = useState('');
	const [pm, setPm] = useState('');
	const [fab, setFab] = useState('');
	const [view, setView] = useState<keyof JobTabCounts>('all');
	const [picked, setPicked] = useState<string[]>([]);
	const [visible, setVisible] = useState<string[]>(readCols);
	const [colsOpen, setColsOpen] = useState(false);
	const colsBox = useRef<HTMLDivElement>(null);
	useDismiss(colsOpen, colsBox, () => setColsOpen(false));
	const jobs = useJobs(stage || undefined, view, { pm_id: pm || undefined, fab_manager_id: fab || undefined });
	const me = useMe();
	const canManage = !!me.data?.permissions.createJob;
	const seesMoney = !!me.data?.roles.includes('admin');
	const people = usePeople(canManage);
	const navigate = useNavigate();

	const cols = useMemo(() => COLS.filter((c) => visible.includes(c.key) && (!c.admin || seesMoney)), [visible, seesMoney]);
	const needle = text.trim().toLowerCase();
	const searchCol = COLS.find((c) => c.key === field) ?? COLS[0];
	const all = useMemo(() => jobs.data?.items ?? [], [jobs.data]);
	const shown = useMemo(() => all.filter((j) => !needle || String(searchCol.value(j)).toLowerCase().includes(needle)), [all, needle, searchCol]);
	const counts = jobs.data?.counts;
	const activeFilters = [stage, pm, fab].filter(Boolean).length;
	const managers = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const allPicked = shown.length > 0 && shown.every((j) => picked.includes(j.ROWID));
	const chosen = shown.filter((j) => picked.includes(j.ROWID));

	const toggleCol = (key: string) => {
		const next = visible.includes(key) ? visible.filter((k) => k !== key) : [...visible, key];
		if (next.length === 0) return;
		setVisible(next);
		try { localStorage.setItem(COLS_KEY, JSON.stringify(next)); } catch { /* not saved */ }
	};

	return (
		<>
			<PageHeader eyebrow="Projects" title="All Jobs" subtitle={jobs.isSuccess ? `Showing ${shown.length} of ${jobs.data.total ?? all.length}` : 'Every job from deal to finished install.'}>
				{canManage && (
					<button className="btn" onClick={() => navigate('/jobs/new')}>
						<Plus size={16} aria-hidden="true" /> Add
					</button>
				)}
			</PageHeader>

			<Card flush>
				<div className="list-toolbar">
					<div className="search-builder">
						<label className="sr-only" htmlFor="job-search-field">Search in</label>
						<select id="job-search-field" value={field} onChange={(e) => setField(e.target.value)}>
							{SEARCH_FIELDS.map((k) => <option key={k} value={k}>{COLS.find((c) => c.key === k)?.label}</option>)}
						</select>
						<span className="search-builder__op">contains</span>
						<label className="search">
							<Search size={16} aria-hidden="true" />
							<input type="search" value={text} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Search…" aria-label="Search jobs" />
						</label>
					</div>
					<FilterMenu
						views={VIEWS.map((v) => ({ key: v.key, label: v.label, count: counts?.[v.key] }))}
						view={view}
						onView={(k) => { setView(k as typeof view); setPicked([]); }}
						extraCount={activeFilters}
						onClear={() => { setStage(''); setPm(''); setFab(''); }}
						extra={(
							<>
								<label>
									<span className="toolbar__label">Stage</span>
									<select value={stage} onChange={(e) => setStage(e.target.value)}>
										<option value="">All stages</option>
										{STAGES.map((s) => <option key={s}>{s}</option>)}
									</select>
								</label>
								{canManage && (
									<>
										<label>
											<span className="toolbar__label">Project manager</span>
											<select value={pm} onChange={(e) => setPm(e.target.value)}>
												<option value="">Anyone</option>
												{managers.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
											</select>
										</label>
										<label>
											<span className="toolbar__label">Fab manager</span>
											<select value={fab} onChange={(e) => setFab(e.target.value)}>
												<option value="">Anyone</option>
												{managers.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
											</select>
										</label>
									</>
								)}
							</>
						)}
					/>
					<div className="filter-menu" ref={colsBox} style={{ marginLeft: 'auto' }}>
						<button type="button" className="btn btn-ghost" aria-expanded={colsOpen} aria-haspopup="true" onClick={() => setColsOpen(!colsOpen)}>
							<Columns3 size={15} aria-hidden="true" /> Columns
						</button>
						{colsOpen && (
							<div className="filter-pop filter-pop--right" role="group" aria-label="Columns">
								<p className="filter-pop__title">Show columns</p>
								<div className="check-grid">
									{COLS.filter((c) => !c.admin || seesMoney).map((c) => (
										<label key={c.key} className="check"><input type="checkbox" checked={visible.includes(c.key)} onChange={() => toggleCol(c.key)} /> {c.label}</label>
									))}
								</div>
								<button type="button" className="btn btn-ghost btn-sm" onClick={() => { setVisible(COLS.map((c) => c.key)); try { localStorage.removeItem(COLS_KEY); } catch { /* ignore */ } }}>Show all</button>
							</div>
						)}
					</div>
					<button type="button" className="btn btn-ghost" onClick={() => exportCsv(chosen.length ? chosen : shown, cols)} disabled={shown.length === 0}>
						<Download size={15} aria-hidden="true" /> CSV
					</button>
				</div>

				{needle && (
					<div className="search-tags">
					<span className="search-tags__label">Search</span>
					<span className="search-tag">{searchCol.label} : contains "{text.trim()}" <button type="button" aria-label="Clear the search" onClick={() => setParams({}, { replace: true })}>×</button></span>
					</div>
				)}

				{chosen.length > 0 && (
					<div className="bulk-bar" role="region" aria-label="Selected jobs">
						<strong className="num">{chosen.length}</strong> selected
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>Clear</button>
					</div>
				)}

				{jobs.isPending && <p role="status" className="table-empty">Loading jobs…</p>}
				{jobs.isError && (
					<p role="alert">Could not load jobs. <button className="btn btn-ghost btn-sm" onClick={() => jobs.refetch()}>Try again</button></p>
				)}
				{jobs.isSuccess && shown.length === 0 && <p className="table-empty">{needle ? 'No jobs match that search.' : 'No jobs to show.'}</p>}

				{jobs.isSuccess && shown.length > 0 && (
					<div className="grid-wrap">
						<table className="grid-table">
							<caption className="sr-only">All jobs</caption>
							<thead>
								<tr>
									{canManage && (
										<th scope="col" className="col-check">
											<input type="checkbox" aria-label="Select all jobs shown" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? shown.map((j) => j.ROWID) : [])} />
										</th>
									)}
									{cols.map((c, i) => <th key={c.key} scope="col" className={(i === 0 ? 'sticky-col ' : '') + (c.right ? 'num' : '')} style={{ minWidth: c.width }}>{c.label}</th>)}
								</tr>
							</thead>
							<tbody>
								{shown.map((j) => (
									<tr key={j.ROWID} className={picked.includes(j.ROWID) ? 'row-picked' : ''}>
										{canManage && (
											<td className="col-check">
												<input type="checkbox" aria-label={`Select ${j.name}`} checked={picked.includes(j.ROWID)} onChange={(e) => setPicked(e.target.checked ? [...picked, j.ROWID] : picked.filter((x) => x !== j.ROWID))} />
											</td>
										)}
										{cols.map((c, i) => <td key={c.key} className={(i === 0 ? 'sticky-col ' : '') + (c.right ? 'num' : '')}>{c.cell(j)}</td>)}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
				{jobs.isSuccess && <p className="grid-foot">Showing {shown.length} of {jobs.data.total ?? all.length}{jobs.data.truncated ? ' (the first 300 jobs)' : ''}</p>}
			</Card>
		</>
	);
}
