import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Download, Plus, Search } from 'lucide-react';
import { useCreateJob, useJobs, useMe, usePeople } from '../api/queries';
import { num } from '../api/types';
import type { Job, JobTabCounts } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { FilterMenu } from '../components/FilterMenu';
import { Card, PageHeader, fmtDate } from '../components/ui';

const VIEWS: { key: keyof JobTabCounts; label: string }[] = [
	{ key: 'all', label: 'All' },
	{ key: 'my_open', label: 'My open' },
	{ key: 'my_jobs', label: 'My jobs' },
	{ key: 'preparation', label: 'Preparation' },
	{ key: 'ongoing', label: 'Ongoing' },
	{ key: 'completed', label: 'Completed' },
];
const STAGES = ['Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];
const FINISHED = ['Completed', 'Completed - Closed', 'Cancelled'];
const today = () => new Date().toISOString().slice(0, 10);

/** One CSV cell; values that start with = + - @ are prefixed so a spreadsheet never runs them as a formula. */
const cell = (v: unknown) => {
	let s = v === null || v === undefined ? '' : String(v);
	if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
	return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function exportCsv(rows: Job[]) {
	const head = ['Job', 'Deal', 'Stage', 'Project manager', 'Fab manager', 'Fab %', 'Install %', 'Job %', 'Booked hours', 'Quoted hours', 'Expected finish'];
	const lines = [head.join(',')].concat(rows.map((j) => [j.name, j.crm_deal_id, j.stage, j.pm_name, j.fab_manager_name, num(j.percent_fab), num(j.percent_install), num(j.percent_job), j.booked_hours ?? 0, j.quoted_hours ?? 0, j.expected_finish].map(cell).join(',')));
	const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = 'jobs.csv';
	a.click();
	URL.revokeObjectURL(url);
}

/** The jobs list: tabs with counts, filters, hours against the quote, warnings, and a CSV export of what you select. */
export function Jobs() {
	const [params, setParams] = useSearchParams();
	const text = params.get('q') ?? '';
	const [stage, setStage] = useState('');
	const [pm, setPm] = useState('');
	const [fab, setFab] = useState('');
	const [view, setView] = useState<keyof JobTabCounts>('all');
	const [picked, setPicked] = useState<string[]>([]);
	const jobs = useJobs(stage || undefined, view, { pm_id: pm || undefined, fab_manager_id: fab || undefined });
	const me = useMe();
	const canManage = !!me.data?.permissions.createJob;
	const people = usePeople(canManage);
	const create = useCreateJob();
	const navigate = useNavigate();
	const { notify } = useToast();
	const [name, setName] = useState('');
	const [open, setOpen] = useState(false);

	const needle = text.trim().toLowerCase();
	const shown = useMemo(() => (jobs.data?.items ?? []).filter((j) => !needle || j.name.toLowerCase().includes(needle) || (j.crm_deal_id ?? '').toLowerCase().includes(needle)), [jobs.data, needle]);
	const counts = jobs.data?.counts;
	const activeFilters = [stage, pm, fab].filter(Boolean).length;
	const managers = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const allPicked = shown.length > 0 && shown.every((j) => picked.includes(j.ROWID));
	const chosen = shown.filter((j) => picked.includes(j.ROWID));

	const submit = (e: React.FormEvent) => {
		e.preventDefault();
		create.mutate(
			{ name: name.trim() },
			{
				onSuccess: (job) => {
					notify('Job created');
					navigate('/jobs/' + job.ROWID);
				},
			},
		);
	};

	return (
		<>
			<PageHeader eyebrow="Projects" title="Jobs" subtitle="Every job from deal to finished install.">
				{canManage && !open && (
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> New job
					</button>
				)}
			</PageHeader>

			<Card flush>
				{open && (
					<form className="inline-form" onSubmit={submit}>
						<label>
							<span className="toolbar__label">Job name</span>
							<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />
						</label>
						<button className="btn" disabled={create.isPending || !name.trim()}>
							{create.isPending ? 'Creating…' : 'Create job'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{create.isError && <p role="alert">{create.error.message}</p>}
					</form>
				)}

				<div className="list-toolbar">
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
									{STAGES.map((s) => (
										<option key={s}>{s}</option>
									))}
								</select>
							</label>
							{canManage && (
								<>
									<label>
										<span className="toolbar__label">Project manager</span>
										<select value={pm} onChange={(e) => setPm(e.target.value)}>
											<option value="">Anyone</option>
											{managers.map((p) => (
												<option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>
											))}
										</select>
									</label>
									<label>
										<span className="toolbar__label">Fab manager</span>
										<select value={fab} onChange={(e) => setFab(e.target.value)}>
											<option value="">Anyone</option>
											{managers.map((p) => (
												<option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>
											))}
										</select>
									</label>
								</>
							)}
							</>
						)}
					/>
					<label className="search" style={{ flex: '1 1 220px', maxWidth: 360 }}>
						<Search size={16} aria-hidden="true" />
						<input type="search" value={text} onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })} placeholder="Search name, number or deal…" aria-label="Search jobs" />
					</label>
				</div>

				{chosen.length > 0 && (
					<div className="bulk-bar" role="region" aria-label="Selected jobs">
						<strong className="num">{chosen.length}</strong> selected
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => exportCsv(chosen)}>
							<Download size={14} aria-hidden="true" /> Export CSV
						</button>
						<button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>
							Clear
						</button>
					</div>
				)}

				{jobs.isPending && <p role="status" className="table-empty">Loading jobs…</p>}
				{jobs.isError && (
					<p role="alert">
						Could not load jobs.{' '}
						<button className="btn btn-ghost btn-sm" onClick={() => jobs.refetch()}>
							Try again
						</button>
					</p>
				)}
				{jobs.isSuccess && shown.length === 0 && <p className="table-empty">{needle ? 'No jobs match that search.' : 'No jobs to show.'}</p>}

				{jobs.isSuccess && shown.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">Jobs</caption>
							<thead>
								<tr>
									{canManage && (
										<th scope="col" className="col-check">
											<input type="checkbox" aria-label="Select all jobs shown" checked={allPicked} onChange={(e) => setPicked(e.target.checked ? shown.map((j) => j.ROWID) : [])} />
										</th>
									)}
									<th scope="col">Job</th>
									<th scope="col">Stage</th>
									<th scope="col">Project / fab manager</th>
									<th scope="col">Progress</th>
									<th scope="col">Hours</th>
									<th scope="col">Finish</th>
								</tr>
							</thead>
							<tbody>
								{shown.map((j) => {
									const finished = FINISHED.includes(j.stage);
									const late = !!j.expected_finish && j.expected_finish.slice(0, 10) < today() && !finished;
									const over = (j.quoted_hours ?? 0) > 0 && (j.booked_hours ?? 0) > (j.quoted_hours ?? 0);
									return (
										<tr key={j.ROWID} className={picked.includes(j.ROWID) ? 'row-picked' : ''}>
											{canManage && (
												<td data-label="Select" className="col-check">
													<input type="checkbox" aria-label={`Select ${j.name}`} checked={picked.includes(j.ROWID)} onChange={(e) => setPicked(e.target.checked ? [...picked, j.ROWID] : picked.filter((x) => x !== j.ROWID))} />
												</td>
											)}
											<td data-label="Job" className="cell-primary">
												<Link to={`/jobs/${j.ROWID}`}>{j.name}</Link>
												{j.crm_deal_id && <small className="sub">Deal {j.crm_deal_id}</small>}
												{(j.risk ?? []).map((r) => (
													<small key={r} className="risk">
														<AlertTriangle size={12} aria-hidden="true" /> {r}
													</small>
												))}
											</td>
											<td data-label="Stage">
												<Chip status={j.stage} />
											</td>
											<td data-label="Managers">
												<span className="two-line">
													<span>{j.pm_name || '-'}</span>
													<small>{j.fab_manager_name || '-'}</small>
												</span>
											</td>
											<td data-label="Progress">
												<span className="two-line">
													<span className="mini-bar" role="img" aria-label={`Job ${num(j.percent_job)} percent`}>
														<span style={{ width: `${Math.min(100, num(j.percent_job))}%` }} />
													</span>
													<small className="num">
														{num(j.percent_job)}% · Fab {num(j.percent_fab)}% · Install {num(j.percent_install)}%
													</small>
												</span>
											</td>
											<td data-label="Hours" className={'num' + (over ? ' over' : '')}>
												{(j.booked_hours ?? 0) || (j.quoted_hours ?? 0) ? `${j.booked_hours ?? 0} / ${j.quoted_hours ?? 0}h` : '-'}
											</td>
											<td data-label="Finish" className={late ? 'over' : ''}>
												{fmtDate(j.expected_finish)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
