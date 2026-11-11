import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react';
import { useAddShift, useBookableTasks, useHoursNotFilled, usePayPeriodHours, useWeeklyHours } from '../api/more';
import { useToast } from '../components/toast';
import { useConfirm } from '../components/Messages';
import { Dialog } from '../components/Dialog';
import type { HourCell, HoursReport, HoursRow } from '../api/more';
import { Card, Kpi, PageHeader } from '../components/ui';
import { ListToolbarButtons } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, useGridLayout } from '../components/GridKit';
import type { GridColumn, GridLayout } from '../components/GridKit';

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

/** Widths of the columns. Every per-day column shares the `day` width, since their keys change with the period. */
const WIDTHS: Record<string, number> = { day: 120, person: 200, fab: 110, install: 110, workshop: 120, design: 110, other: 110, unbilled: 120, total: 110, labour: 140 };
const DAY_WIDTH = 120;

/** The table's columns for this period: the days (a week only), the types (a week shows only Unbilled), the total and the labour cost. */
function columnsFor(days: string[], perDay: boolean, money: boolean): GridColumn<HoursRow>[] {
	const types = perDay ? COLS.filter((c) => c.key === 'unbilled') : COLS; // a week shows the days; the types are in the tiles below
	return [
		{ key: 'person', label: 'Person', width: WIDTHS.person ?? 200, cell: (r) => <strong>{r.name || 'Person ' + r.personId}</strong> },
		...(perDay ? days.map((d): GridColumn<HoursRow> => ({ key: `day:${d}`, label: dayLabel(d), width: WIDTHS.day, widthKey: 'day', right: true, cell: (r) => hrs(r.days[d] ? sumWorked(r.days[d]) : 0) })) : []),
		...types.map((c): GridColumn<HoursRow> => ({ key: c.key, label: c.label, width: WIDTHS[c.key] ?? DAY_WIDTH, right: true, cell: (r) => hrs(r.totals[c.key]) })),
		...(perDay ? [{ key: 'total', label: 'Total', width: WIDTHS.total ?? 110, right: true, cell: (r: HoursRow) => hrs(sumWorked(r.totals)) }] : []),
		...(money ? [{ key: 'labour', label: 'Labour cost', width: WIDTHS.labour ?? 140, right: true, cell: (r: HoursRow) => (r.labourCost !== undefined ? `$${r.labourCost.toFixed(2)}` : '-') }] : []),
	];
}

/** The totals row: one cell per column, in the same order as columnsFor. */
function totalsFor(report: HoursReport, perDay: boolean, money: boolean): ReactNode[] {
	const types = perDay ? COLS.filter((c) => c.key === 'unbilled') : COLS;
	return [
		<strong key="label">Total</strong>,
		...(perDay ? (report.days ?? []).map((d) => hrs(report.rows.reduce((n, r) => n + (r.days[d] ? sumWorked(r.days[d]) : 0), 0))) : []),
		...types.map((c) => hrs(report.totals[c.key])),
		...(perDay ? [hrs(sumWorked(report.totals))] : []),
		...(money ? [''] : []),
	];
}

function Table({ report, perDay, grid }: { report: HoursReport; perDay: boolean; grid: GridLayout }) {
	const money = report.rows.some((r) => r.labourCost !== undefined);
	if (report.rows.length === 0) return <p className="table-empty">No hours were booked in this period.</p>;
	return (
		<ResizableGrid
			layout={grid}
			label="Hours by person"
			columns={columnsFor(report.days ?? [], perDay, money)}
			rows={report.rows}
			rowKey={(r) => r.personId}
			footer={totalsFor(report, perDay, money)}
		/>
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
	const confirm = useConfirm();
	const add = useAddShift();
	const { notify } = useToast();
	const [f, setF] = useState({ taskId: '', date: todayIso(), hours: '', unbilled: '', start: '', end: '', brk: '' });
	const h = Number(f.hours);
	const u = f.unbilled ? Number(f.unbilled) : 0;
	// A start and end time replace the hours box; the server splits them into single, time and a half, and double.
	const byTimes = !!f.start && !!f.end;
	const timesProblem = !!f.start !== !!f.end ? 'Give both the start and the end time.' : byTimes && f.end <= f.start ? 'The end time must be after the start time.' : '';
	const problem = !f.hours ? '' : h < 0.25 ? 'Enter at least 0.25 hours.' : h > 16 ? 'A shift cannot be longer than 16 hours.' : u > h ? 'Unbilled hours cannot be more than the hours worked.' : f.date > todayIso() ? 'Choose a day that has already happened.' : '';
	return (
		<Dialog title="Add shift" onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={async (e) => {
				e.preventDefault();
				if (!byTimes && h > 14 && !(await confirm({ message: `${h} hours is a very long shift. Save it anyway?`, confirmLabel: 'Save shift' }))) return;
				add.mutate(
					{ taskId: f.taskId, work_date: f.date, ...(byTimes ? { start_time: f.start, end_time: f.end, break_minutes: f.brk ? Number(f.brk) : undefined } : { hours: h }), unbilled_hours: u || undefined },
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
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Hours{byTimes ? '' : ' *'}</span><input type="number" step="0.25" min="0.25" max="16" value={f.hours} required={!byTimes} disabled={byTimes} onChange={(e) => setF({ ...f, hours: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Unbilled</span><input type="number" step="0.25" min="0" value={f.unbilled} onChange={(e) => setF({ ...f, unbilled: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Start Time</span><input type="time" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">End Time</span><input type="time" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
			<label style={{ flex: '0 1 110px' }}><span className="toolbar__label">Break Minutes</span><input type="number" min="0" max="600" step="5" value={f.brk} onChange={(e) => setF({ ...f, brk: e.target.value })} /></label>
			<button className="btn" disabled={add.isPending || !f.taskId || (!f.hours && !byTimes) || !!problem || !!timesProblem}>{add.isPending ? 'Saving…' : 'Add shift'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
			{(problem || timesProblem) && <p role="alert">{problem || timesProblem}</p>}
		</form>
		</Dialog>
	);
}

/** Hours: one week at a time (Monday to Sunday), or the pay period. Crew see their own; managers see everyone. */
export function Hours() {
	const [view, setView] = useState<'week' | 'eight' | 'this' | 'last'>('week');
	const [adding, setAdding] = useState(false);
	const [week, setWeek] = useState<string | undefined>(undefined);
	const grid = useGridLayout('ve.grid.hours', WIDTHS);
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
				<ListToolbarButtons
					viewOptions={(
						<>
							<p className="filter-pop__title">Row height</p>
							<RowHeightPicker value={grid.rows} onChange={grid.setRows} />
							<div className="filter-pop__actions">
								<button type="button" className="btn btn-ghost btn-sm" onClick={grid.reset}>Reset widths</button>
							</div>
						</>
					)}
				/>
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
				{active.isSuccess && <Table report={active.data} perDay={perDay} grid={grid} />}
				{active.isSuccess && perDay && (
					<div className="kpis" style={{ padding: '16px 20px' }}>
						{COLS.filter((c) => c.key !== 'unbilled' && (active.data.totals[c.key] ?? 0) > 0).map((c) => <Kpi key={c.key} label={c.label} value={hrs(active.data.totals[c.key])} />)}
					</div>
				)}
				{active.isSuccess && active.data.truncated && <p className="table-empty">Only the first 300 entries are shown. Choose a shorter period.</p>}
			</Card>
			{active.isSuccess && <GridStatusBar text={`Showing ${active.data.rows.length} of ${active.data.rows.length}`} />}
		</>
	);
}
