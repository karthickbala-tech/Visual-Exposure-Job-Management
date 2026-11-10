/**
 * A stage shown the way the old Creator lists did: the whole cell is filled with the stage colour, so a column of
 * stages reads at a glance. Colours follow the reference screenshots; the text colour is chosen for contrast.
 */
const FILL: Record<string, { bg: string; ink: string }> = {
	Preparation: { bg: '#f0b31b', ink: '#1b1b1e' },
	'In Progress': { bg: '#8fb1f0', ink: '#1b1b1e' },
	'On Hold': { bg: '#f7d56a', ink: '#1b1b1e' },
	Completed: { bg: '#5fc15a', ink: '#10300d' },
	'Approved & Completed': { bg: '#5fc15a', ink: '#10300d' },
	'Completed - Closed': { bg: '#3a7bd5', ink: '#ffffff' },
	'Complete - Not Used': { bg: '#5fc15a', ink: '#10300d' },
	Cancelled: { bg: '#d9d9db', ink: '#1b1b1e' },
	'Awaiting Scheduling': { bg: '#c6c6c7', ink: '#1b1b1e' },
	'To be Assigned': { bg: '#c6c6c7', ink: '#1b1b1e' },
	Scheduled: { bg: '#8fb1f0', ink: '#1b1b1e' },
	'Manager Review': { bg: '#c3a6f0', ink: '#1b1b1e' },
	Rejected: { bg: '#ee7b73', ink: '#1b1b1e' },
	Reopen: { bg: '#f7b36a', ink: '#1b1b1e' },
};

export function StageCell({ stage }: { stage: string }) {
	const c = FILL[stage] ?? { bg: '#e3e3e4', ink: '#1b1b1e' };
	return <span className="stage-cell" style={{ background: c.bg, color: c.ink }}>{stage}</span>;
}
