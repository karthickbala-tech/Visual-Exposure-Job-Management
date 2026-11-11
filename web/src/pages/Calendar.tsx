import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendar } from '../api/queries';
import type { CalendarItem } from '../api/types';
import { Chip } from '../components/Chip';
import { Card, PageHeader } from '../components/ui';

const DAY = 86400000;
const MAX_PER_CELL = 3;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (s: string) => new Date(s + 'T00:00:00Z');
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
/** Monday of the week containing `d`. Only whole days matter, so UTC date maths is exact. */
const monday = (d: Date) => addDays(d, -((d.getUTCDay() + 6) % 7));
const today = () => iso(new Date());
const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString('en-AU', { ...o, timeZone: 'UTC' });
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TYPE_NAME = { design: 'Design', fabrication: 'Fabrication', install: 'Install' } as const;

type View = 'month' | 'week' | 'timeline';
const TIMELINE_DAYS = 28;

/** Scheduled work as a month or week grid (an agenda list on phones). The server limits it to what you may see. */
export function Calendar() {
	const [view, setView] = useState<View>('month');
	const [anchor, setAnchor] = useState(() => today());
	const a = utc(anchor);

	const first = view === 'month' ? monday(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1))) : monday(a);
	const count = view === 'month' ? 42 : view === 'week' ? 7 : TIMELINE_DAYS;
	const days = Array.from({ length: count }, (_, i) => addDays(first, i));
	const q = useCalendar(iso(days[0]), iso(days[count - 1]));

	const byDay = new Map<string, CalendarItem[]>();
	for (const item of q.data?.items ?? []) byDay.set(item.scheduled_date, [...(byDay.get(item.scheduled_date) ?? []), item]);

	const step = (dir: -1 | 1) => {
		if (view === 'week') setAnchor(iso(addDays(a, dir * 7)));
		else if (view === 'timeline') setAnchor(iso(addDays(a, dir * TIMELINE_DAYS)));
		else setAnchor(iso(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir, 1))));
	};
	const label = view === 'month' ? fmt(a, { month: 'long', year: 'numeric' }) : `${fmt(days[0], { day: 'numeric', month: 'short' })} to ${fmt(days[count - 1], { day: 'numeric', month: 'short', year: 'numeric' })}`;
	const unitLabel = view === 'month' ? 'month' : view === 'week' ? 'week' : 'four weeks';
	// Timeline: fabrication work only (the Creator "Fabrication WIP" report). A bar runs from the scheduled day to the required finish, cut to the window.
	const bars = (q.data?.items ?? [])
		.filter((t) => t.task_type === 'fabrication')
		.map((t) => {
			const startDay = t.scheduled_date.slice(0, 10);
			const finishDay = t.required_finish ? t.required_finish.slice(0, 10) : startDay;
			const start = Math.max(0, Math.round((utc(startDay).getTime() - days[0].getTime()) / DAY));
			const end = Math.min(count - 1, Math.max(start, Math.round((utc(finishDay).getTime() - days[0].getTime()) / DAY)));
			return { t, start, end, late: finishDay < today() && !['Completed', 'Closed', 'Cancelled'].includes(t.stage) };
		});
	const inMonth = (d: Date) => view === 'week' || d.getUTCMonth() === a.getUTCMonth();
	const now = today();
	const agendaDays = days.filter((d) => inMonth(d) && (byDay.get(iso(d))?.length ?? 0) > 0);

	return (
		<>
			<PageHeader eyebrow="Schedule" title="Calendar" subtitle="Design, fabrication and install tasks by day." />

			<Card flush>
				<div className="cal-toolbar">
					<div className="cal-nav">
						<button className="icon-btn" aria-label={'Previous ' + unitLabel} onClick={() => step(-1)}>
							<ChevronLeft size={18} />
						</button>
						<button className="btn btn-ghost btn-sm" onClick={() => setAnchor(today())}>
							Today
						</button>
						<button className="icon-btn" aria-label={'Next ' + unitLabel} onClick={() => step(1)}>
							<ChevronRight size={18} />
						</button>
						<h2 className="cal-label">{label}</h2>
					</div>
					<div className="segmented" role="group" aria-label="Calendar view">
						{(['month', 'week', 'timeline'] as const).map((v) => (
							<button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
								{v}
							</button>
						))}
					</div>
				</div>

				{q.isPending && <p role="status" className="table-empty">Loading…</p>}
				{q.isError && <p role="alert">Could not load the calendar.</p>}

				{q.isSuccess && (
					view === 'timeline' ? (
						<div className="tl" role="table" aria-label={'Fabrication timeline, ' + label}>
							<div className="tl-head" role="row">
								<span role="columnheader">Task</span>
								<div className="tl-days" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
									{days.map((d) => (
										<span key={iso(d)} className={'tl-day' + (iso(d) === now ? ' today' : '')} title={fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}>
											{d.getUTCDate()}
										</span>
									))}
								</div>
							</div>
							{bars.length === 0 && <p className="table-empty">No fabrication work scheduled in these four weeks.</p>}
							{bars.map(({ t, start, end, late }) => (
								<div key={t.ROWID} className="tl-row" role="row">
									<Link className="tl-name" to={'/tasks/' + t.ROWID} title={`${t.name} (${t.stage})`}>
										{t.name}
									</Link>
									<div className="tl-track" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
										<Link
											className={'tl-bar' + (late ? ' late' : '')}
											style={{ gridColumn: `${start + 1} / ${end + 2}` }}
											to={'/tasks/' + t.ROWID}
											aria-label={`${t.name}, ${t.stage}${late ? ', past its required finish' : ''}`}
										>
											{t.stage}
										</Link>
									</div>
								</div>
							))}
						</div>
					) : (
					<>
						<div className={'cal-grid' + (view === 'week' ? ' cal-week' : '')} role="grid" aria-label={label}>
							{DOW.map((d) => (
								<div key={d} className="cal-dow" role="columnheader">
									{d}
								</div>
							))}
							{days.map((d) => {
								const items = byDay.get(iso(d)) ?? [];
								const shown = view === 'month' ? items.slice(0, MAX_PER_CELL) : items;
								return (
									<div key={iso(d)} className={'cal-cell' + (inMonth(d) ? '' : ' outside')} role="gridcell">
										<span className={'cal-num' + (iso(d) === now ? ' today' : '')} aria-label={fmt(d, { day: 'numeric', month: 'long' })}>
											{d.getUTCDate()}
										</span>
										{shown.map((t) => (
											<Link key={t.ROWID} className="cal-ev" to={'/tasks/' + t.ROWID} title={`${t.name} (${TYPE_NAME[t.task_type]}, ${t.stage})`}>
												<i className={'dot dot-' + t.task_type} aria-hidden="true" />
												<span>{t.name}</span>
											</Link>
										))}
										{view === 'month' && items.length > MAX_PER_CELL && <span className="cal-more">+{items.length - MAX_PER_CELL} more</span>}
									</div>
								);
							})}
						</div>

						<div className="cal-agenda">
							{agendaDays.length === 0 && <p className="table-empty">Nothing scheduled in this {view}.</p>}
							{agendaDays.map((d) => (
								<div key={iso(d)} className="agenda-day">
									<h3 className={iso(d) === now ? 'today' : ''}>{fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
									{(byDay.get(iso(d)) ?? []).map((t) => (
										<Link key={t.ROWID} className="agenda-ev" to={'/tasks/' + t.ROWID}>
											<i className={'dot dot-' + t.task_type} aria-hidden="true" />
											{t.name}
											<small>{TYPE_NAME[t.task_type]}</small>
											<Chip status={t.stage} />
										</Link>
									))}
								</div>
							))}
						</div>

						<div className="cal-legend">
							{(['design', 'fabrication', 'install'] as const).map((t) => (
								<span key={t}>
									<i className={'dot dot-' + t} aria-hidden="true" /> {TYPE_NAME[t]}
								</span>
							))}
						</div>
					</>
					)
				)}
			</Card>
		</>
	);
}
