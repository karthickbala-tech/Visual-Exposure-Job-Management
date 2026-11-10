import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const today = () => new Date().toISOString().slice(0, 10);
const hrs = (v: unknown) => (num(v as string | number) ? num(v as string | number).toFixed(2) : '');
const kindClass = (k?: string) => (k ? 'kind-' + k.toLowerCase().replace(/[^a-z]+/g, '-') : '');
const INSTALL_KINDS = ['VE Install', 'VE Subtask', 'Minor Task', 'Print Only', 'External Install'];

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
	const move = useTransitionTask(id ?? '');
	const close = useCloseJob(id ?? '');
	const { notify } = useToast();
	const [adding, setAdding] = useState<{ type: TaskType; kind: string } | null>(null);

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
				<div className="jd-head__side">{canEdit && <button className="btn btn-sm" onClick={() => navigate(`/jobs/${job.ROWID}/edit`)}><Pencil size={14} aria-hidden="true" /> Edit job</button>}</div>
				<h1 className="jd-head__title"><Briefcase size={20} aria-hidden="true" /> Job details</h1>
				<div className="jd-head__side jd-head__side--right">
					{job.crm_deal_id ? <span className="jd-deal" title="CRM deal">Deal {job.crm_deal_id}</span> : <span className="muted">No deal</span>}
				</div>
			</header>

			<div className="jd-facts">
				<div className="jd-fact jd-fact--name"><strong>{job.name}</strong><span>Job name</span></div>
				<div className="jd-fact"><strong>{job.stage}</strong><span>Job stage</span></div>
				<div className="jd-fact"><strong>{serverPath || '-'}</strong><span>Location of files on VE server</span></div>
				<div className="jd-fact jd-fact--action">
					{workdrive ? <a className="btn btn-sm" href={workdrive} target="_blank" rel="noreferrer"><ExternalLink size={14} aria-hidden="true" /> Go to Workdrive</a> : <span className="muted">No Workdrive folder yet</span>}
				</div>
				<div className="jd-fact jd-fact--ring"><span>% Job complete</span><Ring value={progress.job} label="Job progress" /></div>
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

			<div className="grid-2">
				<Card title="Job locations" flush>
					{locations.length === 0 ? <p className="table-empty">No Data Available</p> : (
						<div className="table-wrap">
							<table className="table"><caption className="sr-only">Job locations</caption><thead><tr><th scope="col">Location</th><th scope="col">Address</th></tr></thead>
								<tbody>{locations.map((l) => <tr key={l.id}><td data-label="Location" className="cell-primary">{l.name}</td><td data-label="Address">{l.address || '-'}</td></tr>)}</tbody>
							</table>
						</div>
					)}
				</Card>
				<SignsPanel jobId={id ?? ''} canWrite={canAdd} />
			</div>

			<Band tone="design" icon={<Network size={18} />} title="Management tasks">
				<div className="jd-stats">
					{addBtn('Add design task', 'design')}
					<Stat label="Total design tasks" value={design.length} />
					<Stat label="Overdue design tasks" value={design.filter(late).length} tone={design.some(late) ? 'danger' : undefined} />
				</div>
				{addForm('design')}
				<TaskTable empty="No design tasks." rows={design} cols={['Design type', 'Task name', 'Stage', 'Required finish', 'Quoted hours', 'Booked hours', '']}
					row={(t) => [t.kind ?? '', <Link key="n" to={'/tasks/' + t.ROWID}>{t.name}</Link>, <StageCell key="s" stage={t.stage} />, fmtDate(t.required_finish), hrs(t.quoted_hours), hrs(t.booked_hours), actions(t)]}
					numeric={[4, 5]} />
			</Band>

			<Band tone="fab" icon={<Hammer size={18} />} title="Fabrication tasks">
				<div className="jd-stats">
					{addBtn('Add fab task', 'fabrication')}
					<Stat label="Total fab tasks" value={fab.length} />
					<Stat label="Open fab tasks" value={open(fab).length} tone={open(fab).length ? 'danger' : undefined} />
					<Stat label="% of fab completed" value={num(progress.fab)} />
					<Stat label="Required fab finish date" value={fmtDate((job as { required_fab_finish?: string }).required_fab_finish)} />
					<Stat label="Agreed fab finish date" value={fmtDate((job as { agreed_fab_finish?: string }).agreed_fab_finish)} />
				</div>
				{addForm('fabrication')}
				<TaskTable empty="No fabrication tasks." rows={grouped(fab)} cols={['Task name', 'Stage', 'Booked hours', ...(seesMoney ? ['Total labour cost'] : []), 'Team leader', 'Team member', '']}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></span>, <StageCell key="s" stage={t.stage} />, hrs(t.booked_hours), ...(seesMoney ? [hrs(t.labour_cost)] : []), t.team_leader ?? '', t.team_members ?? '', actions(t)]}
					numeric={seesMoney ? [2, 3] : [2]}
					footer={['Total', '', hrs(sumBooked(fab)), ...(seesMoney ? [hrs(sumCost(fab))] : []), '', '', '']} />
			</Band>

			<Band tone="install" icon={<Truck size={18} />} title="Installation tasks">
				<div className="jd-stats">
					{addBtn('Add install task', 'install', 'VE Install')}
					{addBtn('Add minor task', 'install', 'Minor Task')}
					<Stat label="Total install tasks" value={install.length} />
					<Stat label="Open install tasks" value={open(install).length} tone={open(install).length ? 'danger' : undefined} />
					<div className="jd-legend" aria-label="Task kinds">{INSTALL_KINDS.map((k) => <span key={k} className={'jd-kind ' + kindClass(k)}>{k.replace('VE ', '').replace(' Install', '')}</span>)}</div>
				</div>
				{addForm('install')}
				<TaskTable empty="No installation tasks." rows={grouped(install)} cols={['Task name', 'Install date', 'Stage', 'Team leader', 'Team member', 'SWMS status', 'Quoted man hours', 'Booked hours', ...(seesMoney ? ['Total labour cost'] : []), '']}
					rowClass={(t) => kindClass(t.kind)}
					row={(t) => [<span key="n" className={t.parent_id ? 'jd-sub' : ''}><Link to={'/tasks/' + t.ROWID}>{t.name}</Link></span>, fmtDate(t.scheduled_date), <StageCell key="s" stage={t.stage} />, t.team_leader ?? '', t.team_members ?? '', t.swms_status ?? '', hrs(t.quoted_hours), hrs(t.booked_hours), ...(seesMoney ? [hrs(t.labour_cost)] : []), actions(t)]}
					numeric={seesMoney ? [6, 7, 8] : [6, 7]}
					footer={['Total', '', '', '', '', '', hrs(sumQuoted(install)), hrs(sumBooked(install)), ...(seesMoney ? [hrs(sumCost(install))] : []), '']} />
			</Band>

			<QuotesPanel jobId={id ?? ''} hasDeal={!!job.crm_deal_id} canSync={canAdd} />
		</>
	);
}

/** A task table: headings, rows (each a list of cells), an optional totals row, and "Showing N of N" under it. */
function TaskTable({ cols, rows, row, rowClass, footer, numeric = [], empty }: { cols: string[]; rows: Task[]; row: (t: Task) => ReactNode[]; rowClass?: (t: Task) => string; footer?: ReactNode[]; numeric?: number[]; empty: string }) {
	if (rows.length === 0) return <p className="table-empty jd-empty">{empty}</p>;
	return (
		<div className="jd-table">
			<div className="table-wrap">
				<table className="table jd-tasks">
					<caption className="sr-only">Tasks</caption>
					<thead><tr>{cols.map((c, i) => <th key={i} scope="col" className={numeric.includes(i) ? 'num' : ''}>{c || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
					<tbody>
						{rows.map((t) => <tr key={t.ROWID} className={rowClass?.(t)}>{row(t).map((c, i) => <td key={i} data-label={cols[i]} className={(i === 0 ? 'cell-primary ' : '') + (numeric.includes(i) ? 'num' : '')}>{c}</td>)}</tr>)}
						{footer && <tr className="jd-total">{footer.map((c, i) => <td key={i} className={numeric.includes(i) ? 'num' : ''}>{c}</td>)}</tr>}
					</tbody>
				</table>
			</div>
			<p className="grid-foot">Showing {rows.length} of {rows.length}</p>
		</div>
	);
}
