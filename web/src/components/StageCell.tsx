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

/** The soft chip colour (from the theme's chip tokens) each stage uses when shown as a pill. */
const TONE: Record<string, 'gray' | 'blue' | 'amber' | 'purple' | 'green' | 'red' | 'done'> = {
	Preparation: 'amber',
	'In Progress': 'blue',
	'On Hold': 'amber',
	Completed: 'done',
	'Approved & Completed': 'done',
	'Completed - Closed': 'blue',
	'Complete - Not Used': 'done',
	Cancelled: 'gray',
	'Awaiting Scheduling': 'gray',
	'To be Assigned': 'gray',
	Scheduled: 'blue',
	'Manager Review': 'purple',
	Rejected: 'red',
	Reopen: 'amber',
};

/** `pill` shows the stage as a compact rounded chip (job page tables) instead of filling the whole cell (lists). */
export function StageCell({ stage, pill = false }: { stage: string; pill?: boolean }) {
	if (pill) return <span className={'stage-pill stage-pill--' + (TONE[stage] ?? 'gray')}>{stage}</span>;
	const c = FILL[stage] ?? { bg: '#e3e3e4', ink: '#1b1b1e' };
	return <span className="stage-cell" style={{ background: c.bg, color: c.ink }}>{stage}</span>;
}
