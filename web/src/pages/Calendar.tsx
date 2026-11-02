import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCalendar } from '../api/queries';
import type { CalendarItem } from '../api/types';
import { Chip } from '../components/Chip';
import './Table.css';
import './Calendar.css';

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
/** Monday of the week containing `d` (UTC date maths: only whole days matter here). */
const monday = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));
const thisWeek = () => monday(new Date(iso(new Date())));
const label = (d: Date) => d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A week of scheduled work, grouped by day. Rows are scoped on the server to what you may see. */
export function Calendar() {
	const [start, setStart] = useState(thisWeek);
	const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
	const q = useCalendar(iso(days[0]), iso(days[6]));

	const byDay = new Map<string, CalendarItem[]>();
	for (const item of q.data?.items ?? []) byDay.set(item.scheduled_date, [...(byDay.get(item.scheduled_date) ?? []), item]);
	const today = iso(new Date());

	return (
		<>
			<h1 className="page-title">Calendar</h1>
			<div className="actions cal__nav">
				<button className="btn btn-ghost" onClick={() => setStart(addDays(start, -7))}>
					&larr; Previous week
				</button>
				<button className="btn btn-ghost" onClick={() => setStart(thisWeek())}>
					This week
				</button>
				<button className="btn btn-ghost" onClick={() => setStart(addDays(start, 7))}>
					Next week &rarr;
				</button>
			</div>
			<p className="q__hint">Week of {label(days[0])}</p>

			{q.isPending && <p role="status">Loading...</p>}
			{q.isError && <p role="alert">Could not load the calendar.</p>}
			{q.isSuccess && (
				<ol className="cal">
					{days.map((d) => {
						const items = byDay.get(iso(d)) ?? [];
						return (
							<li key={iso(d)} className="cal__day" data-today={iso(d) === today}>
								<h2 className="cal__title">{label(d)}</h2>
								{items.length === 0 ? (
									<p className="q__hint">Nothing scheduled</p>
								) : (
									<ul className="plain-list">
										{items.map((t) => (
											<li key={t.ROWID} className="cal__item" data-type={t.task_type}>
												<Link to={'/tasks/' + t.ROWID}>{t.name}</Link> <span className="q__hint">{t.task_type}</span> <Chip status={t.stage} />
											</li>
										))}
									</ul>
								)}
							</li>
						);
					})}
				</ol>
			)}
		</>
	);
}
