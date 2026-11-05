import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Gauge, Hammer, Plus } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import HoursNotFilled from '../components/HoursNotFilled';
import { KpiCard, PageHeader } from '../components/ui';
import TaskList from '../components/TaskList';
import KpiLink from '../components/KpiLink';
import { SavedViews } from '../components/ListKit';
import { useDemo } from '../context/DemoContext';
import { NewWorkshopTaskModal } from './WorkshopDashboard';
import { repeatLabel } from '../lib/repeat';
import { fabTypeColors } from '../data/fabTypes';
import { shortName } from '../lib/people';
import { crewOf } from '../lib/checklists';
import { addDays, formatShort, fullDate, startOfWeek, toKey, today } from '../lib/dates';
import { CLOSED_STAGES, MANAGER_ROLES } from '../lib/workflow';
import './FabDashboard.css';

const CLOSED = CLOSED_STAGES;

// variant: 'manager' (Fab Manager and the Fabrication menu) or 'ic2' (Fab 2IC: starts on "My open").
// One list with saved views; the calendar is one click away instead of always on screen.
export default function FabDashboard({ variant = 'manager' }) {
  const { tasks, allJobs: jobs, role, roleId, hoursLog } = useDemo();
  const [filter, setFilter] = useState(variant === 'ic2' ? 'mine' : 'all');
  const [workshopTask, setWorkshopTask] = useState(false);
  const [show, setShow] = useState('tasks');

  const me = shortName(role.name);
  const key = toKey(today());
  const canApprove = MANAGER_ROLES.includes(roleId);
  const fab = tasks.filter((t) => t.kind === 'fab');
  const open = fab.filter((t) => !CLOSED.includes(t.stage));
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const stageOrder = ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'Rejected', 'Reopen', 'Completed', 'Complete - Not Used', 'Cancelled'];
  const sort = (list) => [...list].sort((a, b) => String(a.parentId || a.id).localeCompare(String(b.parentId || b.id))
    || stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage) || String(a.date || '').localeCompare(String(b.date || '')));
  const overdueList = open.filter((t) => t.date < key && t.stage !== 'Manager Review');

  const VIEWS = [
    { id: 'all', label: 'All open', rows: sort(open) },
    { id: 'mine', label: 'My open', rows: sort(open.filter((t) => crewOf(t).includes(me))) },
    { id: 'unscheduled', label: 'Unscheduled', rows: sort(open.filter((t) => t.stage === 'Awaiting Scheduling')) },
    { id: 'scheduled', label: 'Scheduled', rows: sort(open.filter((t) => t.stage === 'Scheduled')) },
    { id: 'progress', label: 'In progress', rows: sort(open.filter((t) => t.stage === 'In Progress')) },
    { id: 'review', label: 'In review', rows: sort(open.filter((t) => t.stage === 'Manager Review')) },
    { id: 'late', label: 'Overdue', rows: sort(overdueList) },
  ];
  const count = (id) => VIEWS.find((v) => v.id === id).rows.length;
  const pick = (id) => { setFilter(id); setShow('tasks'); };

  const booked = fab.reduce((n, t) => n + (t.booked || 0), 0);
  const quoted = fab.reduce((n, t) => n + (t.quoted || 0), 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;

  // FSD 5.12, IC dashboard: my hours last week (Monday to Sunday).
  const lastWeekStart = toKey(addDays(startOfWeek(today()), -7));
  const lastWeekEnd = toKey(addDays(startOfWeek(today()), -1));
  const hoursLastWeek = Math.round(hoursLog.filter((h) => h.worker === me && h.date >= lastWeekStart && h.date <= lastWeekEnd).reduce((n, h) => n + h.hours, 0) * 10) / 10;

  const events = fab.filter((t) => t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title={variant === 'ic2' ? 'Fab 2IC Dashboard' : 'Fab Manager Dashboard'}>
        {variant !== 'ic2' && <button type="button" className="btn btn-ghost" onClick={() => setWorkshopTask(true)}><Plus size={16} aria-hidden="true" /> New workshop task</button>}
        <Link className="btn btn-primary" to="/jobs">Create task from a job</Link>
      </PageHeader>

      <div className="kpis">
        <KpiLink icon={Hammer} label="Open fab tasks" value={open.length} note={`${count('mine')} assigned to you`} onClick={() => pick('all')} active={filter === 'all' && show === 'tasks'} />
        <KpiLink icon={Clock} label="Unscheduled" value={count('unscheduled')} tone="warn" note="need a date and a team" onClick={() => pick('unscheduled')} active={filter === 'unscheduled'} />
        <KpiLink icon={CheckCircle2} label="Awaiting approval" value={count('review')} note={canApprove ? 'ready for you to review' : 'with the Fab Manager'} onClick={() => pick('review')} active={filter === 'review'} />
        <KpiLink icon={AlertTriangle} label="Overdue" value={overdueList.length} tone="danger" note="past their date" onClick={() => pick('late')} active={filter === 'late'} />
        {variant === 'ic2' && <KpiCard icon={Clock} label="My hours last week" value={`${hoursLastWeek}h`} note={`${formatShort(lastWeekStart)} to ${formatShort(lastWeekEnd)}`} />}
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${Math.round(booked * 10) / 10} / ${quoted} hrs`} />
      </div>

      {variant === 'ic2' && <HoursNotFilled person={me} />}

      <div className="ui-scope font-sans">
        <SavedViews label="Show" value={show} onChange={setShow} views={[{ id: 'tasks', label: 'Task list' }, { id: 'calendar', label: 'Calendar' }]} />
      </div>
      {show === 'calendar'
        ? <CalendarCard title="Fabrication calendar" events={events} typeColors={fabTypeColors} defaultView={variant === 'ic2' ? 'Week' : 'Month'} />
        : (
          <TaskList title="Fabrication tasks" views={VIEWS} view={filter} onView={setFilter} typeColors={fabTypeColors} groupable jobName={jobName}
            subtitle={(t) => (t.repeat ? ` · repeats: ${repeatLabel(t.repeat).toLowerCase()}` : '')} emptyText="No fabrication tasks in this view" />
        )}

      {workshopTask && <NewWorkshopTaskModal onClose={() => setWorkshopTask(false)} />}
    </div>
  );
}
