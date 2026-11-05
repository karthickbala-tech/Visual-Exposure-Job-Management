import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Gauge, ShieldCheck, Truck } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import { Chip, KpiCard, PageHeader } from '../components/ui';
import TaskList from '../components/TaskList';
import KpiLink from '../components/KpiLink';
import { SavedViews } from '../components/ListKit';
import { useDemo } from '../context/DemoContext';
import { showOnInstallCalendar } from '../lib/calendar';
import { lastPayPeriod, thisPayPeriod } from '../lib/payPeriod';
import { installTypeStyles } from '../data/mockData';
import { fabTypeColors } from '../data/fabTypes';
import { shortName } from '../lib/people';
import { crewOf } from '../lib/checklists';
import { fullDate, toKey, today } from '../lib/dates';
import { CLOSED_STAGES, MANAGER_ROLES } from '../lib/workflow';
import './FabDashboard.css';

const CLOSED = CLOSED_STAGES;

// Install tasks: one list with saved views (including "SWMS unsigned"), the calendar one click away,
// pay-period hours as two quiet links.
export default function InstallDashboard() {
  const { tasks, jobs, swms, role, roleId, hoursLog, settings } = useDemo();
  const [filter, setFilter] = useState('all');
  const [withFab, setWithFab] = useState(false);
  const [show, setShow] = useState('tasks');

  const isPm = roleId === 'pm';
  const canApprove = MANAGER_ROLES.includes(roleId);
  const me = shortName(role.name);
  const key = toKey(today());
  const install = tasks.filter((t) => t.kind === 'install');
  const open = install.filter((t) => !CLOSED.includes(t.stage));
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const swmsFor = (t) => (t.swms === 'Created'
    ? (swms.find((s) => s.jobId === t.jobId && s.title === t.name) || swms.find((s) => s.jobId === t.jobId))?.status ?? t.swms
    : t.swms);
  const byDate = (list) => [...list].sort((a, b) => a.date.localeCompare(b.date));

  const VIEWS = [
    { id: 'all', label: 'All open', rows: byDate(open) },
    { id: 'mine', label: 'My open', rows: byDate(open.filter((t) => crewOf(t).includes(me))) },
    { id: 'unscheduled', label: 'Unscheduled', rows: byDate(open.filter((t) => t.stage === 'Awaiting Scheduling')) },
    { id: 'scheduled', label: 'Scheduled', rows: byDate(open.filter((t) => t.stage === 'Scheduled')) },
    { id: 'progress', label: 'In progress', rows: byDate(open.filter((t) => t.stage === 'In Progress')) },
    { id: 'review', label: 'In review', rows: byDate(open.filter((t) => t.stage === 'Manager Review')) },
    { id: 'swms', label: 'SWMS unsigned', rows: byDate(open.filter((t) => swmsFor(t) === 'Created')) },
  ];
  const count = (id) => VIEWS.find((v) => v.id === id).rows.length;
  const pick = (id) => { setFilter(id); setShow('tasks'); };

  const booked = install.reduce((n, t) => n + (t.booked || 0), 0);
  const quoted = install.reduce((n, t) => n + (t.quoted || 0), 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;
  const events = [
    ...install.filter((t) => t.stage !== 'Cancelled' && showOnInstallCalendar(t)).map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type })),
    ...(withFab ? tasks.filter((t) => t.kind === 'fab' && t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: `Fab: ${t.name}`, type: t.type })) : []),
  ];
  // HRS-3: install hours booked in this and the last pay period, from the one pay-period setting.
  const payHours = (p) => Math.round(hoursLog.filter((h) => h.kind === 'install' && h.date >= p.from && h.date <= p.to).reduce((n, h) => n + h.hours, 0) * 10) / 10;
  const thisPay = thisPayPeriod(key, settings.payPeriod);
  const lastPay = lastPayPeriod(key, settings.payPeriod);
  const colors = withFab ? { ...installTypeStyles, ...fabTypeColors } : installTypeStyles;

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Installation" subtitle="Install tasks, site crews and SWMS status across all jobs.">
        {isPm && <Link className="btn btn-primary" to="/jobs">Create task from a job</Link>}
      </PageHeader>

      <div className="kpis">
        <KpiLink icon={Truck} label="Open install tasks" value={open.length} note={`${count('mine')} assigned to you`} onClick={() => pick('all')} active={filter === 'all' && show === 'tasks'} />
        <KpiLink icon={Clock} label="Unscheduled" value={count('unscheduled')} tone="warn" note="need a date and a crew" onClick={() => pick('unscheduled')} active={filter === 'unscheduled'} />
        <KpiLink icon={ShieldCheck} label="SWMS unsigned" value={count('swms')} tone="danger" note="before crews go on site" onClick={() => pick('swms')} active={filter === 'swms'} />
        <KpiLink icon={CheckCircle2} label="Awaiting approval" value={count('review')} note={canApprove ? 'ready for you to review' : 'with the manager'} onClick={() => pick('review')} active={filter === 'review'} />
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${Math.round(booked * 10) / 10} / ${quoted} hrs`} />
      </div>

      <div className="ui-scope flex flex-wrap items-center gap-x-4 gap-y-2 font-sans">
        <SavedViews label="Show" value={show} onChange={setShow} views={[{ id: 'tasks', label: 'Task list' }, { id: 'calendar', label: 'Calendar' }]} />
        <div className="pay-buttons flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Pay period hours">
          <Link className="view-all" to="/hours?period=lastPay">Booked hours last pay period · {payHours(lastPay)}h</Link>
          <Link className="view-all" to="/hours?period=thisPay">Booked hours this pay period · {payHours(thisPay)}h</Link>
        </div>
      </div>

      {show === 'calendar' ? (
        <>
          <div className="ui-scope flex flex-wrap items-center gap-3 font-sans">
            <SavedViews label="Calendar contents" value={withFab ? 'both' : 'install'} onChange={(v) => setWithFab(v === 'both')} views={[{ id: 'install', label: 'Install only' }, { id: 'both', label: 'Install and fab' }]} />
            <small className="muted">External and Print Only tasks are left off the calendar.</small>
          </div>
          <CalendarCard title="Installation calendar" events={events} typeColors={colors} defaultView="Week" />
        </>
      ) : (
        <TaskList title="Install tasks" views={VIEWS} view={filter} onView={setFilter} typeColors={installTypeStyles} jobName={jobName} canSchedule={isPm || roleId === 'admin'}
          extraColumns={[{ key: 'swms', label: 'SWMS', render: (t) => <Chip value={swmsFor(t)} /> }]} emptyText="No install tasks in this view" />
      )}
    </div>
  );
}
