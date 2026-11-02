import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Coffee, LogIn, LogOut, Plus, Timer, Wallet } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { addDays, formatShort, startOfWeek, toKey, today } from '../lib/dates';
import { calcPay, fmtH } from '../lib/payRules';
import { shortName } from '../lib/people';
import './HoursPage.css';

const VIEW_ALL = ['pm', 'fabManager', 'ic2'];
const PERIODS = [
  ['week', 'This week'],
  ['last', 'Last week'],
  ['days8', 'Last 8 days'],
];
const KIND = { install: 'Install', fab: 'Fab', workshop: 'Workshop' };
const sum = (list, f) => Math.round(list.reduce((n, x) => n + f(x), 0) * 100) / 100;

function rangeFor(period) {
  const t = today();
  if (period === 'last') { const s = addDays(startOfWeek(t), -7); return [toKey(s), toKey(addDays(s, 6))]; }
  if (period === 'days8') return [toKey(addDays(t, -8)), toKey(t)];
  return [toKey(startOfWeek(t)), toKey(addDays(startOfWeek(t), 6))];
}

function BookedHours({ viewAll, me }) {
  const { hoursLog } = useDemo();
  const [period, setPeriod] = useState('week');
  const [worker, setWorker] = useState('all');
  const [from, to] = rangeFor(period);

  const inRange = hoursLog.filter((h) => h.date >= from && h.date <= to && (viewAll ? (worker === 'all' || h.worker === worker) : h.worker === me));
  const workers = [...new Set(hoursLog.map((h) => h.worker))].sort();
  const byWorker = useMemo(() => {
    const map = {};
    inRange.forEach((h) => { (map[h.worker] = map[h.worker] || []).push(h); });
    return Object.entries(map).map(([name, list]) => {
      const total = sum(list, (x) => x.hours);
      const unbilled = sum(list, (x) => x.unbilled);
      return { id: name, name, install: sum(list.filter((x) => x.kind === 'install'), (x) => x.hours), fab: sum(list.filter((x) => x.kind === 'fab'), (x) => x.hours),
        workshop: sum(list.filter((x) => x.kind === 'workshop'), (x) => x.hours), total, unbilled, billed: Math.round((total - unbilled) * 100) / 100 };
    }).sort((a, b) => b.total - a.total);
  }, [inRange]);

  const total = sum(inRange, (x) => x.hours);
  const unbilled = sum(inRange, (x) => x.unbilled);

  const cols = [
    { key: 'name', label: 'Worker', primary: true, render: (r) => <strong>{r.name}</strong> },
    { key: 'install', label: 'Install', render: (r) => fmtH(r.install) },
    { key: 'fab', label: 'Fab', render: (r) => fmtH(r.fab) },
    { key: 'workshop', label: 'Workshop', render: (r) => fmtH(r.workshop) },
    { key: 'total', label: 'Total work hours', render: (r) => <strong>{fmtH(r.total)}</strong> },
    { key: 'unbilled', label: 'Unbilled', render: (r) => <span className={r.unbilled ? 'over' : ''}>{fmtH(r.unbilled)}</span> },
    { key: 'billed', label: 'Billed', render: (r) => fmtH(r.billed) },
  ];
  const entryCols = [
    { key: 'date', label: 'Date', primary: true, render: (h) => formatShort(h.date) },
    ...(viewAll ? [{ key: 'worker', label: 'Worker' }] : []),
    { key: 'job', label: 'Job', render: (h) => <Link className="job-link" to={`/jobs/${h.jobId}`}>{h.jobId}</Link> },
    { key: 'kind', label: 'Type', render: (h) => KIND[h.kind] },
    { key: 'hours', label: 'Hours', render: (h) => fmtH(h.hours) },
    { key: 'unbilled', label: 'Unbilled', render: (h) => (h.unbilled ? fmtH(h.unbilled) : '-') },
  ];

  return (
    <>
      <div className="kpis">
        <KpiCard icon={Clock} label="Total work hours" value={fmtH(total)} note={`${formatShort(from)} to ${formatShort(to)}`} />
        <KpiCard icon={Wallet} label="Billed hours" value={fmtH(Math.round((total - unbilled) * 100) / 100)} note="charged to jobs" />
        <KpiCard icon={Timer} label="Unbilled hours" value={fmtH(unbilled)} tone={unbilled ? 'warn' : 'brand'} note="not charged to a job" />
        <KpiCard icon={Clock} label={viewAll ? 'Workers who booked' : 'Days worked'} value={viewAll ? byWorker.length : new Set(inRange.map((h) => h.date)).size} note="in this period" />
      </div>
      <div className="hp-tools">
        <div className="segmented" role="tablist" aria-label="Period">
          {PERIODS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={period === id} className={period === id ? 'on' : ''} onClick={() => setPeriod(id)}>{label}</button>)}
        </div>
        {viewAll && (
          <select value={worker} onChange={(e) => setWorker(e.target.value)} aria-label="Worker">
            <option value="all">All workers</option>{workers.map((w) => <option key={w}>{w}</option>)}
          </select>)}
      </div>
      {viewAll && <Card title="Hours by worker" flush><ResponsiveTable columns={cols} rows={byWorker} empty="No hours booked in this period" /></Card>}
      <div style={{ height: 16 }} />
      <Card title="Entries" flush><ResponsiveTable columns={entryCols} rows={[...inRange].sort((a, b) => b.date.localeCompare(a.date))} empty="No hours booked in this period" /></Card>
      <p className="muted pad">Hours are added when a worker books them on a task, and later come from the post-job checklist.</p>
    </>
  );
}

function ShiftModal({ onClose }) {
  const { addTimesheet } = useDemo();
  const [f, setF] = useState({ date: toKey(today()), start: '07:00', end: '15:30', breakMins: '30', notes: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const pay = calcPay({ date: f.date, start: f.start, end: f.end, breakMins: Number(f.breakMins) || 0 });

  const submit = (e) => {
    e.preventDefault();
    if (!f.date || !f.start || !f.end) return setError('Date, start and end are required.');
    if (!pay) return setError('End time must be after start time. Overnight shifts are not supported in this demo.');
    if (f.date > toKey(today())) return setError('You cannot add a shift in the future.');
    addTimesheet({ date: f.date, start: f.start, end: f.end, breakMins: Number(f.breakMins) || 0, notes: f.notes.trim() });
    return onClose();
  };

  return (
    <Modal title="Add a past shift" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Date<input type="date" max={toKey(today())} value={f.date} onChange={set('date')} /></label>
        <div className="form-row">
          <label>Start<input type="time" value={f.start} onChange={set('start')} /></label>
          <label>End<input type="time" value={f.end} onChange={set('end')} /></label>
        </div>
        <label>Break minutes<input type="number" min="0" step="5" value={f.breakMins} onChange={set('breakMins')} /></label>
        <label>Work notes<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
        <div className="pay-preview" aria-live="polite">
          {pay ? <><span>Single <b>{fmtH(pay.single)}</b></span><span>Time and a half <b>{fmtH(pay.half)}</b></span><span>Double <b>{fmtH(pay.double)}</b></span><span>Total <b>{fmtH(pay.total)}</b></span></>
            : <span>Enter a start and end time to see the pay split.</span>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Add shift</button>
        </div>
      </form>
    </Modal>
  );
}

function Timesheet({ viewAll, me }) {
  const { timesheets, checkIn, startBreak, endBreak, checkOut } = useDemo();
  const [adding, setAdding] = useState(false);
  const [notes, setNotes] = useState('');
  const [from] = rangeFor('week');

  const mine = timesheets.filter((t) => t.worker === me);
  const active = mine.find((t) => t.status !== 'Checked-out');
  const rows = (viewAll ? timesheets : mine).slice().sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const week = mine.filter((t) => t.date >= from && t.status === 'Checked-out');

  const cols = [
    { key: 'date', label: 'Date', primary: true, render: (t) => formatShort(t.date) },
    ...(viewAll ? [{ key: 'worker', label: 'Worker' }] : []),
    { key: 'start', label: 'Start' },
    { key: 'end', label: 'End', render: (t) => t.end || '-' },
    { key: 'breakMins', label: 'Break', render: (t) => `${t.breakMins} min` },
    { key: 'single', label: 'Single', render: (t) => fmtH(t.single) },
    { key: 'half', label: 'Time and a half', render: (t) => fmtH(t.half) },
    { key: 'double', label: 'Double', render: (t) => fmtH(t.double) },
    { key: 'total', label: 'Total', render: (t) => <strong>{fmtH(t.total)}</strong> },
    { key: 'status', label: 'Status', render: (t) => <Chip value={t.status} tone={t.status === 'Checked-out' ? 'gray' : t.status === 'On Break' ? 'amber' : 'green'} /> },
    { key: 'notes', label: 'Notes', render: (t) => t.notes || '-' },
  ];

  return (
    <>
      <div className={`clock ${active?.status === 'On Break' ? 'break' : ''}`}>
        <div className="stack">
          {!active && <><strong>You are not checked in</strong><small>Check in when you start work. Your hours are split into single, time and a half and double automatically.</small></>}
          {active?.status === 'Checked-in' && <><strong>Checked in at {active.start}</strong><small>Break so far: {active.breakMins} min</small></>}
          {active?.status === 'On Break' && <><strong>On break</strong><small>Started work at {active.start}</small></>}
        </div>
        {!active && <button type="button" className="btn btn-primary" onClick={checkIn}><LogIn size={16} aria-hidden="true" /> Check in</button>}
        {active?.status === 'Checked-in' && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => startBreak(active.id)}><Coffee size={16} aria-hidden="true" /> Start break</button>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work notes (optional)" aria-label="Work notes" />
            <button type="button" className="btn btn-primary" onClick={() => { checkOut(active.id, notes.trim()); setNotes(''); }}><LogOut size={16} aria-hidden="true" /> Check out</button>
          </>)}
        {active?.status === 'On Break' && <button type="button" className="btn btn-primary" onClick={() => endBreak(active.id)}><Coffee size={16} aria-hidden="true" /> End break</button>}
      </div>

      <div className="kpis">
        <KpiCard icon={Clock} label="My hours this week" value={fmtH(sum(week, (t) => t.total))} note={`${week.length} shifts`} />
        <KpiCard icon={Timer} label="Single time" value={fmtH(sum(week, (t) => t.single))} note="this week" />
        <KpiCard icon={Timer} label="Time and a half" value={fmtH(sum(week, (t) => t.half))} note="this week" />
        <KpiCard icon={Timer} label="Double time" value={fmtH(sum(week, (t) => t.double))} tone="warn" note="this week" />
      </div>

      <Card title={viewAll ? 'All staff timesheets' : 'My timesheet'} flush action={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}><Plus size={14} aria-hidden="true" /> Add past shift</button>}>
        <ResponsiveTable columns={cols} rows={rows} empty="No timesheet entries yet" />
      </Card>
      {adding && <ShiftModal onClose={() => setAdding(false)} />}
    </>
  );
}

export default function HoursPage() {
  const { role, roleId } = useDemo();
  const [tab, setTab] = useState('hours');
  const viewAll = VIEW_ALL.includes(roleId);
  const me = shortName(role.name);

  return (
    <div className="dash">
      <PageHeader eyebrow="Time" title="Booked hours" subtitle={viewAll ? 'Hours booked by every worker, and staff timesheets.' : 'Your booked hours and your timesheet.'} />
      <div className="hp-tabs">
        <div className="segmented" role="tablist" aria-label="Hours view">
          <button type="button" role="tab" aria-selected={tab === 'hours'} className={tab === 'hours' ? 'on' : ''} onClick={() => setTab('hours')}>Booked hours</button>
          <button type="button" role="tab" aria-selected={tab === 'timesheet'} className={tab === 'timesheet' ? 'on' : ''} onClick={() => setTab('timesheet')}>Timesheet</button>
        </div>
      </div>
      {tab === 'hours' ? <BookedHours viewAll={viewAll} me={me} /> : <Timesheet viewAll={viewAll} me={me} />}
    </div>
  );
}
