import { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FileDown, Plus, X } from 'lucide-react';
import { pdfUrl, useCrmDeal, useIssueBoard, useIssueHistory } from '../api/more';
import { useIssues, useMe, usePeople, useUpdateIssue } from '../api/queries';
import type { IssuePatch } from '../api/queries';
import type { Issue } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { ListToolbar, ListToolbarButtons, PanelSection } from '../components/ListToolbar';
import type { ActiveChip } from '../components/ListToolbar';
import { Card, EmptyState, FilterBar, FilterChips, LayoutToggle, PageHeader, fmtDate } from '../components/ui';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn } from '../components/GridKit';

const PRIORITIES = ['High', 'Medium', 'Low'];
const DEPARTMENTS = ['Install', 'Civic Billboards', 'Workshop', 'Management', 'VT/Digital Screens'];
const COLUMNS = ['To Be discussed', 'To Be Quoted', 'Quoted', 'Quote Sent', 'In Progress', 'On Hold', 'Completed'];
const DEAL_DEPARTMENTS = ['Management', 'Civic Billboards']; // ISS-4
const DIRECTIONS = ['Inbound', 'Outbound', 'Middle Panel'];
const todayIso = () => new Date().toISOString().slice(0, 10);
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

type Who = Issue & { reported_by_id?: string };
const isOpen = (i: Issue) => i.issue_status !== 'Completed';
const isHigh = (i: Issue) => i.issue_priority === 'High';
const isOverdue = (i: Issue) => isOpen(i) && !!i.due_date && i.due_date.slice(0, 10) < todayIso();

const VIEWS: { key: string; label: string }[] = [
	{ key: 'open', label: 'All open' },
	{ key: 'mine', label: 'My reported' },
	{ key: 'assigned', label: 'Assigned to me' },
	{ key: 'high', label: 'High priority' },
	{ key: 'overdue', label: 'Overdue' },
	{ key: 'all', label: 'Everything' },
];
/** The search and department values the panel edits before they are applied. */
interface Draft { text: string; dept: string }
const emptyDraft: Draft = { text: '', dept: '' };

/** Columns of the list layout. The assignee name and the open-panel action come from the page, so the cells are built per render. */
function listColumns(nameOf: (id?: string | null) => string, onOpen: (id: string) => void): GridColumn<Who>[] {
	return [
		{ key: 'issue', label: 'Issue', width: 300, cell: (i) => (
			<>
				<button type="button" className="link-btn" onClick={() => onOpen(i.ROWID)}>{i.subject}</button>
				{i.task_id && <small className="sub"><Link to={'/tasks/' + i.task_id}>Open task</Link></small>}
			</>
		) },
		{ key: 'dept', label: 'Department', width: 150, cell: (i) => i.department || '-' },
		{ key: 'priority', label: 'Priority', width: 110, cell: (i) => i.issue_priority || '-' },
		{ key: 'status', label: 'Status', width: 140, cell: (i) => <Chip status={i.issue_status} /> },
		{ key: 'due', label: 'Due', width: 120, cell: (i) => (i.due_date ? <span className={isOverdue(i) ? 'text-danger' : undefined}>{fmtDate(i.due_date)}</span> : '-') },
		{ key: 'assigned', label: 'Assigned', width: 170, cell: (i) => nameOf(i.assigned_to_id) || '-' },
		{ key: 'completed', label: 'Date Completed', width: 140, cell: (i) => (i.completed_at ? fmtDate(i.completed_at) : '-') },
	];
}
const LIST_WIDTHS = gridWidths(listColumns(() => '', () => {}));

function History({ id }: { id: string }) {
	const q = useIssueHistory(id, true);
	if (q.isPending) return <p role="status" className="muted">Loading history…</p>;
	if (q.isError) return <p role="alert">Could not load the history.</p>;
	if (q.data.items.length === 0) return <p className="muted">No changes yet.</p>;
	return (
		<ul className="plain-list">
			{q.data.items.map((e, i) => (
				<li key={i}>
					<small>{e.at?.replace('T', ' ').slice(0, 16) ?? ''}</small>{' '}
					{e.changes.map((c) => `${c.field.replace(/_id$/, '').replace(/_/g, ' ')}: ${c.from ? c.from : c.to ? '-' : 'edited'}${c.to ? ' to ' + c.to : ''}`).join('; ')}
				</li>
			))}
		</ul>
	);
}

/** The side panel: change status with the notes the rules ask for, assign, set the due date, see the history. */
function QuickPanel({ issue, isManager, onClose }: { issue: Who; isManager: boolean; onClose: () => void }) {
	const update = useUpdateIssue();
	const deal = useCrmDeal();
	const people = usePeople(true);
	const { notify } = useToast();
	const [status, setStatus] = useState(issue.issue_status);
	const [nextStep, setNextStep] = useState(issue.next_step ?? '');
	const [done, setDone] = useState(issue.work_completed ?? '');
	const [due, setDue] = useState((issue.due_date ?? '').slice(0, 10));
	const [assignee, setAssignee] = useState(issue.assigned_to_id ?? '');
	const [priority, setPriority] = useState(issue.issue_priority ?? 'Normal');
	const [site, setSite] = useState(issue.billboard_site ?? '');
	const [face, setFace] = useState(issue.billboard_face ?? '');
	const allowed = [issue.issue_status, ...(issue.nextStatuses ?? [])];
	const closing = status === 'Completed';
	const civic = issue.department === 'Civic Billboards';
	const problem = closing && !done.trim() ? 'Add the completion notes.' : !closing && status !== issue.issue_status && (!nextStep.trim() || !due) ? 'A next step and a due date are needed.' : civic && (!site.trim() || !face) ? 'Civic Billboards issues need the site and face.' : '';

	const save = () => {
		const patch: IssuePatch = {};
		if (status !== issue.issue_status) patch.issue_status = status;
		if (priority !== (issue.issue_priority ?? 'Normal')) patch.issue_priority = priority;
		if ((assignee || null) !== (issue.assigned_to_id || null)) patch.assigned_to_id = assignee || null;
		if (nextStep.trim() !== (issue.next_step ?? '')) patch.next_step = nextStep.trim();
		if (done.trim() !== (issue.work_completed ?? '')) patch.work_completed = done.trim();
		if (due !== (issue.due_date ?? '').slice(0, 10)) patch.due_date = due || null;
		if (civic && site.trim() !== (issue.billboard_site ?? '')) patch.billboard_site = site.trim();
		if (civic && face !== (issue.billboard_face ?? '')) patch.billboard_face = face;
		if (Object.keys(patch).length === 0) return onClose();
		update.mutate({ id: issue.ROWID, patch }, { onSuccess: () => { notify('Issue updated'); onClose(); }, onError: (e) => notify(errText(e), 'error') });
	};

	return (
		<aside className="slide-over" aria-label={`Issue ${issue.subject}`}>
			<div className="slide-over__head">
				<div>
					<h2>{issue.subject}</h2>
					<small className="muted">{issue.department} · raised {fmtDate(issue.CREATEDTIME)}</small>
				</div>
				<button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={16} aria-hidden="true" /></button>
			</div>
			{issue.description && <p>{issue.description}</p>}
			{civic && <p className="muted">Billboard: {issue.billboard_site || '-'}, {issue.billboard_face || '-'}</p>}
			{issue.review_needed && <p><Chip status="Pending" /> {issue.review_needed}</p>}
			{isManager ? (
				<div className="form-grid">
					<label><span className="toolbar__label">Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}>{allowed.map((s) => <option key={s}>{s}</option>)}</select></label>
					<label><span className="toolbar__label">Priority</span><select value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
					<label>
						<span className="toolbar__label">Assigned to</span>
						<select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
							<option value="">Nobody</option>
							{(people.data?.items ?? []).filter((p) => p.is_active !== false).map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
						</select>
					</label>
					<label><span className="toolbar__label">Due Date{!closing ? ' *' : ''}</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
					<label style={{ gridColumn: '1 / -1' }}><span className="toolbar__label">Next Steps/Notes{!closing ? ' *' : ''}</span><textarea rows={2} value={nextStep} maxLength={9000} onChange={(e) => setNextStep(e.target.value)} /></label>
					{closing && <label style={{ gridColumn: '1 / -1' }}><span className="toolbar__label">Completion Notes *</span><textarea rows={2} value={done} maxLength={9000} onChange={(e) => setDone(e.target.value)} /></label>}
					{civic && (
						<>
							<label><span className="toolbar__label">Location *</span><input value={site} maxLength={150} onChange={(e) => setSite(e.target.value)} /></label>
							<label><span className="toolbar__label">Direction *</span><select value={face} onChange={(e) => setFace(e.target.value)}><option value="">Choose…</option>{DIRECTIONS.map((x) => <option key={x}>{x}</option>)}</select></label>
						</>
					)}
					{problem && <p role="alert" style={{ gridColumn: '1 / -1' }}>{problem}</p>}
					<div className="actions" style={{ gridColumn: '1 / -1' }}>
						<button className="btn" onClick={save} disabled={update.isPending || !!problem}>{update.isPending ? 'Saving…' : 'Save'}</button>
						{DEAL_DEPARTMENTS.includes(issue.department ?? '') && (
							<button className="btn btn-ghost" disabled={deal.isPending} onClick={() => deal.mutate(issue.ROWID, { onSuccess: (r) => notify(r.created ? 'CRM deal created' : 'A CRM deal already exists for this issue'), onError: (e) => notify(errText(e), 'error') })}>CRM deal</button>
						)}
						<a className="btn btn-ghost" href={pdfUrl(`/issues/${issue.ROWID}/pdf?layout=full`)} target="_blank" rel="noreferrer"><FileDown size={14} aria-hidden="true" /> PDF</a>
					</div>
				</div>
			) : (
				<>
					<p><Chip status={issue.issue_status} /></p>
					{issue.next_step && <p><strong>Next step:</strong> {issue.next_step}</p>}
				</>
			)}
			<h3>History</h3>
			<History id={issue.ROWID} />
		</aside>
	);
}

function IssueCard({ i, nameOf, onOpen }: { i: Who; nameOf: (id?: string | null) => string; onOpen: () => void }) {
	const late = isOverdue(i);
	return (
		<button type="button" className={'issue-card' + (late ? ' issue-card--late' : '')} onClick={onOpen}>
			<span className="issue-card__top"><strong>{i.subject}</strong><Chip status={i.issue_status} /></span>
			<small className="muted">{i.department || '-'}{i.issue_priority && i.issue_priority !== 'Normal' ? ` · ${i.issue_priority}` : ''}</small>
			{i.next_step && <small>Next: {i.next_step}</small>}
			<small className={late ? 'text-danger' : 'muted'}>{i.due_date ? `Due ${fmtDate(i.due_date)}${late ? ' (overdue)' : ''}` : 'No due date'}{i.assigned_to_id ? ` · ${nameOf(i.assigned_to_id)}` : ''}</small>
		</button>
	);
}

export function Issues() {
	const navigate = useNavigate();
	const location = useLocation();
	const me = useMe();
	const issues = useIssues();
	const people = usePeople(true);
	const [view, setView] = useState('open');
	const [dept, setDept] = useState('');
	const [text, setText] = useState('');
	const [layout, setLayout] = useState<'board' | 'list'>('board');
	const [selected, setSelected] = useState<string | null>(null);
	const [panelOpen, setPanelOpen] = useState(false);
	const [draft, setDraft] = useState<Draft>(emptyDraft);
	const grid = useGridLayout('ve.grid.issues', LIST_WIDTHS);
	const isManager = !!me.data?.permissions.editJob; // the server decides for real
	const board = useIssueBoard(isManager);
	const myId = me.data?.person ? String((me.data.person as { ROWID?: string }).ROWID ?? '') : '';

	const nameOf = useMemo(() => {
		const m = new Map((people.data?.items ?? []).map((p) => [p.ROWID, `${p.first_name} ${p.last_name ?? ''}`.trim()]));
		return (id?: string | null) => (id ? m.get(id) ?? 'Someone' : '');
	}, [people.data]);

	const all = useMemo(() => (issues.data?.items ?? []) as Who[], [issues.data]);
	const counts = useMemo(() => ({
		open: all.filter(isOpen).length,
		mine: all.filter((i) => !!myId && i.reported_by_id === myId).length,
		assigned: all.filter((i) => isOpen(i) && !!myId && i.assigned_to_id === myId).length,
		high: all.filter((i) => isOpen(i) && isHigh(i)).length,
		overdue: all.filter(isOverdue).length,
		all: all.length,
	}), [all, myId]);
	const deptCounts = useMemo(() => {
		const m: Record<string, number> = {};
		for (const i of all) if (isOpen(i)) m[i.department ?? 'Management'] = (m[i.department ?? 'Management'] ?? 0) + 1;
		return m;
	}, [all]);

	const needle = text.trim().toLowerCase();
	const shown = all.filter((i) => {
		if (view === 'open' && !isOpen(i)) return false;
		if (view === 'mine' && !(myId && i.reported_by_id === myId)) return false;
		if (view === 'assigned' && !(isOpen(i) && myId && i.assigned_to_id === myId)) return false;
		if (view === 'high' && !(isOpen(i) && isHigh(i))) return false;
		if (view === 'overdue' && !isOverdue(i)) return false;
		if (dept && i.department !== dept) return false;
		return !needle || `${i.subject} ${i.description ?? ''} ${i.billboard_site ?? ''}`.toLowerCase().includes(needle);
	});
	const current = selected ? all.find((i) => i.ROWID === selected) : undefined;
	const columns = view === 'all' ? COLUMNS : COLUMNS.filter((c) => c !== 'Completed');
	const viewList = VIEWS.filter((v) => isManager || v.key !== 'assigned');
	const searchActive = !!needle || !!dept || view !== 'open';
	const openPanel = () => { setDraft({ text, dept }); setPanelOpen(true); };
	const clearDraft = () => setDraft(emptyDraft);
	const applyPanel = () => { setText(draft.text); setDept(draft.dept); setPanelOpen(false); };
	const clearAll = () => { setView('open'); setText(''); setDept(''); };
	const chips: ActiveChip[] = [
		...(view !== 'open' ? [{ key: 'view', label: `View: ${VIEWS.find((v) => v.key === view)?.label ?? view}`, onRemove: () => setView('open') }] : []),
		...(needle ? [{ key: 'q', label: `Search "${text.trim()}"`, onRemove: () => setText('') }] : []),
		...(dept ? [{ key: 'dept', label: `Department: ${dept}`, onRemove: () => setDept('') }] : []),
	];

	return (
		<>
			<PageHeader eyebrow="Safety and quality" title="Issues" subtitle="Problems found on site or in the workshop, routed to the right department.">
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
				{<button className="btn" onClick={() => navigate('/issues/new', { state: { background: location } })}><Plus size={16} aria-hidden="true" /> Raise an issue</button>}
			</PageHeader>

			<Card flush>
				<FilterBar>
				<FilterChips label="Summary" value={view} onChange={(k) => setView(k as typeof view)} chips={[
					{ key: 'open', label: 'Open', count: counts.open },
					{ key: 'high', label: 'High priority', count: counts.high, danger: true },
					{ key: 'overdue', label: 'Overdue', count: counts.overdue, danger: true },
					{ key: 'assigned', label: 'Assigned to me', count: counts.assigned },
				]} />
				<div className="filter-bar__end"><LayoutToggle value={layout} onChange={setLayout} /></div>
				{isManager && board.isSuccess && (
									<FilterChips label="Open issues by department" heading="Department" value={dept} onChange={(d) => setDept(dept === d ? '' : d)} chips={board.data.departments.map((d) => ({ key: d, label: d, count: deptCounts[d] ?? 0 }))} />
				)}
				</FilterBar>


				<ListToolbar
					label="Issues list"
					searchOpen={panelOpen}
					panelTitle="Search issues"
					onPanelClose={() => setPanelOpen(false)}
					onPanelApply={applyPanel}
					onPanelClear={clearDraft}
					panelBody={(
						<>
							<PanelSection title="Show" summary={VIEWS.find((v) => v.key === view)?.label} defaultOpen>
								<div className="lt-views" role="radiogroup" aria-label="Views">
									{viewList.map((v) => (
										<button key={v.key} type="button" role="radio" aria-checked={view === v.key} className={'lt-view' + (view === v.key ? ' is-on' : '')} onClick={() => setView(v.key)}>
											<span>{v.label}</span>
											<span className="lt-count num">{counts[v.key as keyof typeof counts]}</span>
										</button>
									))}
								</div>
							</PanelSection>
							<div className="lt-form">
								<span className="toolbar__label">Search</span>
								<input type="search" aria-label="Search text" placeholder="Subject, description or site" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') applyPanel(); }} />
							</div>
							<div className="lt-form">
								<span className="toolbar__label">Department</span>
								<select aria-label="Department" value={draft.dept} onChange={(e) => setDraft({ ...draft, dept: e.target.value })}>
									<option value="">All departments</option>
									{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
								</select>
							</div>
						</>
					)}
					chips={chips}
					onClearAll={clearAll}
				/>

				{issues.isPending && <p role="status" className="table-empty">Loading issues…</p>}
				{issues.isError && <p role="alert">Could not load issues.</p>}
				{issues.isSuccess && shown.length === 0 && (
					<EmptyState title="No issues match" description="Try a different filter or search term." />
				)}

				{issues.isSuccess && shown.length > 0 && layout === 'board' && (
					<div className="issue-board">
						{columns.map((c) => (
							<section key={c} className="issue-col" aria-label={c}>
								<h3>{c} <span className="num">{shown.filter((i) => i.issue_status === c).length}</span></h3>
								{shown.filter((i) => i.issue_status === c).map((i) => <IssueCard key={i.ROWID} i={i} nameOf={nameOf} onOpen={() => setSelected(i.ROWID)} />)}
							</section>
						))}
					</div>
				)}

				{issues.isSuccess && shown.length > 0 && layout === 'list' && (
					<ResizableGrid
						layout={grid}
						label="Issues"
						columns={listColumns(nameOf, setSelected)}
						rows={shown}
						rowKey={(i) => i.ROWID}
					/>
				)}
				{issues.isSuccess && layout === 'list' && <GridStatusBar text={`Showing ${shown.length} of ${all.length}`} />}
			</Card>

			{current && <QuickPanel key={current.ROWID} issue={current} isManager={isManager} onClose={() => setSelected(null)} />}
		</>
	);
}
