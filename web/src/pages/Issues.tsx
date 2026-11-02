import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCreateIssue, useIssues, useMoveIssue } from '../api/queries';
import { Chip } from '../components/Chip';
import './Table.css';

const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export function Issues() {
	const [status, setStatus] = useState('');
	const issues = useIssues(status || undefined);
	const create = useCreateIssue();
	const move = useMoveIssue();
	const [open, setOpen] = useState(false);
	const [subject, setSubject] = useState('');
	const [priority, setPriority] = useState('Normal');

	return (
		<>
			<h1 className="page-title">Issues</h1>

			{!open ? (
				<button className="btn" onClick={() => setOpen(true)}>
					Raise an issue
				</button>
			) : (
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
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">What is the problem?</span>
						<input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={255} autoFocus />
					</label>
					<label>
						<span className="toolbar__label">Priority</span>
						<select value={priority} onChange={(e) => setPriority(e.target.value)}>
							{PRIORITIES.map((p) => (
								<option key={p}>{p}</option>
							))}
						</select>
					</label>
					<button className="btn" disabled={create.isPending || !subject.trim()}>
						{create.isPending ? 'Saving...' : 'Raise issue'}
					</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
						Cancel
					</button>
					{create.isError && <p role="alert">{create.error.message}</p>}
				</form>
			)}

			<div className="toolbar">
				<label>
					<span className="toolbar__label">Status</span>
					<select value={status} onChange={(e) => setStatus(e.target.value)}>
						<option value="">All</option>
						{STATUSES.map((s) => (
							<option key={s}>{s}</option>
						))}
					</select>
				</label>
			</div>

			{issues.isPending && <p role="status">Loading issues...</p>}
			{issues.isError && <p role="alert">Could not load issues.</p>}
			{issues.isSuccess && issues.data.items.length === 0 && <p>No issues to show.</p>}
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
							{issues.data.items.map((i) => (
								<tr key={i.ROWID}>
									<td data-label="Issue">
										{i.task_id ? <Link to={'/tasks/' + i.task_id}>{i.subject}</Link> : i.subject}
									</td>
									<td data-label="Department">{i.department || '-'}</td>
									<td data-label="Priority">{i.issue_priority || '-'}</td>
									<td data-label="Status">
										<Chip status={i.issue_status} />
									</td>
									<td data-label="Actions">
										<div className="actions">
											{(i.nextStatuses ?? []).map((s) => (
												<button key={s} className="btn btn-ghost" disabled={move.isPending} onClick={() => move.mutate({ id: i.ROWID, issue_status: s })}>
													{s}
												</button>
											))}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}
