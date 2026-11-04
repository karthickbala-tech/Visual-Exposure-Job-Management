import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useHoursNotFilled, usePayPeriodHours, useWeeklyHours } from '../api/more';
import type { HourCell, HoursReport } from '../api/more';
import { Card, Kpi, PageHeader } from '../components/ui';

const COLS: { key: keyof HourCell; label: string }[] = [
	{ key: 'fab', label: 'Fab' },
	{ key: 'install', label: 'Install' },
	{ key: 'workshop', label: 'Workshop' },
	{ key: 'design', label: 'Design' },
	{ key: 'other', label: 'Other' },
	{ key: 'unbilled', label: 'Unbilled' },
];
const hrs = (n: number | undefined) => (n ? (Math.round(n * 100) / 100).toString() : '-');
const shift = (iso: string, days: number) => {
	const d = new Date(iso + 'T00:00:00Z');
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
};
const dayLabel = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

function Table({ report, perDay }: { report: HoursReport; perDay: boolean }) {
	const cols = perDay ? COLS.filter((c) => c.key === 'unbilled') : COLS; // a week shows the days; the types are in the tiles below
	const money = report.rows.some((r) => r.labourCost !== undefined);
	if (report.rows.length === 0) return <p className="table-empty">No hours were booked in this period.</p>;
	return (
		<div className="table-wrap">
			<table className="table">
				<caption className="sr-only">Hours by person</caption>
				<thead>
					<tr>
						<th scope="col">Person</th>
						{perDay && (report.days ?? []).map((d) => <th key={d} scope="col">{dayLabel(d)}</th>)}
						{cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
						{perDay && <th scope="col">Total</th>}
						{money && <th scope="col">Labour cost</th>}
					</tr>
				</thead>
				<tbody>
					{report.rows.map((r) => (
						<tr key={r.personId}>
							<td data-label="Person" className="cell-primary"><strong>{r.name || 'Person ' + r.personId}</strong></td>
							{perDay && (report.days ?? []).map((d) => <td key={d} data-label={dayLabel(d)} className="num">{hrs(r.days[d] ? sumWorked(r.days[d]) : 0)}</td>)}
							{cols.map((c) => <td key={c.key} data-label={c.label} className="num">{hrs(r.totals[c.key])}</td>)}
							{perDay && <td data-label="Total" className="num">{hrs(sumWorked(r.totals))}</td>}
							{money && <td data-label="Labour cost" className="num">{r.labourCost !== undefined ? `$${r.labourCost.toFixed(2)}` : '-'}</td>}
						</tr>
					))}
					<tr>
						<td data-label="Person" className="cell-primary"><strong>Total</strong></td>
						{perDay && (report.days ?? []).map((d) => <td key={d} data-label={dayLabel(d)} className="num">{hrs(report.rows.reduce((n, r) => n + (r.days[d] ? sumWorked(r.days[d]) : 0), 0))}</td>)}
						{cols.map((c) => <td key={c.key} data-label={c.label} className="num">{hrs(report.totals[c.key])}</td>)}
						{perDay && <td data-label="Total" className="num">{hrs(sumWorked(report.totals))}</td>}
						{money && <td data-label="Labour cost" />}
					</tr>
				</tbody>
			</table>
		</div>
	);
}
const sumWorked = (c: HourCell) => c.fab + c.install + c.workshop + c.design + c.other;

/** Hours: one week at a time (Monday to Sunday), or the pay period. Crew see their own; managers see everyone. */
export function Hours() {
	const [view, setView] = useState<'week' | 'this' | 'last'>('week');
	const [week, setWeek] = useState<string | undefined>(undefined);
	const weekly = useWeeklyHours(week);
	const period = usePayPeriodHours(view === 'last' ? 'last' : 'this', view !== 'week');
	const missing = useHoursNotFilled();
	const active = view === 'week' ? weekly : period;
	const start = weekly.data?.weekStart;

	return (
		<>
			<PageHeader eyebrow="Time" title="Hours" subtitle="Worked hours by person, taken from the post-job checklists and booked time." />

			{missing.isSuccess && missing.data.total > 0 && (
				<section className="kpis" aria-label="Hours not filled in">
					<Kpi label="Hours not filled in" value={missing.data.total} tone="danger" note={`${missing.data.workshop} workshop, ${missing.data.other} other past fab tasks`} />
				</section>
			)}

			<Card flush>
				<div className="cal-toolbar">
					<div className="segmented" role="group" aria-label="Period">
						<button className={view === 'week' ? 'on' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button>
						<button className={view === 'this' ? 'on' : ''} aria-pressed={view === 'this'} onClick={() => setView('this')}>This pay period</button>
						<button className={view === 'last' ? 'on' : ''} aria-pressed={view === 'last'} onClick={() => setView('last')}>Last pay period</button>
					</div>
					{view === 'week' && start && (
						<div className="cal-nav">
							<button className="icon-btn" aria-label="Previous week" onClick={() => setWeek(shift(start, -7))}><ChevronLeft size={18} /></button>
							<span className="cal-label">{dayLabel(start)} to {dayLabel(shift(start, 6))}</span>
							<button className="icon-btn" aria-label="Next week" onClick={() => setWeek(shift(start, 7))}><ChevronRight size={18} /></button>
						</div>
					)}
					{view !== 'week' && period.data?.period && <span className="cal-label">{period.data.period.start} to {period.data.period.end}</span>}
				</div>
				{active.isPending && <p role="status" className="table-empty">Loading hours...</p>}
				{active.isError && <p role="alert">{active.error instanceof Error ? active.error.message : 'Could not load hours.'}</p>}
				{active.isSuccess && <Table report={active.data} perDay={view === 'week'} />}
				{active.isSuccess && view === 'week' && (
					<div className="kpis" style={{ padding: '16px 20px' }}>
						{COLS.filter((c) => c.key !== 'unbilled' && (active.data.totals[c.key] ?? 0) > 0).map((c) => <Kpi key={c.key} label={c.label} value={hrs(active.data.totals[c.key])} />)}
					</div>
				)}
				{active.isSuccess && active.data.truncated && <p className="table-empty">Only the first 300 entries are shown. Choose a shorter period.</p>}
			</Card>
		</>
	);
}
