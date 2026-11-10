import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, LayoutList, Columns3, Search } from 'lucide-react';
import { useMe } from '../api/queries';
import { useWorkTasks } from '../api/more';
import type { WorkTask } from '../api/more';
import { num } from '../api/types';
import { Chip } from '../components/Chip';
import { Card, Kpi, PageHeader, fmtDate } from '../components/ui';

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
	...(kind === 'install' ? [{ key: 'swms', label: 'SWMS unsigned', test: (t: WorkTask) => open(t) && !!t.swms_id && !['TL Signed', 'Not Required'].includes(t.swms_status ?? '') }] : []),
	{ key: 'done', label: 'Completed', test: (t) => ['Completed', 'Approved & Completed'].includes(t.stage) },
	{ key: 'all', label: 'Everything', test: () => true },
];
const BOARD: Record<Kind, string[]> = {
	design: ['To be Assigned', 'In Progress', 'Manager Review', 'Completed'],
	fabrication: ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'],
	install: ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'],
};

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
export function WorkList({ kind }: { kind: Kind }) {
	const copy = COPY[kind];
	const me = useMe();
	const myId = me.data?.person ? String(me.data.person.ROWID) : null;
	const q = useWorkTasks(kind);
	const [view, setView] = useState('open');
	const [text, setText] = useState('');
	const [type, setType] = useState('');
	const [layout, setLayout] = useState<'list' | 'board'>('list');
	const [byJob, setByJob] = useState(false);

	const views = useMemo(() => viewsFor(kind), [kind]);
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

	return (
		<>
			<PageHeader eyebrow={copy.eyebrow} title={copy.title} subtitle={copy.subtitle}>
				<div className="segmented" role="group" aria-label="Layout">
					<button className={layout === 'list' ? 'on' : ''} aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><LayoutList size={14} aria-hidden="true" /> List</button>
					<button className={layout === 'board' ? 'on' : ''} aria-pressed={layout === 'board'} onClick={() => setLayout('board')}><Columns3 size={14} aria-hidden="true" /> Board</button>
				</div>
			</PageHeader>

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
				<div className="list-toolbar">
					<div className="segmented" role="group" aria-label="Saved views">
						{views.map((v) => (
							<button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => setView(v.key)}>
								{v.label}
								<span className="tab-count num">{counts[v.key] ?? 0}</span>
							</button>
						))}
					</div>
				</div>
				<div className="list-toolbar">
					<label className="search" style={{ flex: '1 1 220px', maxWidth: 360 }}>
						<Search size={16} aria-hidden="true" />
						<input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search task or job…" aria-label="Search tasks" />
					</label>
					{kinds.length > 1 && (
						<label>
							<span className="sr-only">Type</span>
							<select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
								<option value="">All types</option>
								{kinds.map((k) => (
									<option key={k}>{k}</option>
								))}
							</select>
						</label>
					)}
					{layout === 'list' && <label className="check"><input type="checkbox" checked={byJob} onChange={(e) => setByJob(e.target.checked)} /> Group by job</label>}
				</div>

				{q.isPending && <p role="status" className="table-empty">Loading tasks…</p>}
				{q.isError && <p role="alert">Could not load tasks.</p>}
				{q.isSuccess && shown.length === 0 && <p className="table-empty">Nothing in this view.</p>}

				{q.isSuccess && shown.length > 0 && layout === 'list' && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">{copy.title} tasks</caption>
							<thead>
								<tr>
									<th scope="col">Task</th>
									<th scope="col">Date</th>
									<th scope="col">People</th>
									{kind === 'install' && <th scope="col">SWMS</th>}
									<th scope="col">Stage</th>
									<th scope="col">Hours</th>
									<th scope="col"><span className="sr-only">Action</span></th>
								</tr>
							</thead>
							<tbody>
								{shown.map((t, i) => {
									const a = action(t);
									const newJob = byJob && (i === 0 || shown[i - 1].job_id !== t.job_id);
									return (
										<Fragment key={t.ROWID}>
											{newJob && (
												<tr key={'g' + t.job_id} className="group-row">
													<td colSpan={kind === 'install' ? 7 : 6}><Link to={'/jobs/' + t.job_id}>{t.job_name ?? 'Job ' + t.job_id}</Link></td>
												</tr>
											)}
											<tr>
												<td data-label="Task" className="cell-primary">
													<Link to={'/tasks/' + t.ROWID}>{t.parent_id ? '↳ ' : ''}{t.name}</Link>
													<small className="sub">
														{!byJob && t.job_name ? <Link to={'/jobs/' + t.job_id}>{t.job_name}</Link> : null}
														{t.kind ? <>{!byJob && t.job_name ? ' · ' : ''}{t.kind}</> : null}
													</small>
												</td>
												<td data-label="Date" className={late(t) ? 'over' : ''}>
													{fmtDate(t.scheduled_date)}
													{late(t) && <small className="risk"><AlertTriangle size={12} aria-hidden="true" /> Due {fmtDate(t.required_finish)}</small>}
												</td>
												<td data-label="People">
													{(t.crew ?? []).length ? (
														<span className="avatars">
															{(t.crew ?? []).slice(0, 3).map((c) => (
																<span key={c.personId} className="mini-avatar" title={`${c.name ?? 'Unknown'} (${c.role})`}>{initials(c.name)}</span>
															))}
															{(t.crew ?? []).length > 3 && <span className="mini-avatar more">+{(t.crew ?? []).length - 3}</span>}
														</span>
													) : (
														<span className="muted">Nobody yet</span>
													)}
												</td>
												{kind === 'install' && (
													<td data-label="SWMS">{t.swms_status ? <Chip status={t.swms_status} /> : <span className="muted">-</span>}</td>
												)}
												<td data-label="Stage"><Chip status={t.stage} /></td>
												<td data-label="Hours"><Hours t={t} /></td>
												<td data-label="Action">{a && <Link className="btn btn-ghost btn-sm" to={'/tasks/' + t.ROWID}>{a}</Link>}</td>
											</tr>
										</Fragment>
									);
								})}
							</tbody>
						</table>
					</div>
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
