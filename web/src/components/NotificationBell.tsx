import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CalendarClock, CheckCircle2, FileWarning } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useDashboard } from '../api/queries';

interface Item {
	key: string;
	icon: LucideIcon;
	text: string;
	to: string;
}

const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What needs attention, taken from the dashboard figures (the same request the Dashboard page uses, so the bell adds none of its own).
 * Managers see overdue tasks, open issues and SWMS waiting for a signature. Crew see their tasks due today or late.
 */
export function NotificationBell() {
	const q = useDashboard();
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return undefined;
		const onDown = (e: MouseEvent) => {
			if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false);
				trigger.current?.focus();
			}
		};
		document.addEventListener('mousedown', onDown);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDown);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	const items: Item[] = [];
	if (q.data) {
		const d = q.data;
		if (d.scope === 'all') {
			if (d.overdueTasks) items.push({ key: 'overdue', icon: CalendarClock, text: `${plural(d.overdueTasks, 'task is', 'tasks are')} past the required finish`, to: '/tasks' });
			if (d.openIssues) items.push({ key: 'issues', icon: AlertTriangle, text: `${plural(d.openIssues, 'open issue', 'open issues')} waiting for someone`, to: '/issues' });
			if (d.swmsAwaiting) items.push({ key: 'swms', icon: FileWarning, text: `${plural(d.swmsAwaiting, 'SWMS', 'SWMS')} waiting for a signature`, to: '/swms' });
		}
		const due = d.myTasks.filter((t) => !DONE.includes(t.stage) && t.scheduled_date && t.scheduled_date.slice(0, 10) <= d.today);
		if (due.length) items.push({ key: 'mine', icon: CalendarClock, text: `${plural(due.length, 'of your tasks is', 'of your tasks are')} scheduled for today or earlier`, to: '/' });
	}
	const count = items.length;

	return (
		<div className="bell" ref={box}>
			<button
				ref={trigger}
				type="button"
				className="icon-btn"
				aria-haspopup="true"
				aria-expanded={open}
				aria-label={count ? `Notifications, ${count} need attention` : 'Notifications'}
				title="Notifications"
				onClick={() => setOpen(!open)}
			>
				<Bell size={18} aria-hidden="true" />
				{count > 0 && <span className="bell-badge num" aria-hidden="true">{count}</span>}
			</button>
			{open && (
				<div className="bell-panel" role="region" aria-label="Notifications">
					<p className="bell-title">Needs attention</p>
					{q.isPending && <p className="bell-empty" role="status">Loading…</p>}
					{q.isError && <p className="bell-empty" role="alert">Could not load notifications.</p>}
					{q.isSuccess && count === 0 && (
						<p className="bell-empty">
							<CheckCircle2 size={16} aria-hidden="true" /> You are all caught up.
						</p>
					)}
					{items.length > 0 && (
						<ul>
							{items.map((i) => (
								<li key={i.key}>
									<Link to={i.to} onClick={() => setOpen(false)}>
										<i.icon size={16} aria-hidden="true" />
										<span>{i.text}</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
