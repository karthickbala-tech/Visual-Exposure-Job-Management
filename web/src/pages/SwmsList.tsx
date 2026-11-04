import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { pdfUrl, useChecklistReport, useSwmsList } from '../api/more';
import { Chip } from '../components/Chip';
import { Card, PageHeader } from '../components/ui';

const VIEWS = [
	{ key: 'all', label: 'All' },
	{ key: 'open', label: 'Open' },
	{ key: 'completed', label: 'Completed' },
];

/** Safe work method statements: all, still open (not fully signed), completed; and just mine. */
export function SwmsList() {
	const [view, setView] = useState('open');
	const [mine, setMine] = useState(false);
	const q = useSwmsList(view, mine);

	return (
		<>
			<PageHeader eyebrow="Safety" title="SWMS" subtitle="Statements for install tasks. A crew goes on site only once the statement is signed.">
				<div className="segmented" role="group" aria-label="Show">
					{VIEWS.map((v) => (
						<button key={v.key} className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => setView(v.key)}>{v.label}</button>
					))}
				</div>
				<label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Mine only</label>
			</PageHeader>

			<Card flush>
				{q.isPending && <p role="status" className="table-empty">Loading…</p>}
				{q.isError && <p role="alert">Could not load SWMS.</p>}
				{q.isSuccess && q.data.items.length === 0 && <p className="table-empty">No statements to show.</p>}
				{q.isSuccess && q.data.items.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">SWMS</caption>
							<thead>
								<tr><th scope="col">Install task</th><th scope="col">Site</th><th scope="col">Status</th><th scope="col">PDF</th></tr>
							</thead>
							<tbody>
								{q.data.items.map((s) => (
									<tr key={s.id}>
										<td data-label="Install task" className="cell-primary">{s.task ? <Link to={'/tasks/' + s.task.id}>{s.task.name}</Link> : <strong>SWMS {s.id}</strong>}</td>
										<td data-label="Site">{s.siteAddress || '-'}</td>
										<td data-label="Status"><Chip status={s.status} /></td>
										<td data-label="PDF"><a className="btn btn-ghost btn-sm" href={pdfUrl(`/swms/${s.id}/pdf`)} target="_blank" rel="noreferrer"><FileDown size={14} aria-hidden="true" /> PDF</a></td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
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
					<div className="table-wrap">
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
				)}
			</Card>
		</>
	);
}
