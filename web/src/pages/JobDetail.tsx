import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { AddSubtaskDialog } from '../components/AddSubtaskDialog';
import { ContextMenu } from '../components/ContextMenu';
import type { MenuItem } from '../components/ContextMenu';
import { ArrowLeft, Briefcase, ExternalLink, FolderOpen, Hammer, MoreVertical, Network, Pencil, Plus, Truck } from 'lucide-react';
import { useJob, useMe, useTransitionTask } from '../api/queries';
import { AddTaskForm } from '../components/AddTaskForm';
import { ApiError } from '../api/client';
import { num } from '../api/types';
import type { Task } from '../api/types';
import { StageCell } from '../components/StageCell';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/Messages';
import { Notice } from '../components/Notice';
import { Card, Ring, fmtDate } from '../components/ui';
import { useCloseJob } from '../api/more';
import { SignsPanel } from './SignsPanel';
import { QuotesPanel } from './QuotesPanel';
import type { TaskType } from '../lib/taskKinds';
import { TASK_NAMES } from '../lib/names';

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const today = () => new Date().toISOString().slice(0, 10);
const hrs = (v: unknown) => (num(v as string | number) ? num(v as string | number).toFixed(2) : '');
/** The kinds of install task that get a small tag beside the name; a plain install task needs none. */
const KIND_TAG: Record<string, string> = { 'VE Subtask': 'Subtask', 'Minor Task': 'Minor Task', 'Print Only': 'Print Only', 'External Install': 'External' };
const kindTag = (k?: string) => (k && KIND_TAG[k] ? <span className="kind-tag">{KIND_TAG[k]}</span> : null);

const COMPLETE = ['Completed', 'Approved & Completed', 'Completed - Closed', 'Complete - Not Used'];

/** One section of the job page: a tinted header (icon, title, counts, Add buttons), an optional facts row, then the table. */
function Section({ tone, icon, title, count, pills, actions, meta, children }: { tone: 'design' | 'fab' | 'install'; icon: ReactNode; title: string; count: number; pills: ReactNode; actions?: ReactNode; meta?: ReactNode; children: ReactNode }) {
	return (
		<section className={'jsec jsec--' + tone} aria-label={title}>
			<header className="jsec__head">
				<span className="jsec__badge" aria-hidden="true">{icon}</span>
				<div className="jsec__titles"><h2>{title}</h2><p>{count} {count === 1 ? 'task' : 'tasks'}</p></div>
				{pills}
				{actions && <div className="jsec__actions">{actions}</div>}
			</header>
			{meta}
			{children}
		</section>
	);
}

/** Open, In progress and Completed counts for one section, and Overdue when there is any. */
function Pills({ list, late }: { list: Task[]; late: number }) {
	const n = (f: (t: Task) => boolean) => list.filter(f).length;
	return (
		<div className="jpills" aria-label="Task counts">
			<span className="jpill jpill--open"><b className="num">{n((t) => !DONE.includes(t.stage))}</b> Open</span>
			<span className="jpill jpill--prog"><b className="num">{n((t) => t.stage === 'In Progress')}</b> In Progress</span>
			<span className="jpill jpill--done"><b className="num">{n((t) => COMPLETE.includes(t.stage))}</b> Completed</span>
			{late > 0 && <span className="jpill jpill--late"><b className="num">{late}</b> Overdue</span>}
		</div>
	);
}

const HeadStat = ({ tone, icon, label, value }: { tone: 'design' | 'fab' | 'install'; icon: ReactNode; label: string; value: number }) => (
	<div className="jh-stat"><span className={'jh-stat__icon jsec--' + tone} aria-hidden="true">{icon}</span><div><strong className="num">{value}</strong><span>{label}</span></div></div>
);

/** The job page: header card with the task counts, locations and signs, then Design, Fabrication and Installation tasks in tinted section cards. */
export function JobDetail() {
	const { id } = useParams();
	const q = useJob(id);
	const me = useMe();
	const navigate = useNavigate();
	const location = useLocation();
	const move = useTransitionTask(id ?? '');
	const close = useCloseJob(id ?? '');
	const { notify } = useToast();
	const confirm = useConfirm();
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
	const late = (t: Task) => !DONE.includes(t.stage) && !!t.required_finish && t.required_finish.slice(0, 10) < today();
	/** What needs attention on a row: an overdue task, or one waiting for the manager's approval. */
	const rowFlag = (t: Task) => (late(t) ? 'jd-row--late' : t.stage === 'Manager Review' ? 'jd-row--review' : '');
	const lateTag = (t: Task) => (late(t) ? <span className="kind-tag kind-tag--late">Overdue</span> : null);
	/** Booked hours turn red once they pass the quoted hours. */
	const booked = (t: Task) => <span className={num(t.quoted_hours) > 0 && num(t.booked_hours) > num(t.quoted_hours) ? 'over' : ''}>{hrs(t.booked_hours)}</span>;
	const design = byType('design');
	const fab = byType('fabrication');
	const install = byType('install');
	const workdrive = (job as { workdrive_url?: string }).workdrive_url;
	const serverPath = (job as { server_path?: string }).server_path;

	/** Moves a task to one of the stages it can go to; the same moves the row buttons used to make. */
	const moveTo = (t: Task, to: string) => move.mutate({ taskId: t.ROWID, to }, { onSuccess: () => notify(`Moved to ${to}`), onError: (e) => notify(e instanceof Error ? e.message : 'Could not move the task', 'error') });
	/** The ⋮ button at the end of a row opens the same menu as a right-click. */
	const actions = (t: Task) => (
		<button type="button" className="icon-btn jrow-menu" aria-label={`Actions for ${t.name}`} aria-haspopup="menu" disabled={move.isPending} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenu({ x: r.right - 200, y: r.bottom + 4, task: t }); }}>
			<MoreVertical size={16} aria-hidden="true" />
		</button>
	);
	const addForm = (type: TaskType) => adding?.type === type && <AddTaskForm jobId={id ?? ''} type={adding.type} kind={adding.kind} onClose={() => setAdding(null)} />;
	/** Subtasks only for open fabrication and installation tasks, on a job that is not closed. */
	const canSubtask = (t: Task) => canAdd && (t.task_type === 'fabrication' || t.task_type === 'install') && !DONE.includes(t.stage) && job.stage !== 'Completed - Closed';
	const openMenu = (t: Task, e: ReactMouseEvent) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, task: t }); };
	const menuItems = (t: Task): MenuItem[] => [
		{ label: 'Open task', onSelect: () => navigate('/tasks/' + t.ROWID) },
		...(canSubtask(t) ? [{ label: 'Create subtask', onSelect: () => setSubOf(t) }] : []),
		...(t.nextStages ?? []).map((st) => ({ label: `Move to ${st}`, onSelect: () => moveTo(t, st) })),
	];
	const addBtn = (label: string, type: TaskType, kind = '') => canAdd && <button className="btn btn-sm" onClick={() => setAdding({ type, kind })}><Plus size={14} aria-hidden="true" /> {label}</button>;

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

			<header className="jh">
				<div className="jh__bar">
					<div className="jh__bar-side">
						{canEdit && <button className="btn btn-sm" onClick={() => navigate(`/jobs/${job.ROWID}/edit`, { state: { background: location } })}><Pencil size={14} aria-hidden="true" /> Edit Job</button>}
					</div>
					<span className="jh__bar-title"><Briefcase size={18} aria-hidden="true" /> Job Details</span>
					<div className="jh__bar-side jh__bar-side--right">
						{job.crm_deal_id ? <span className="jh__deal" title="CRM deal">Deal: {job.crm_deal_id}</span> : <span>No Deal</span>}
					</div>
				</div>
				<div className="jh__body">
					<div className="jh__main">
						<h1 className="jh__title">{job.name}</h1>
						<ul className="jh__facts">
							<li className="jh__fact"><span className="jh__fact-label">Stage</span> <StageCell stage={job.stage} pill /></li>
							<li className="jh__fact"><FolderOpen size={15} aria-hidden="true" /> <span className="jh__fact-label">Location of files on VE Server</span> <span>{serverPath || '-'}</span></li>
							<li className="jh__fact">{workdrive ? <a className="btn btn-sm" href={workdrive} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Go to Workdrive</a> : <span className="muted">Go to Workdrive (not created yet)</span>}</li>
						</ul>
						<div className="jh__stats">
							<HeadStat tone="design" icon={<Network size={20} />} label={TASK_NAMES.design.title} value={design.length} />
							<HeadStat tone="fab" icon={<Hammer size={20} />} label={TASK_NAMES.fabrication.title} value={fab.length} />
							<HeadStat tone="install" icon={<Truck size={20} />} label={TASK_NAMES.install.title} value={install.length} />
						</div>
					</div>
					<div className="jh-ring"><Ring value={progress.job} label="Job progress" /><span>% Job Complete</span></div>
				</div>
			</header>

			{canEdit && inReview.length > 0 && (
				<div className="attention" role="status">
					<strong className="num">{inReview.length}</strong> {inReview.length === 1 ? 'task is' : 'tasks are'} waiting for your approval.
					{inReview.slice(0, 3).map((t) => <Link key={t.ROWID} to={'/tasks/' + t.ROWID}>Review {t.name}</Link>)}
				</div>
			)}
			{canClose && (
				<div className="attention" role="status">
					Every task is finished.
					<button className="btn btn-sm" disabled={close.isPending} onClick={async () => {
							if (inReview.length && !(await confirm({ message: `${inReview.length} ${inReview.length === 1 ? 'task is' : 'tasks are'} still in Manager Review. Closing will not wait for approval. Close the job anyway?`, confirmLabel: 'Close job' }))) return;
							close.mutate(undefined, { onSuccess: () => notify('Job closed'), onError: (e) => notify(e instanceof Error ? e.message : 'Could not close the job', 'error') });
						}}>
						{close.isPending ? 'Closing…' : 'Close job'}
					</button>
				</div>
			)}
			{move.isError && <Notice kind="error">{move.error.message}</Notice>}

			<div className="grid-2 jd-pair">
				<Card title="Job Locations" tone="loc" flush>
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

			<Section tone="design" icon={<Network size={20} />} title={TASK_NAMES.design.title} count={design.length} pills={<Pills list={design} late={design.filter(late).length} />} actions={addBtn(TASK_NAMES.design.addLabel, 'design')}>
				{addForm('design')}
				<TaskTable rowClass={rowFlag} title={TASK_NAMES.design.table} empty="No design tasks." rows={design} cols={['Design Type', 'Task Name', 'Stage', 'Required Finish', 'Quoted Hours', 'Booked Hours', ...(seesMoney ? ['Labour Cost'] : []), '']}
					row={(t) => [t.kind ?? '', <span key="n"><Link to={'/tasks/' + t.ROWID}>{t.name}</Link>{lateTag(t)}</span>, <StageCell key="s" stage={t.stage} pill />, fmtDate(t.required_finish), hrs(t.quoted_hours), booked(t), ...(seesMoney ? [hrs(t.labour_cost)] : []), actions(t)]}
					numeric={seesMoney ? [4, 5, 6] : [4, 5]} onRowContext={openMenu} />
			</Section>

			<Section tone="fab" icon={<Hammer size={20} />} title={TASK_NAMES.fabrication.title} count={fab.length} pills={<Pills list={fab} late={fab.filter(late).length} />} actions={addBtn(TASK_NAMES.fabrication.addLabel, 'fabrication')}
				meta={(
					<dl className="jsec__meta">
						<div><dt>% of Fab Completed</dt><dd className="num">{num(progress.fab)}</dd></div>
						<div><dt>Required Fab Finish Date</dt><dd>{fmtDate((job as { required_fab_finish?: string }).required_fab_finish)}</dd></div>
						<div><dt>Agreed Fab Finish Date</dt><dd>{fmtDate((job as { agreed_fab_finish?: string }).agreed_fab_finish)}</dd></div>
					</dl>
				)}>
				{addForm('fabrication')}
				<TaskTable rowClass={rowFlag} title={TASK_NAMES.fabrication.table} empty="No fabrication tasks." rows={grouped(fab)} onRowContext={openMenu} cols={['Task Name', 'Stage', 'Booked Hours', ...(seesMoney ? ['Total Labour Cost'] : []), 'Team Leader', 'Team Member', 'Scheduled Date', 'Quoted Hours', '']}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link>{lateTag(t)}</span>, <StageCell key="s" stage={t.stage} pill />, booked(t), ...(seesMoney ? [hrs(t.labour_cost)] : []), t.team_leader ?? '', t.team_members ?? '', fmtDate(t.scheduled_date), hrs(t.quoted_hours), actions(t)]}
					numeric={seesMoney ? [2, 3, 7] : [2, 6]}
					groupTotals={(list) => ['', '', hrs(sumBooked(list)), ...(seesMoney ? [hrs(sumCost(list))] : []), '', '', '', hrs(sumQuoted(list)), '']} footer={['Total', '', hrs(sumBooked(fab)), ...(seesMoney ? [hrs(sumCost(fab))] : []), '', '', '', hrs(sumQuoted(fab)), '']} />
			</Section>

			<Section tone="install" icon={<Truck size={20} />} title={TASK_NAMES.install.title} count={install.length} pills={<Pills list={install} late={install.filter(late).length} />}
				actions={<>{addBtn(TASK_NAMES.install.addLabel, 'install', 'VE Install')}{addBtn('Add Minor Task', 'install', 'Minor Task')}</>}>
				{addForm('install')}
				<TaskTable rowClass={rowFlag} title={TASK_NAMES.install.table} empty="No installation tasks." rows={grouped(install)} onRowContext={openMenu} cols={['Task Name', 'Install Date', 'Stage', 'Team Leader', 'Team Member', 'SWMS Status', 'Quoted Man Hours', 'Booked Hours', ...(seesMoney ? ['Total Labour Cost'] : []), '']}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link>{kindTag(t.kind)}{lateTag(t)}</span>, fmtDate(t.scheduled_date), <StageCell key="s" stage={t.stage} pill />, t.team_leader ?? '', t.team_members ?? '', t.swms_status ?? '', hrs(t.quoted_hours), booked(t), ...(seesMoney ? [hrs(t.labour_cost)] : []), actions(t)]}
					numeric={seesMoney ? [6, 7, 8] : [6, 7]}
					groupTotals={(list) => ['', '', '', '', '', '', hrs(sumQuoted(list)), hrs(sumBooked(list)), ...(seesMoney ? [hrs(sumCost(list))] : []), '']} footer={['Total', '', '', '', '', '', hrs(sumQuoted(install)), hrs(sumBooked(install)), ...(seesMoney ? [hrs(sumCost(install))] : []), '']} />
			</Section>

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
