import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { useTodo } from '../api/more';
import { Card, EmptyState } from './ui';

const SHOWN = 5;

/** What needs a person today, most urgent first, each with one button to the right screen. Managers only (one request, cached by the server). */
export function ToDoList() {
	const q = useTodo();
	const [all, setAll] = useState(false);
	if (q.isPending) return <p role="status">Loading your to-do list…</p>;
	if (q.isError) return null; // the rest of the dashboard still works
	const { items, total } = q.data;
	const shown = all ? items : items.slice(0, SHOWN);
	return (
		<Card title="To do now" action={total > 0 ? <span className="todo-count num" aria-label={`${total} items`}>{total}</span> : undefined} flush>
			{total === 0 ? (
				<EmptyState icon={CheckCircle2} title="All caught up" description="Nothing needs you right now." />
			) : (
				<ul className="todo-list">
					{shown.map((i) => (
						<li key={i.id} className="todo-item">
							<span className={'todo-dot todo-' + i.tone} aria-hidden="true" />
							<span className="todo-text">
								<strong>{i.title}</strong>
								{i.detail && <small>{i.detail}</small>}
							</span>
							<Link className="btn btn-ghost btn-sm" to={i.to}>
								{i.action}
							</Link>
						</li>
					))}
				</ul>
			)}
			{total > SHOWN && (
				<button type="button" className="todo-more" aria-expanded={all} onClick={() => setAll(!all)}>
					{all ? 'Show fewer' : `Show all ${total}`} <ChevronDown size={14} aria-hidden="true" style={{ transform: all ? 'rotate(180deg)' : undefined }} />
				</button>
			)}
		</Card>
	);
}
