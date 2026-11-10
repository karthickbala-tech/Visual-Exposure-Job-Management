import { useTaskHistory } from '../api/more';
import { Card } from './ui';

/** Who moved this task between stages, when, and why (the reason shows for rejects, reopens and holds). */
export function TaskHistory({ taskId }: { taskId: string }) {
	const q = useTaskHistory(taskId);
	return (
		<Card title="History">
			{q.isPending && <p role="status" className="muted">Loading history…</p>}
			{q.isError && <p role="alert">Could not load the history.</p>}
			{q.isSuccess && q.data.items.length === 0 && <p className="muted">No stage changes yet.</p>}
			{q.isSuccess && q.data.items.length > 0 && (
				<ul className="plain-list">
					{q.data.items.map((h, i) => (
						<li key={i}>
							<small>{h.at?.replace('T', ' ').slice(0, 16) ?? ''}</small> <strong>{h.from ?? 'New'}</strong> to <strong>{h.to ?? '-'}</strong>
							{h.by && <> by {h.by}</>}
							{h.comment && <small className="sub"> “{h.comment}”</small>}
						</li>
					))}
				</ul>
			)}
		</Card>
	);
}
