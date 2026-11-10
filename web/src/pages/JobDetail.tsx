import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { AddSubtaskDialog } from '../components/AddSubtaskDialog';
import { ContextMenu } from '../components/ContextMenu';
import type { MenuItem } from '../components/ContextMenu';
import { ArrowLeft, Briefcase, ExternalLink, Hammer, Network, Pencil, Plus, Truck } from 'lucide-react';
import { useJob, useMe, useTransitionTask } from '../api/queries';
import { AddTaskForm } from '../components/AddTaskForm';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import type { Task } from '../api/types';
import { StageCell } from '../components/StageCell';
import { useToast } from '../components/toast';
import { Card, Ring, fmtDate } from '../components/ui';
import { useCloseJob } from '../api/more';
import { SignsPanel } from './SignsPanel';
import { QuotesPanel } from './QuotesPanel';
import type { TaskType } from '../lib/taskKinds';
import { INSTALL_LEGEND, TASK_NAMES } from '../lib/names';

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const today = () => new Date().toISOString().slice(0, 10);
const hrs = (v: unknown) => (num(v as string | number) ? num(v as string | number).toFixed(2) : '');
const kindClass = (k?: string) => (k ? 'kind-' + k.toLowerCase().replace(/[^a-z]+/g, '-') : '');

/** One coloured section of the job page: a title band, a row of buttons and numbers, then the table. */
function Band({ tone, icon, title, children }: { tone: 'design' | 'fab' | 'install'; icon: ReactNode; title: string; children: ReactNode }) {
	return (
		<section className={'jd-band jd-band--' + tone} aria-label={title}>
			<h2 className="jd-band__title"><span className="jd-band__icon" aria-hidden="true">{icon}</span> {title}</h2>
			{children}
		</section>
	);
}
const Stat = ({ label, value, tone }: { label: string; value: ReactNode; tone?: 'danger' }) => (
	<div className={'jd-stat' + (tone ? ' jd-stat--' + tone : '')}><span>{label}</span><strong className="num">{value}</strong></div>
);

/** The job page: header, key facts, locations and signs, then Management, Fabrication and Installation tasks in coloured sections. */
export function JobDetail() {
	const { id } = useParams();
	const q = useJob(id);
	const me = useMe();
	const navigate = useNavigate();
	const location = useLocation();
	const move = useTransitionTask(id ?? '');
	const close = useCloseJob(id ?? '');
	const { notify } = useToast();
	// The jobs list links here with ?add=design|fab|install to open the matching add-task form (Creator's row actions).
	const [params] = useSearchParams();
	const [menu, setMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
	const [subOf, setSubOf] = useState<Task | null>(null);
	const [adding, setAdding] = useState<{ type: TaskType; kind: string } | null>(() => {
		const a = params.get('add');
		return a === 'design' ? { type: 'design', kind: '' } : a === 'fab' ? { type: 'fabrication', kind: '' } : a === 'install' ? { type: 'install', kind: 'VE Install' } : null;
	});

	if (q.isPending) return <p role="status">Loading job…</p>;
	if (q.error instanceof ApiError && q.error.status === 404) {
		return (
			<>
				<Link className="back-link" to="/jobs"><ArrowLeft size={16} aria-hidden="true" /> All jobs</Link>
				<h1 className="page-title">Job not found</h1>
			</>
		);
	}
	if (q.isError) return <p role="alert">Could not load this job.</p>;

	const { job, tasks, progress } = q.data;
	const locations = q.data.locations ?? [];
	const canEdit = !!me.data?.permissions.editJob;
	const canAdd = !!me.data?.permissions.createTask;
	const seesMoney = !!me.data?.roles.includes('admin');
	const canClose = canEdit && job.stage === 'Completed';
	const inReview = tasks.filter((t) => t.stage === 'Manager Review');
	const byType = (t: TaskType) => tasks.filter((x) => x.task_type === t);
	const open = (list: Task[]) => list.filter((t) => !DONE.includes(t.stage));
	const late = (t: Task) => !DONE.includes(t.stage) && !!t.required_finish && t.required_finish.slice(0, 10) < today();
	const design = byType('design');
	const fab = byType('fabrication');
	const install = byType('install');
	const workdrive = (job as { workdrive_url?: string }).workdrive_url;
	const serverPath = (job as { server_path?: string }).server_path;

	const actions = (t: Task) => (
		<div className="actions">
			{(t.nextStages ?? []).map((s) => (
				<button key={s} className="btn btn-ghost btn-sm" disabled={move.isPending} onClick={() => move.mutate({ taskId: t.ROWID, to: s }, { onSuccess: () => notify(`Moved to ${s}`), onError: (e) => notify(e instanceof Error ? e.message : 'Could not move the task', 'error') })}>{s}</button>
			))}
		</div>
	);
	const addForm = (type: TaskType) => adding?.type === type && <AddTaskForm jobId={id ?? ''} type={adding.type} kind={adding.kind} onClose={() => setAdding(null)} />;
	/** Subtasks only for open fabrication and installation tasks, on a job that is not closed. */
	const canSubtask = (t: Task) => canAdd && (t.task_type === 'fabrication' || t.task_type === 'install') && !DONE.includes(t.stage) && job.stage !== 'Completed - Closed';
	const openMenu = (t: Task, e: ReactMouseEvent) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, task: t }); };
	const menuItems = (t: Task): MenuItem[] => [
		{ label: 'Open task', onSelect: () => navigate('/tasks/' + t.ROWID) },
		...(canSubtask(t) ? [{ label: 'Create subtask', onSelect: () => setSubOf(t) }] : []),
	];
	const addBtn = (label: string, type: TaskType, kind = '') => canAdd && <button className="btn btn-sm jd-add" onClick={() => setAdding({ type, kind })}><Plus size={14} aria-hidden="true" /> {label}</button>;

	/** Subtasks sit under their parent, as in the old list. */
	const grouped = (list: Task[]) => {
		const ids = new Set(list.map((t) => t.ROWID));
		const roots = list.filter((t) => !t.parent_id || !ids.has(String(t.parent_id)));
		return roots.flatMap((r) => [r, ...list.filter((t) => String(t.parent_id) === r.ROWID)]);
	};
	const sumBooked = (list: Task[]) => list.reduce((n, t) => n + num(t.booked_hours), 0);
	const sumQuoted = (list: Task[]) => list.reduce((n, t) => n + num(t.quoted_hours), 0);
	const sumCost = (list: Task[]) => list.reduce((n, t) => n + num(t.labour_cost), 0);

	return (
		<>
			<Link className="back-link" to="/jobs"><ArrowLeft size={16} aria-hidden="true" /> All jobs</Link>

			<header className="jd-head">
				<div className="jd-head__side">{canEdit && <button className="btn btn-sm" onClick={() => navigate(`/jobs/${job.ROWID}/edit`, { state: { background: location } })}><Pencil size={14} aria-hidden="true" /> Edit Job</button>}</div>
				<h1 className="jd-head__title"><Briefcase size={20} aria-hidden="true" /> Job Details</h1>
				<div className="jd-head__side jd-head__side--right">
					{job.crm_deal_id ? <span className="jd-deal" title="CRM deal">Deal: {job.crm_deal_id}</span> : <span className="muted">No Deal</span>}
				</div>
			</header>

			<div className="jd-facts">
				<div className="jd-fact jd-fact--name"><strong>{job.name}</strong><span>Job Name</span></div>
				<div className="jd-fact"><strong>{job.stage}</strong><span>Job Stage</span></div>
				<div className="jd-fact"><strong>{serverPath || '-'}</strong><span>Location of files on VE Server</span></div>
				<div className="jd-fact jd-fact--action">
					{workdrive ? <a className="btn btn-sm" href={workdrive} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Go to Workdrive</a> : <span className="muted">Go to Workdrive (not created yet)</span>}
				</div>
				<div className="jd-fact jd-fact--ring"><span>% Job Complete</span><Ring value={progress.job} label="Job progress" /></div>
			</div>

			{canEdit && inReview.length > 0 && (
				<div className="attention" role="status">
					<strong className="num">{inReview.length}</strong> {inReview.length === 1 ? 'task is' : 'tasks are'} waiting for your approval.
					{inReview.slice(0, 3).map((t) => <Link key={t.ROWID} to={'/tasks/' + t.ROWID}>Review {t.name}</Link>)}
				</div>
			)}
			{canClose && (
				<div className="attention" role="status">
					Every task is finished.
					<button className="btn btn-sm" disabled={close.isPending} onClick={() => !(inReview.length && !window.confirm(`${inReview.length} ${inReview.length === 1 ? 'task is' : 'tasks are'} still in Manager Review. Closing will not wait for approval. Close the job anyway?`)) && close.mutate(undefined, { onSuccess: () => notify('Job closed'), onError: (e) => notify(e instanceof Error ? e.message : 'Could not close the job', 'error') })}>
						{close.isPending ? 'Closing…' : 'Close job'}
					</button>
				</div>
			)}
			{move.isError && <p role="alert">{move.error.message}</p>}

			<div className="grid-2 jd-pair">
				<Card title="Job Locations" flush>
					{locations.length === 0 ? <p className="table-empty">No Data Available</p> : (
						<div className="table-wrap">
							<table className="table"><caption className="sr-only">Job Locations</caption>
								<thead><tr><th scope="col">Location Name</th><th scope="col">Street</th><th scope="col">City</th><th scope="col">View in Google Maps</th><th scope="col">ID</th><th scope="col">Z CRM site ID</th><th scope="col">Added Time</th></tr></thead>
								<tbody>
									{locations.map((l) => (
										<tr key={l.id}>
											<td data-label="Location Name" className="cell-primary">{l.name}</td>
											<td data-label="Street">{l.street || '-'}</td>
											<td data-label="City">{l.city || '-'}</td>
											<td data-label="View in Google Maps">{l.mapUrl ? <a href={l.mapUrl} target="_blank" rel="noreferrer">View in Google Maps</a> : '-'}</td>
											<td data-label="ID" className="num">{l.id}</td>
											<td data-label="Z CRM site ID">{l.crmSiteId || '-'}</td>
											<td data-label="Added Time">{l.addedTime ? fmtDate(l.addedTime) : '-'}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					<p className="grid-foot">Showing {locations.length} of {locations.length}</p>
				</Card>
				<SignsPanel jobId={id ?? ''} canWrite={canAdd} />
			</div>

			<Band tone="design" icon={<Network size={18} />} title={TASK_NAMES.design.title}>
				<div className="jd-stats">
					{addBtn(TASK_NAMES.design.addLabel, 'design')}
					<Stat label="Total Design Tasks" value={design.length} />
					<Stat label="Overdue Design Tasks" value={design.filter(late).length} tone={design.some(late) ? 'danger' : undefined} />
				</div>
				{addForm('design')}
				<TaskTable title={TASK_NAMES.design.table} empty="No design tasks." rows={design} cols={['Design Type', 'Task Name', 'Stage', 'Required Finish', 'Quoted Hours', 'Booked Hours', ...(seesMoney ? ['Labour Cost'] : []), '']}
					row={(t) => [t.kind ?? '', <Link key="n" to={'/tasks/' + t.ROWID}>{t.name}</Link>, <StageCell key="s" stage={t.stage} />, fmtDate(t.required_finish), hrs(t.quoted_hours), hrs(t.booked_hours), ...(seesMoney ? [hrs(t.labour_cost)] : []), actions(t)]}
					numeric={seesMoney ? [4, 5, 6] : [4, 5]} />
			</Band>

			<Band tone="fab" icon={<Hammer size={18} />} title={TASK_NAMES.fabrication.title}>
				<div className="jd-stats">
					{addBtn(TASK_NAMES.fabrication.addLabel, 'fabrication')}
					<Stat label="Total Fab Tasks" value={fab.length} />
					<Stat label="Open Fab Tasks" value={open(fab).length} tone={open(fab).length ? 'danger' : undefined} />
					<Stat label="% of Fab Completed" value={num(progress.fab)} />
					<Stat label="Required Fab Finish Date" value={fmtDate((job as { required_fab_finish?: string }).required_fab_finish)} />
					<Stat label="Agreed Fab Finish Date" value={fmtDate((job as { agreed_fab_finish?: string }).agreed_fab_finish)} />
				</div>
				{addForm('fabrication')}
				<TaskTable title={TASK_NAMES.fabrication.table} empty="No fabrication tasks." rows={grouped(fab)} onRowContext={openMenu} cols={['Task Name', 'Stage', 'Booked Hours', ...(seesMoney ? ['Total Labour Cost'] : []), 'Team Leader', 'Team Member', 'Scheduled Date', 'Quoted Hours', '']}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></span>, <StageCell key="s" stage={t.stage} />, hrs(t.booked_hours), ...(seesMoney ? [hrs(t.labour_cost)] : []), t.team_leader ?? '', t.team_members ?? '', fmtDate(t.scheduled_date), hrs(t.quoted_hours), actions(t)]}
					numeric={seesMoney ? [2, 3, 7] : [2, 6]}
					groupTotals={(list) => ['', '', hrs(sumBooked(list)), ...(seesMoney ? [hrs(sumCost(list))] : []), '', '', '', hrs(sumQuoted(list)), '']} footer={['Total', '', hrs(sumBooked(fab)), ...(seesMoney ? [hrs(sumCost(fab))] : []), '', '', '', hrs(sumQuoted(fab)), '']} />
			</Band>

			<Band tone="install" icon={<Truck size={18} />} title={TASK_NAMES.install.title}>
				<div className="jd-stats">
					{addBtn(TASK_NAMES.install.addLabel, 'install', 'VE Install')}
					{addBtn('Add Minor Task', 'install', 'Minor Task')}
					<Stat label="Total Install Tasks" value={install.length} />
					<Stat label="Open Install Tasks" value={open(install).length} tone={open(install).length ? 'danger' : undefined} />
					<div className="jd-legend" aria-label="Task kinds">{INSTALL_LEGEND.map((k) => <span key={k} className={'jd-kind ' + kindClass(k === 'Install' ? 'VE Install' : k === 'Subtask' ? 'VE Subtask' : k === 'External' ? 'External Install' : k)}>{k}</span>)}</div>
				</div>
				{addForm('install')}
				<TaskTable title={TASK_NAMES.install.table} empty="No installation tasks." rows={grouped(install)} onRowContext={openMenu} cols={['Task Name', 'Install Date', 'Stage', 'Team Leader', 'Team Member', 'SWMS Status', 'Quoted Man Hours', 'Booked Hours', ...(seesMoney ? ['Total Labour Cost'] : []), '']}
					rowClass={(t) => kindClass(t.kind)}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></span>, fmtDate(t.scheduled_date), <StageCell key="s" stage={t.stage} />, t.team_leader ?? '', t.team_members ?? '', t.swms_status ?? '', hrs(t.quoted_hours), hrs(t.booked_hours), ...(seesMoney ? [hrs(t.labour_cost)] : []), actions(t)]}
					numeric={seesMoney ? [6, 7, 8] : [6, 7]}
					groupTotals={(list) => ['', '', '', '', '', '', hrs(sumQuoted(list)), hrs(sumBooked(list)), ...(seesMoney ? [hrs(sumCost(list))] : []), '']} footer={['Total', '', '', '', '', '', hrs(sumQuoted(install)), hrs(sumBooked(install)), ...(seesMoney ? [hrs(sumCost(install))] : []), '']} />
			</Band>

			{menu && <ContextMenu x={menu.x} y={menu.y} items={menuItems(menu.task)} onClose={() => setMenu(null)} />}
			{subOf && <AddSubtaskDialog taskId={subOf.ROWID} onClose={() => setSubOf(null)} />}
			<QuotesPanel jobId={id ?? ''} hasDeal={!!job.crm_deal_id} canSync={canAdd} />
		</>
	);
}

/** A task table: headings, rows (each a list of cells), an optional totals row, and "Showing N of N" under it. */
function TaskTable({ title, cols, rows, row, rowClass, footer, groupTotals, numeric = [], empty, onRowContext }: { title: string; cols: string[]; rows: Task[]; row: (t: Task) => ReactNode[]; rowClass?: (t: Task) => string; footer?: ReactNode[]; numeric?: number[]; empty: string; onRowContext?: (t: Task, e: ReactMouseEvent) => void; groupTotals?: (list: Task[]) => ReactNode[] }) {
	/** A subtask is a row whose parent is also in this table. Parents are drawn with their subtasks under a heading. */
	const isChild = (t: Task) => !!t.parent_id && rows.some((r) => r.ROWID === String(t.parent_id));
	if (rows.length === 0) return <p className="table-empty jd-empty">{empty}</p>;
	return (
		<div className="jd-table">
			<h3 className="jd-table__title">{title}</h3>
			<div className={"table-wrap" + (rows.length > 3 ? " jd-scroll" : "")}>
				<table className="table jd-tasks">
					<caption className="sr-only">{title}</caption>
					<thead><tr>{cols.map((c, i) => <th key={i} scope="col" className={numeric.includes(i) ? 'num' : ''}>{c || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
					<tbody>
						{rows.filter((t) => !isChild(t)).map((t) => {
							const kids = rows.filter((k) => String(k.parent_id) === t.ROWID);
							const line = (x: Task, cls?: string) => (
								<tr key={x.ROWID} className={cls} onContextMenu={onRowContext ? (e) => onRowContext(x, e) : undefined}>
									{row(x).map((c, i) => <td key={i} data-label={cols[i]} className={(i === 0 ? 'cell-primary ' : '') + (numeric.includes(i) ? 'num' : '')}>{c}</td>)}
								</tr>
							);
							return (
								<Fragment key={t.ROWID}>
									{line(t, rowClass?.(t))}
									{kids.length > 0 && (
										<>
											<tr className="jd-group"><td colSpan={cols.length}>{t.name}</td></tr>
											{kids.map((k) => line(k, 'jd-subrow ' + (rowClass?.(k) ?? '')))}
											{groupTotals && <tr className="jd-group-total">{groupTotals(kids).map((c, i) => <td key={i} className={numeric.includes(i) ? 'num' : ''}>{c}</td>)}</tr>}
										</>
									)}
								</Fragment>
							);
						})}
						{footer && <tr className="jd-total">{footer.map((c, i) => <td key={i} className={numeric.includes(i) ? 'num' : ''}>{c}</td>)}</tr>}
					</tbody>
				</table>
			</div>
			<p className="grid-foot">Showing {rows.length} of {rows.length}</p>
		</div>
	);
}
