import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { useAddShift, useBookableTasks, useHoursNotFilled, usePayPeriodHours, useWeeklyHours } from '../api/more';
import { useToast } from '../components/toast';
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
const todayIso = () => new Date().toISOString().slice(0, 10);

/** CSV with one line per person: the days (when shown), the types, and the total. Cells that start like a formula are neutralised. */
function downloadCsv(report: HoursReport, name: string) {
	const cell = (v: string | number) => {
		let t = String(v);
		if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;
		return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
	};
	const days = report.days ?? [];
	const head = ['Person', ...days, ...COLS.map((c) => c.label), 'Total worked'];
	const lines = report.rows.map((r) => [r.name || r.personId, ...days.map((d) => (r.days[d] ? sumWorked(r.days[d]) : 0)), ...COLS.map((c) => r.totals[c.key] ?? 0), sumWorked(r.totals)]);
	const csv = [head, ...lines].map((l) => l.map(cell).join(',')).join('\r\n');
	const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	a.click();
	URL.revokeObjectURL(url);
}

/** Add a past shift: a task, a day, hours. Over 14 hours asks to confirm; over 16 is refused (the server enforces it too). */
function ShiftForm({ onClose }: { onClose: () => void }) {
	const tasks = useBookableTasks(true);
	const add = useAddShift();
	const { notify } = useToast();
	const [f, setF] = useState({ taskId: '', date: todayIso(), hours: '', unbilled: '' });
	const h = Number(f.hours);
	const u = f.unbilled ? Number(f.unbilled) : 0;
	const problem = !f.hours ? '' : h < 0.25 ? 'Enter at least 0.25 hours.' : h > 16 ? 'A shift cannot be longer than 16 hours.' : u > h ? 'Unbilled hours cannot be more than the hours worked.' : f.date > todayIso() ? 'Choose a day that has already happened.' : '';
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				if (h > 14 && !window.confirm(`${h} hours is a very long shift. Save it anyway?`)) return;
				add.mutate(
					{ taskId: f.taskId, work_date: f.date, hours: h, unbilled_hours: u || undefined },
					{ onSuccess: () => { notify('Shift added'); onClose(); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not add the shift', 'error') },
				);
			}}
		>
			<label style={{ flex: '2 1 260px' }}>
				<span className="toolbar__label">Task *</span>
				<select value={f.taskId} required onChange={(e) => setF({ ...f, taskId: e.target.value })}>
					<option value="">{tasks.isPending ? 'Loading…' : 'Choose a task…'}</option>
					{(tasks.data?.items ?? []).filter((t) => !['Completed', 'Approved & Completed', 'Complete - Not Used', 'Cancelled'].includes(t.stage)).map((t) => <option key={t.ROWID} value={t.ROWID}>{(t.job_name ? t.job_name + ': ' : '') + t.name}</option>)}
				</select>
			</label>
			<label style={{ flex: '0 1 160px' }}><span className="toolbar__label">Day *</span><input type="date" max={todayIso()} value={f.date} required onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Hours *</span><input type="number" step="0.25" min="0.25" max="16" value={f.hours} required onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Unbilled</span><input type="number" step="0.25" min="0" value={f.unbilled} onChange={(e) => setF({ ...f, unbilled: e.target.value })} /></label>
			<button className="btn" disabled={add.isPending || !f.taskId || !f.hours || !!problem}>{add.isPending ? 'Saving…' : 'Add shift'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{problem && <p role="alert">{problem}</p>}
		</form>
	);
}

/** Hours: one week at a time (Monday to Sunday), or the pay period. Crew see their own; managers see everyone. */
export function Hours() {
	const [view, setView] = useState<'week' | 'eight' | 'this' | 'last'>('week');
	const [adding, setAdding] = useState(false);
	const [week, setWeek] = useState<string | undefined>(undefined);
	const eight = useMemo(() => ({ from: shift(todayIso(), -7), to: todayIso() }), []);
	const weekly = useWeeklyHours(view === 'eight' ? undefined : week, view === 'eight' ? eight : undefined);
	const period = usePayPeriodHours(view === 'last' ? 'last' : 'this', view === 'this' || view === 'last');
	const missing = useHoursNotFilled();
	const active = view === 'week' || view === 'eight' ? weekly : period;
	const perDay = view === 'week' || view === 'eight';
	const start = weekly.data?.weekStart;

	return (
		<>
			<PageHeader eyebrow="Time" title="Hours" subtitle="Worked hours by person, taken from the post-job checklists and booked time.">
				{!adding && <button className="btn" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add a past shift</button>}
			</PageHeader>

			{missing.isSuccess && missing.data.total > 0 && (
				<section className="kpis" aria-label="Hours not filled in">
					<Kpi label="Hours not filled in" value={missing.data.total} tone="danger" note={`${missing.data.workshop} workshop, ${missing.data.other} other past fab tasks`} />
				</section>
			)}

			<Card flush>
				{adding && <ShiftForm onClose={() => setAdding(false)} />}
				<div className="cal-toolbar">
					<div className="segmented" role="group" aria-label="Period">
						<button className={view === 'week' ? 'on' : ''} aria-pressed={view === 'week'} onClick={() => setView('week')}>Week</button>
						<button className={view === 'eight' ? 'on' : ''} aria-pressed={view === 'eight'} onClick={() => setView('eight')}>Last 8 days</button>
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
					{view === 'eight' && <span className="cal-label">{dayLabel(eight.from)} to {dayLabel(eight.to)}</span>}
					{(view === 'this' || view === 'last') && period.data?.period && <span className="cal-label">{period.data.period.start} to {period.data.period.end}</span>}
					{active.isSuccess && active.data.rows.length > 0 && (
						<button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => downloadCsv(active.data, `hours-${view === 'week' ? start ?? 'week' : view}.csv`)}><Download size={14} aria-hidden="true" /> CSV</button>
					)}
				</div>
				{active.isPending && <p role="status" className="table-empty">Loading hours…</p>}
				{active.isError && <p role="alert">{active.error instanceof Error ? active.error.message : 'Could not load hours.'}</p>}
				{active.isSuccess && <Table report={active.data} perDay={perDay} />}
				{active.isSuccess && perDay && (
					<div className="kpis" style={{ padding: '16px 20px' }}>
						{COLS.filter((c) => c.key !== 'unbilled' && (active.data.totals[c.key] ?? 0) > 0).map((c) => <Kpi key={c.key} label={c.label} value={hrs(active.data.totals[c.key])} />)}
					</div>
				)}
				{active.isSuccess && active.data.truncated && <p className="table-empty">Only the first 300 entries are shown. Choose a shorter period.</p>}
			</Card>
		</>
	);
}
