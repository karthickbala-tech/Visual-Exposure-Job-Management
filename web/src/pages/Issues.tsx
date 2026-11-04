import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileDown, Plus } from 'lucide-react';
import { pdfUrl, useIssueHistory } from '../api/more';

function History({ id }: { id: string }) {
	const q = useIssueHistory(id, true);
	if (q.isPending) return <p role="status" className="muted">Loading history…</p>;
	if (q.isError) return <p role="alert">Could not load the history.</p>;
	if (q.data.items.length === 0) return <p className="muted">No changes yet.</p>;
	return (
		<ul className="plain-list">
			{q.data.items.map((e, i) => (
				<li key={i}><small>{e.at?.replace('T', ' ').slice(0, 16) ?? ''}</small> {e.changes.map((c) => `${c.field.replace(/_id$/, '').replace(/_/g, ' ')}: ${c.from || '-'} to ${c.to || '-'}`).join('; ')}</li>
			))}
		</ul>
	);
}
import { useCreateIssue, useIssues, useMoveIssue } from '../api/queries';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export function Issues() {
	const [status, setStatus] = useState('');
	const issues = useIssues(status || undefined);
	const create = useCreateIssue();
	const move = useMoveIssue();
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [dept, setDept] = useState('');
	const [showHistory, setShowHistory] = useState<string | null>(null);
	const [subject, setSubject] = useState('');
	const [priority, setPriority] = useState('Normal');

	return (
		<>
			<PageHeader eyebrow="Safety and quality" title="Issues" subtitle="Problems found on site or in the workshop, routed to the right department.">
				{!open && (
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Raise an issue
					</button>
				)}
			</PageHeader>

			<Card flush>
				{open && (
					<form
						className="inline-form"
						onSubmit={(e) => {
							e.preventDefault();
							create.mutate(
								{ subject: subject.trim(), issue_priority: priority },
								{
									onSuccess: () => {
										setSubject('');
										setOpen(false);
										notify('Issue raised');
									},
								},
							);
						}}
					>
						<label>
							<span className="toolbar__label">What is the problem?</span>
							<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={255} autoFocus />
						</label>
						<label style={{ flex: '0 1 180px' }}>
							<span className="toolbar__label">Priority</span>
							<select value={priority} onChange={(e) => setPriority(e.target.value)} style={{ width: '100%' }}>
								{PRIORITIES.map((p) => (
									<option key={p}>{p}</option>
								))}
							</select>
						</label>
						<button className="btn" disabled={create.isPending || !subject.trim()}>
							{create.isPending ? 'Saving…' : 'Raise issue'}
						</button>
						<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
							Cancel
						</button>
						{create.isError && <p role="alert">{create.error.message}</p>}
					</form>
				)}

				<div className="inline-form">
					<label style={{ flex: '0 1 200px' }}>
						<span className="toolbar__label">Department</span>
						<select value={dept} onChange={(e) => setDept(e.target.value)} style={{ width: '100%' }}>
							<option value="">All</option>
							{['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards'].map((d) => <option key={d}>{d}</option>)}
						</select>
					</label>
					<label style={{ flex: '0 1 200px' }}>
						<span className="toolbar__label">Status</span>
						<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
							<option value="">All</option>
							{STATUSES.map((s) => (
								<option key={s}>{s}</option>
							))}
						</select>
					</label>
				</div>

				{issues.isPending && <p role="status" className="table-empty">Loading issues…</p>}
				{issues.isError && <p role="alert">Could not load issues.</p>}
				{issues.isSuccess && issues.data.items.length === 0 && <p className="table-empty">No issues to show.</p>}
				{move.isError && <p role="alert">{move.error.message}</p>}

				{issues.isSuccess && issues.data.items.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">Issues</caption>
							<thead>
								<tr>
									<th scope="col">Issue</th>
									<th scope="col">Department</th>
									<th scope="col">Priority</th>
									<th scope="col">Status</th>
									<th scope="col">Actions</th>
								</tr>
							</thead>
							<tbody>
								{issues.data.items.filter((i) => !dept || i.department === dept).map((i) => (
									<Fragment key={i.ROWID}>
									<tr>
										<td data-label="Issue" className="cell-primary">
											{i.task_id ? <Link to={'/tasks/' + i.task_id}>{i.subject}</Link> : <strong>{i.subject}</strong>}
										</td>
										<td data-label="Department">{i.department || '-'}</td>
										<td data-label="Priority">{i.issue_priority || '-'}</td>
										<td data-label="Status">
											<Chip status={i.issue_status} />
										</td>
										<td data-label="Actions">
											<div className="actions">
												<button className="btn btn-ghost btn-sm" aria-expanded={showHistory === i.ROWID} onClick={() => setShowHistory(showHistory === i.ROWID ? null : i.ROWID)}>History</button>
												<a className="btn btn-ghost btn-sm" href={pdfUrl(`/issues/${i.ROWID}/pdf?layout=full`)} target="_blank" rel="noreferrer" aria-label={`PDF of ${i.subject}`}><FileDown size={14} aria-hidden="true" /> PDF</a>
												{(i.nextStatuses ?? []).map((s) => (
													<button
														key={s}
														className="btn btn-ghost btn-sm"
														disabled={move.isPending}
														onClick={() => move.mutate({ id: i.ROWID, issue_status: s }, { onSuccess: () => notify(`Issue moved to ${s}`) })}
													>
														{s}
													</button>
												))}
											</div>
										</td>
									</tr>
									{showHistory === i.ROWID && <tr><td colSpan={5}><History id={i.ROWID} /></td></tr>}
									</Fragment>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
