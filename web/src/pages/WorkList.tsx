import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LayoutList, Columns3 } from 'lucide-react';
import { useMe } from '../api/queries';
import { useWorkTasks } from '../api/more';
import type { WorkTask } from '../api/more';
import { num } from '../api/types';
import { Chip } from '../components/Chip';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import { ResizableGrid, RowHeightPicker, useGridLayout } from '../components/GridKit';
import type { GridColumn } from '../components/GridKit';
import type { ActiveChip } from '../components/ListToolbar';
import { Card, Kpi, PageHeader, fmtDate, TableFooter } from '../components/ui';

/** The search, type and grouping values the panel edits before they are applied. */
interface Draft { text: string; type: string; byJob: boolean }

type Kind = 'design' | 'fabrication' | 'install';
const COPY: Record<Kind, { eyebrow: string; title: string; subtitle: string }> = {
	design: { eyebrow: 'Work', title: 'Design', subtitle: 'Artwork and proofs, from assignment to approval.' },
	fabrication: { eyebrow: 'Work', title: 'Fabrication', subtitle: 'Everything being made in the workshop and on the CNC.' },
	install: { eyebrow: 'Work', title: 'Installation', subtitle: 'Crews, dates and SWMS for every install.' },
};
const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const today = () => new Date().toISOString().slice(0, 10);

interface ViewDef {
	key: string;
	label: string;
	test: (t: WorkTask, me: string | null) => boolean;
}
const open = (t: WorkTask) => !DONE.includes(t.stage);
const late = (t: WorkTask) => open(t) && !!t.required_finish && t.required_finish.slice(0, 10) < today();
const viewsFor = (kind: Kind): ViewDef[] => [
	{ key: 'open', label: 'All open', test: open },
	{ key: 'mine', label: 'Mine', test: (t, me) => open(t) && !!me && (t.crew ?? []).some((c) => c.personId === me) },
	{ key: 'unscheduled', label: kind === 'design' ? 'To assign' : 'Unscheduled', test: (t) => ['Awaiting Scheduling', 'To be Assigned'].includes(t.stage) },
	{ key: 'scheduled', label: 'Scheduled', test: (t) => t.stage === 'Scheduled' },
	{ key: 'progress', label: 'In progress', test: (t) => t.stage === 'In Progress' },
	{ key: 'review', label: 'In review', test: (t) => t.stage === 'Manager Review' },
	{ key: 'overdue', label: 'Overdue', test: late },
	...(kind === 'install' ? [{ key: 'swms', label: 'SWMS unsigned', test: (t: WorkTask) => open(t) && !!t.swms_id && !['TL Signed', 'Not Required', 'Completed', 'Closed'].includes(t.swms_status ?? '') }] : []),
	{ key: 'done', label: 'Completed', test: (t) => ['Completed', 'Approved & Completed'].includes(t.stage) },
	{ key: 'all', label: 'Everything', test: () => true },
];
const BOARD: Record<Kind, string[]> = {
	design: ['To be Assigned', 'In Progress', 'Manager Review', 'Completed'],
	fabrication: ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'],
	install: ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'],
};

const WORK_WIDTHS = { task: 280, date: 170, people: 200, swms: 120, stage: 150, hours: 130, action: 120 };
const initials = (name: string | null) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
const action = (t: WorkTask) => (t.stage === 'Manager Review' ? 'Review' : ['Awaiting Scheduling', 'To be Assigned'].includes(t.stage) ? (t.task_type === 'design' ? 'Assign' : 'Schedule') : null);

function Hours({ t }: { t: WorkTask }) {
	const q = num(t.quoted_hours);
	const b = num(t.booked_hours);
	if (!q && !b) return <span className="muted">-</span>;
	const over = q > 0 && b > q;
	return (
		<span className="two-line">
			<span className="mini-bar" role="img" aria-label={`${b} of ${q} hours`}>
				<span className={over ? 'over-fill' : ''} style={{ width: `${q ? Math.min(100, (b / q) * 100) : 100}%` }} />
			</span>
			<small className={'num' + (over ? ' over' : '')}>{b} / {q}h</small>
		</span>
	);
}

/** One work screen for design, fabrication or installation: saved views with counts, search, a list or a board, and the next action for each task. */
export function WorkList({ kind, embedded = false }: { kind: Kind; embedded?: boolean }) {
	const copy = COPY[kind];
	const me = useMe();
	const myId = me.data?.person ? String(me.data.person.ROWID) : null;
	const q = useWorkTasks(kind);
	const [view, setView] = useState('open');
	const [text, setText] = useState('');
	const [type, setType] = useState('');
	const [layout, setLayout] = useState<'list' | 'board'>(embedded ? 'board' : 'list');
	const [byJob, setByJob] = useState(false);
	const [panelOpen, setPanelOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>({ text: '', type: '', byJob: false });

	const views = useMemo(() => viewsFor(kind), [kind]);
	const layoutToggle = (
		<div className="segmented" role="group" aria-label="Layout">
			<button className={layout === 'list' ? 'on' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><LayoutList size={14} aria-hidden="true" /> List</button>
			<button className={layout === 'board' ? 'on' : ''} aria-pressed={layout === 'board'} onClick={() => setLayout('board')}><Columns3 size={14} aria-hidden="true" /> Board</button>
		</div>
	);
	const all = useMemo(() => q.data?.items ?? [], [q.data]);
	const counts = useMemo(() => Object.fromEntries(views.map((v) => [v.key, all.filter((t) => v.test(t, myId)).length])), [views, all, myId]);
	const kinds = useMemo(() => [...new Set(all.map((t) => t.kind).filter(Boolean))] as string[], [all]);
	const needle = text.trim().toLowerCase();
	const current = views.find((v) => v.key === view) ?? views[0];
	const shown = useMemo(
		() =>
			all
				.filter((t) => current.test(t, myId) && (!type || t.kind === type) && (!needle || t.name.toLowerCase().includes(needle) || (t.job_name ?? '').toLowerCase().includes(needle)))
				.sort((a, b) => (byJob ? (a.job_name ?? '').localeCompare(b.job_name ?? '') : 0) || (a.scheduled_date ?? '9999').localeCompare(b.scheduled_date ?? '9999')),
		[all, current, myId, type, needle, byJob],
	);
	const searchActive = !!needle || !!type || view !== 'open' || byJob;
	const openPanel = () => { setDraft({ text, type, byJob }); setPanelOpen(true); };
	const clearDraft = () => setDraft({ text: '', type: '', byJob: false });
	const applyPanel = () => { setText(draft.text); setType(draft.type); setByJob(draft.byJob); setPanelOpen(false); };
	const clearAll = () => { setView('open'); setText(''); setType(''); setByJob(false); };
	const chips: ActiveChip[] = [
		...(view !== 'open' ? [{ key: 'view', label: `View: ${views.find((v) => v.key === view)?.label ?? view}`, onRemove: () => setView('open') }] : []),
		...(needle ? [{ key: 'q', label: `Search "${text.trim()}"`, onRemove: () => setText('') }] : []),
		...(type ? [{ key: 'type', label: `Type: ${type}`, onRemove: () => setType('') }] : []),
		...(byJob ? [{ key: 'job', label: 'Grouped by job', onRemove: () => setByJob(false) }] : []),
	];
	const grid = useGridLayout('ve.grid.work', WORK_WIDTHS);
	const workColumns: GridColumn<WorkTask>[] = [
		{ key: 'task', label: 'Task', width: WORK_WIDTHS.task, cell: (t) => (
			<>
				<Link to={'/tasks/' + t.ROWID}>{t.parent_id ? '↳ ' : ''}{t.name}</Link>
				<small className="sub">
					{!byJob && t.job_name ? <Link to={'/jobs/' + t.job_id}>{t.job_name}</Link> : null}
					{t.kind ? <>{!byJob && t.job_name ? ' · ' : ''}{t.kind}</> : null}
				</small>
			</>
		) },
		{ key: 'date', label: 'Date', width: WORK_WIDTHS.date, cell: (t) => (
			<span className={late(t) ? 'over' : ''}>
				{fmtDate(t.scheduled_date)}
				{late(t) && <small className="risk"><AlertTriangle size={12} aria-hidden="true" /> Due {fmtDate(t.required_finish)}</small>}
			</span>
		) },
		{ key: 'people', label: 'People', width: WORK_WIDTHS.people, cell: (t) => (
			(t.crew ?? []).length ? (
				<span className="avatars">
					{(t.crew ?? []).slice(0, 3).map((c) => (
						<span key={c.personId} className="mini-avatar" title={`${c.name ?? 'Unknown'} (${c.role})`}>{initials(c.name)}</span>
					))}
					{(t.crew ?? []).length > 3 && <span className="mini-avatar more">+{(t.crew ?? []).length - 3}</span>}
				</span>
			) : (
				<span className="muted">Nobody yet</span>
			)
		) },
		...(kind === 'install' ? [{ key: 'swms', label: 'SWMS', width: WORK_WIDTHS.swms, cell: (t: WorkTask) => (t.swms_status ? <Chip status={t.swms_status} /> : <span className="muted">-</span>) }] : []),
		{ key: 'stage', label: 'Stage', width: WORK_WIDTHS.stage, cell: (t) => <Chip status={t.stage} /> },
		{ key: 'hours', label: 'Hours', width: WORK_WIDTHS.hours, cell: (t) => <Hours t={t} /> },
		{ key: 'action', label: 'Action', width: WORK_WIDTHS.action, cell: (t) => { const a = action(t); return a ? <Link className="btn btn-ghost btn-sm" to={'/tasks/' + t.ROWID}>{a}</Link> : null; } },
	];
	const viewOptions = (
		<>
			<p className="filter-pop__title">Row height</p>
			<RowHeightPicker value={grid.rows} onChange={grid.setRows} />
			<div className="filter-pop__actions"><button type="button" className="btn btn-ghost btn-sm" onClick={grid.reset}>Reset widths</button></div>
		</>
	);
	const toolbarButtons = <ListToolbarButtons searchOpen={panelOpen} onSearchOpen={openPanel} searchActive={searchActive} viewOptions={viewOptions} />;

	return (
		<>
			{!embedded && (
				<PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
					{layoutToggle}
					{toolbarButtons}
				</PageHeader>
			)}

			{q.isSuccess && (
				<section className="kpis" aria-label="Summary">
					<Kpi label="Open" value={counts.open} />
					<button type="button" className="kpi kpi-btn" aria-pressed={view === 'unscheduled'} onClick={() => setView('unscheduled')}>
						<span className="kpi-label">{kind === 'design' ? 'To assign' : 'Unscheduled'}</span>
						<span className="kpi-value num">{counts.unscheduled}</span>
					</button>
					<button type="button" className="kpi kpi-btn" aria-pressed={view === 'review'} onClick={() => setView('review')}>
						<span className="kpi-label">Awaiting approval</span>
						<span className="kpi-value num">{counts.review}</span>
					</button>
					<button type="button" className={'kpi kpi-btn' + (counts.overdue ? ' kpi-danger' : '')} aria-pressed={view === 'overdue'} onClick={() => setView('overdue')}>
						<span className="kpi-label">Overdue</span>
						<span className="kpi-value num">{counts.overdue}</span>
					</button>
				</section>
			)}

			<Card flush>
				<ListToolbar
					label={`${copy.title} tasks`}
					searchOpen={panelOpen}
					panelTitle={`Search ${copy.title.toLowerCase()} tasks`}
					onPanelClose={() => setPanelOpen(false)}
					onPanelApply={applyPanel}
					onPanelClear={clearDraft}
					panelBody={(
						<>
							<PanelSection title="Show" summary={views.find((v) => v.key === view)?.label} defaultOpen={false}>
								<div className="lt-views" role="radiogroup" aria-label="Views">
									{views.map((v) => (
										<button key={v.key} type="button" role="radio" aria-checked={view === v.key} className={'lt-view' + (view === v.key ? ' is-on' : '')} onClick={() => setView(v.key)}>
											<span>{v.label}</span>
											<span className="lt-count num">{counts[v.key] ?? 0}</span>
										</button>
									))}
								</div>
							</PanelSection>
							<div className="lt-form">
								<span className="toolbar__label">Search</span>
								<input type="search" aria-label="Search tasks" placeholder="Task or job name" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
							</div>
							{kinds.length > 1 && (
								<div className="lt-form">
									<span className="toolbar__label">Type</span>
									<select aria-label="Type" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
										<option value="">All types</option>
										{kinds.map((k) => (
											<option key={k}>{k}</option>
										))}
									</select>
								</div>
							)}
							<label className="check"><input type="checkbox" checked={draft.byJob} onChange={(e) => setDraft({ ...draft, byJob: e.target.checked })} /> Group by job</label>
						</>
					)}
					chips={chips}
					onClearAll={clearAll}
				/>
				{embedded && <div className="list-toolbar" style={{ justifyContent: 'flex-end' }}>{layoutToggle}{toolbarButtons}</div>}

				{q.isPending && <p role="status" className="table-empty">Loading tasks…</p>}
				{q.isError && <p role="alert">Could not load tasks.</p>}
				{q.isSuccess && shown.length === 0 && <p className="table-empty">Nothing in this view.</p>}

				{q.isSuccess && shown.length > 0 && layout === 'list' && (
					<>
						<ResizableGrid
							layout={grid}
							label={`${copy.title} tasks`}
							columns={workColumns}
							rows={shown}
							rowKey={(t) => t.ROWID}
							groupOf={byJob ? (t, i, rows) => (i === 0 || rows[i - 1].job_id !== t.job_id ? <Link to={'/jobs/' + t.job_id}>{t.job_name ?? 'Job ' + t.job_id}</Link> : undefined) : undefined}
						/>
						<TableFooter shown={shown.length} />
					</>
				)}

				{q.isSuccess && layout === 'board' && (
					<div className="board board-inline" role="list" aria-label={`${copy.title} tasks by stage`}>
						{BOARD[kind].map((stage) => {
							const col = shown.filter((t) => t.stage === stage);
							return (
								<section key={stage} className="board-col" role="listitem" aria-label={stage}>
									<header className="board-head"><h2>{stage}</h2><span className="num">{col.length}</span></header>
									<div className="board-cards">
										{col.length === 0 && <p className="board-empty">Nothing here</p>}
										{col.map((t) => (
											<Link key={t.ROWID} to={'/tasks/' + t.ROWID} className={'board-card' + (late(t) ? ' overdue' : '')}>
												<strong>{t.name}</strong>
												<small>{[t.job_name, t.kind, t.scheduled_date && fmtDate(t.scheduled_date)].filter(Boolean).join(' · ')}</small>
											</Link>
										))}
									</div>
								</section>
							);
						})}
					</div>
				)}
			</Card>
		</>
	);
}
