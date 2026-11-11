import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { useMe } from '../api/queries';
import { pdfUrl, useChecklistReport, useSwmsList } from '../api/more';
import type { SwmsListItem } from '../api/more';
import { Chip } from '../components/Chip';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn } from '../components/GridKit';
import { Card, FilterBar, FilterChips, PageHeader, fmtDate, TableFooter } from '../components/ui';

interface View {
	key: string;
	label: string;
	test: (s: SwmsListItem, mineIds: Set<string>) => boolean;
}
const done = (s: SwmsListItem) => ['TL Signed', 'Not Required', 'Completed', 'Closed'].includes(s.status);
const VIEWS: View[] = [
	{ key: 'all', label: 'All', test: () => true },
	{ key: 'my_open', label: 'My open', test: (s, m) => !done(s) && !!s.task && m.has(s.task.id) },
	{ key: 'my_done', label: 'My completed', test: (s, m) => done(s) && !!s.task && m.has(s.task.id) },
	{ key: 'pm', label: 'Awaiting PM', test: (s) => s.status === 'Created' },
	{ key: 'tl', label: 'Awaiting team leader', test: (s) => s.status === 'PM Signed' },
	{ key: 'signed', label: 'Fully signed', test: (s) => s.status === 'TL Signed' },
	{ key: 'finished', label: 'Completed or closed', test: (s) => s.status === 'Completed' || s.status === 'Closed' },
];

/** Three-part bar: project manager, team leader, crew declarations. */
function SignBar({ p }: { p: SwmsListItem['progress'] }) {
	const crewDone = p.crewTotal > 0 && p.crewSigned >= p.crewTotal;
	return (
		<span className="two-line">
			<span className="bar-parts" role="img" aria-label={`Project manager ${p.pm ? 'signed' : 'not yet'}, team leader ${p.tl ? 'signed' : 'not yet'}, crew ${p.crewSigned} of ${p.crewTotal}`}>
				<span className={p.pm ? 'on' : ''} />
				<span className={p.tl ? 'on' : ''} />
				<span className={crewDone ? 'on' : ''} />
			</span>
			<small>PM · TL · Crew {p.crewSigned}/{p.crewTotal}</small>
		</span>
	);
}

/** Columns of the signing queue, as the list grid shows them. */
const COLUMNS: GridColumn<SwmsListItem>[] = [
	{ key: 'task', label: 'Install task', width: 300, cell: (s) => (
		<>
			{s.task ? <Link to={'/tasks/' + s.task.id}>{s.task.name}</Link> : <strong>SWMS {s.id}</strong>}
			<small className="sub">{s.jobName ? <Link to={'/jobs/' + s.jobId}>{s.jobName}</Link> : null}{s.siteAddress ? ` · ${s.siteAddress}` : ''}</small>
		</>
	) },
	{ key: 'onsite', label: 'On site', width: 130, cell: (s) => fmtDate(s.onSite) },
	{ key: 'signing', label: 'Signing', width: 230, cell: (s) => <SignBar p={s.progress} /> },
	{ key: 'status', label: 'Status', width: 150, cell: (s) => <Chip status={s.status} /> },
	{ key: 'actions', label: 'Actions', width: 200, cell: (s) => (
		<div className="actions">
			{s.task && !done(s) && <Link className="btn btn-ghost btn-sm" to={'/tasks/' + s.task.id}>{s.status === 'Created' ? 'Sign as PM' : 'Open'}</Link>}
			<a className="btn btn-ghost btn-sm" href={pdfUrl(`/swms/${s.id}/pdf`)} target="_blank" rel="noreferrer" aria-label={`PDF of SWMS ${s.id}`}><FileDown size={14} aria-hidden="true" /> PDF</a>
		</div>
	) },
];
const WIDTHS = gridWidths(COLUMNS);

/** Safe work method statements as a signing queue: filter by what is waiting, see who has signed, open the task to sign. */
export function SwmsList() {
	const [view, setView] = useState('my_open');
	const [text, setText] = useState('');
	const [panelOpen, setPanelOpen] = useState(false);
	const [draft, setDraft] = useState('');
	const grid = useGridLayout('ve.grid.swms', WIDTHS);
	const me = useMe();
	const q = useSwmsList('all', false);
	const items = useMemo(() => q.data?.items ?? [], [q.data]);
	// "mine" = SWMS of tasks I am on. The server already limits crew to theirs; for managers the crew list is not sent, so a manager's
	// "mine" falls back to everything they can see.
	const mineIds = useMemo(() => new Set(items.filter((s) => s.task).map((s) => s.task!.id)), [items]);
	const isCrew = !(me.data?.permissions.assignPeople ?? false);
	const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, items.filter((s) => v.test(s, isCrew ? mineIds : new Set())).length])), [items, mineIds, isCrew]);
	const current = VIEWS.find((v) => v.key === view) ?? VIEWS[0];
	const needle = text.trim().toLowerCase();
	const shown = items.filter((s) => current.test(s, isCrew ? mineIds : new Set()) && (!needle || (s.task?.name ?? '').toLowerCase().includes(needle) || (s.jobName ?? '').toLowerCase().includes(needle) || s.id.includes(needle)));
	const viewList = VIEWS.filter((v) => !(isCrew === false && (v.key === 'my_open' || v.key === 'my_done')));
	const searchActive = !!needle || view !== 'my_open';
	const openPanel = () => { setDraft(text); setPanelOpen(true); };
	const clearDraft = () => setDraft('');
	const applyPanel = () => { setText(draft); setPanelOpen(false); };
	const clearAll = () => { setView('my_open'); setText(''); };
	const chips: ActiveChip[] = [
		...(view !== 'my_open' ? [{ key: 'view', label: `View: ${current.label}`, onRemove: () => setView('my_open') }] : []),
		...(needle ? [{ key: 'q', label: `Search "${text.trim()}"`, onRemove: () => setText('') }] : []),
	];

	return (
		<>
			<PageHeader eyebrow="Safety" title="SWMS" subtitle="Statements for install tasks. A crew goes on site only once the statement is signed.">
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
			<Card flush>
				{q.isSuccess && (
					<FilterBar>
					<FilterChips label="Summary" value={view} onChange={setView} chips={[
						{ key: 'all', label: 'All statements', count: counts.all },
						{ key: 'pm', label: 'Awaiting PM', count: counts.pm, danger: true },
						{ key: 'tl', label: 'Awaiting team leader', count: counts.tl, danger: true },
						{ key: 'signed', label: 'Fully signed', count: counts.signed },
					]} />
					</FilterBar>
				)}
				<ListToolbar
					label="SWMS list"
					searchOpen={panelOpen}
					panelTitle="Search SWMS"
					onPanelClose={() => setPanelOpen(false)}
					onPanelApply={applyPanel}
					onPanelClear={clearDraft}
					panelBody={(
						<>
							<PanelSection title="Show" summary={current.label} defaultOpen={false}>
								<div className="lt-views" role="radiogroup" aria-label="Views">
									{viewList.map((v) => (
										<button key={v.key} type="button" role="radio" aria-checked={view === v.key} className={'lt-view' + (view === v.key ? ' is-on' : '')} onClick={() => setView(v.key)}>
											<span>{v.label}</span>
											<span className="lt-count num">{counts[v.key]}</span>
										</button>
									))}
								</div>
							</PanelSection>
							<div className="lt-form">
								<span className="toolbar__label">Search</span>
								<input type="search" aria-label="Search SWMS" placeholder="Task, job or number" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
							</div>
						</>
					)}
					chips={chips}
					onClearAll={clearAll}
				/>
				{q.isPending && <p role="status" className="table-empty">Loading…</p>}
				{q.isError && <p role="alert">Could not load SWMS.</p>}
				{q.isSuccess && shown.length === 0 && <p className="table-empty">Nothing in this view.</p>}
				{q.isSuccess && shown.length > 0 && (
					<ResizableGrid layout={grid} label="SWMS" columns={COLUMNS} rows={shown} rowKey={(s) => s.id} />
				)}
			</Card>
			{q.isSuccess && <GridStatusBar text={`Showing ${shown.length} of ${items.length}`} />}
		</>
	);
}

/** Pre-job and post-job checklists across tasks (managers see everyone's; crew see their own). */
export function ChecklistReport() {
	const [phase, setPhase] = useState('');
	const [status, setStatus] = useState('');
	const q = useChecklistReport(phase, status);

	return (
		<>
			<PageHeader eyebrow="Reports" title="Checklists" subtitle="Which checklists are done and which are still open." />
			<Card flush>
				<div className="inline-form">
					<label style={{ flex: '0 1 180px' }}>
						<span className="toolbar__label">Phase</span>
						<select value={phase} onChange={(e) => setPhase(e.target.value)}>
							<option value="">All</option><option value="pre">Pre-job</option><option value="post">Post-job</option>
						</select>
					</label>
					<label style={{ flex: '0 1 200px' }}>
						<span className="toolbar__label">Status</span>
						<select value={status} onChange={(e) => setStatus(e.target.value)}>
							<option value="">All</option><option>In Progress</option><option>Completed</option><option>Not Completed</option>
						</select>
					</label>
				</div>
				{q.isPending && <p role="status" className="table-empty">Loading…</p>}
				{q.isError && <p role="alert">Could not load checklists.</p>}
				{q.isSuccess && q.data.items.length === 0 && <p className="table-empty">No checklists match.</p>}
				{q.isSuccess && q.data.items.length > 0 && (
					<><div className="table-wrap">
						<table className="table">
							<caption className="sr-only">Checklists</caption>
							<thead>
								<tr><th scope="col">Task</th><th scope="col">Phase</th><th scope="col">Role</th><th scope="col">Hours</th><th scope="col">Status</th></tr>
							</thead>
							<tbody>
								{q.data.items.map((c) => (
									<tr key={c.id}>
										<td data-label="Task" className="cell-primary"><Link to={'/checklists/' + c.id}>{c.taskName || 'Task ' + c.taskId}</Link></td>
										<td data-label="Phase">{c.phase === 'pre' ? 'Pre-job' : 'Post-job'}</td>
										<td data-label="Role" style={{ textTransform: 'capitalize' }}>{c.role}</td>
										<td data-label="Hours" className="num">{c.hours ?? '-'}</td>
										<td data-label="Status"><Chip status={c.status} /></td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<TableFooter shown={q.data.items.length} />
					</>
				)}
			</Card>
		</>
	);
}
