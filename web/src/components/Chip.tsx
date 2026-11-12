/** Which colour tone each status gets. The label is always shown, so colour never carries meaning alone. */
const TONES: Record<string, 'gray' | 'blue' | 'amber' | 'purple' | 'green' | 'red'> = {
	// jobs and tasks
	Preparation: 'gray', 'In Progress': 'blue', 'On Hold': 'amber', Completed: 'green', 'Completed - Closed': 'green', Cancelled: 'red',
	'Awaiting Scheduling': 'gray', Scheduled: 'blue', 'Manager Review': 'purple', Rejected: 'red', Reopen: 'amber', 'Complete - Not Used': 'gray',
	'Awaiting Submission': 'amber', 'Approved & Completed': 'green', 'To be Assigned': 'gray',
	// SWMS
	Created: 'red', 'PM Signed': 'amber', 'TL Signed': 'green', 'Not Required': 'gray',
	// issues
	Open: 'red', Resolved: 'green', Closed: 'gray', 'To Be discussed': 'red', 'To Be Quoted': 'amber', Quoted: 'blue', 'Quote Sent': 'purple',
	// compliance and people
	'In service': 'green', 'Off hire': 'gray', 'Out of service': 'red', subcontractor: 'blue', supplier: 'purple', client: 'green', internal: 'gray', Pending: 'amber', Done: 'green', Failed: 'red', Valid: 'green', Expiring: 'amber', Expired: 'red', 'No expiry': 'gray', Active: 'green', Inactive: 'gray',
	// checklists
	'Not Completed': 'gray',
};

export function Chip({ status }: { status: string }) {
	return (
		<span className={`chip chip-${TONES[status] ?? 'gray'}`}>
			<span className="chip-dot" aria-hidden="true" />
			{status}
		</span>
	);
}

/** Thin progress bar with a text value for screen readers and colour-blind users. `label` is shown beside it unless `single`. */
export function Progress({ label, value, single = false }: { label: string; value: number; single?: boolean }) {
	const v = Math.max(0, Math.min(100, Math.round(value)));
	return (
		<div className={'progress' + (single ? ' progress--single' : '')} role="img" aria-label={`${label} ${v} percent`}>
			{!single && <span className="progress__label">{label}</span>}
			<span className="progress__track">
				<span className="progress__fill" style={{ width: `${v}%` }} />
			</span>
			<span className="progress__value num">{v}%</span>
		</div>
	);
}
