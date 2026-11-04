import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTaskBoard } from '../api/more';
import { Card, PageHeader, fmtDate } from '../components/ui';

const TYPES = [
	{ key: 'design', label: 'Design' },
	{ key: 'fabrication', label: 'Fabrication' },
	{ key: 'install', label: 'Install' },
];

/** One column per stage, with how many tasks and how many are overdue. Crew see only their own tasks (the server decides). */
export function TaskBoard() {
	const [type, setType] = useState('fabrication');
	const q = useTaskBoard(type);

	return (
		<>
			<PageHeader eyebrow="Work" title="Task board" subtitle="Every open task by stage. Overdue tasks are marked.">
				<div className="segmented" role="group" aria-label="Task type">
					{TYPES.map((t) => (
						<button key={t.key} className={type === t.key ? 'on' : ''} aria-pressed={type === t.key} onClick={() => setType(t.key)}>{t.label}</button>
					))}
				</div>
			</PageHeader>

			{q.isPending && <p role="status">Loading the board…</p>}
			{q.isError && <p role="alert">Could not load the board.</p>}
			{q.isSuccess && (
				<div className="board" role="list" aria-label={`${type} tasks by stage`}>
					{q.data.columns.map((col) => (
						<section key={col.stage} className="board-col" role="listitem" aria-label={col.stage}>
							<header className="board-head">
								<h2>{col.stage}</h2>
								<span className="num">{col.count}</span>
								{col.overdueCount > 0 && <span className="chip chip-red">{col.overdueCount} overdue</span>}
							</header>
							<div className="board-cards">
								{col.items.length === 0 && <p className="board-empty">Nothing here</p>}
								{col.items.map((t) => (
									<Link key={t.ROWID} to={'/tasks/' + t.ROWID} className={'board-card' + (t.overdue ? ' overdue' : '')}>
										<strong>{t.name}</strong>
										<small>{[t.kind, t.scheduled_date && `Scheduled ${fmtDate(t.scheduled_date)}`, t.required_finish && `Due ${fmtDate(t.required_finish)}`].filter(Boolean).join(' · ') || ' '}</small>
									</Link>
								))}
							</div>
						</section>
					))}
				</div>
			)}
			{q.isSuccess && q.data.truncated && <Card><p className="muted">Only the first 300 tasks are shown.</p></Card>}
		</>
	);
}
