import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCreateWorkshopTask, useTaskBoard } from '../api/more';
import { useMe } from '../api/queries';
import { useToast } from '../components/toast';
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
	const me = useMe();
	const make = useCreateWorkshopTask();
	const { notify } = useToast();
	const [adding, setAdding] = useState(false);
	const [f, setF] = useState({ name: '', scheduled_date: '', every: '', unit: 'weeks' });

	return (
		<>
			<PageHeader eyebrow="Work" title="Task board" subtitle="Every open task by stage. Overdue tasks are marked.">
				<div className="segmented" role="group" aria-label="Task type">
					{TYPES.map((t) => (
						<button key={t.key} className={type === t.key ? 'on' : ''} aria-pressed={type === t.key} onClick={() => setType(t.key)}>{t.label}</button>
					))}
				</div>
			</PageHeader>

			{me.data?.permissions.createTask && type === 'fabrication' && (
				<Card flush>
					{!adding ? (
						<div className="card-body"><button className="btn btn-ghost" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> New workshop task</button></div>
					) : (
						<form
							className="inline-form"
							onSubmit={(e) => {
								e.preventDefault();
								make.mutate(
									{ name: f.name.trim(), scheduled_date: f.scheduled_date || undefined, repeat: f.every ? { every: Number(f.every), unit: f.unit } : undefined },
									{ onSuccess: () => { setAdding(false); setF({ name: '', scheduled_date: '', every: '', unit: 'weeks' }); notify('Workshop task created'); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not create the task', 'error') },
								);
							}}
						>
							<label style={{ flex: '2 1 260px' }}><span className="toolbar__label">Workshop task</span><input value={f.name} required maxLength={200} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Clean the router bed…" /></label>
							<label><span className="toolbar__label">Scheduled</span><input type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></label>
							<label style={{ flex: '0 1 120px' }}><span className="toolbar__label">Repeat every</span><input type="number" min={1} max={52} inputMode="numeric" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} placeholder="never" /></label>
							<label style={{ flex: '0 1 130px' }}><span className="toolbar__label">Unit</span><select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option>days</option><option>weeks</option><option>months</option></select></label>
							<button className="btn" disabled={make.isPending || !f.name.trim()}>{make.isPending ? 'Saving…' : 'Create'}</button>
							<button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
						</form>
					)}
				</Card>
			)}

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
