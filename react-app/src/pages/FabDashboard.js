import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Gauge, Hammer, Plus } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { FAB_TYPES, fabTypeColors } from '../data/fabTypes';
import { FAB_CREW, shortName } from '../lib/people';
import { formatShort, fullDate, toKey, today } from '../lib/dates';
import { MANAGER_ROLES } from '../lib/workflow';
import './FabDashboard.css';

const CLOSED = ['Completed', 'Cancelled'];

function NewTaskModal({ presetType, onClose }) {
  const { jobs, addTask } = useDemo();
  const [f, setF] = useState({ name: '', jobId: jobs[0]?.id || '', type: presetType || FAB_TYPES[0], date: toKey(today()), leader: '', member: '', quoted: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.jobId || !f.date) return setError('Task name, job and date are required.');
    if (f.member && !f.leader) return setError('Choose a team leader before a team member.');
    addTask({ ...f, name: f.name.trim(), quoted: Number(f.quoted) || 0 });
    return onClose();
  };

  return (
    <Modal title="New fabrication task" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Task name<input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Pylon panel CNC cut" /></label>
        <div className="form-row">
          <label>Job<select value={f.jobId} onChange={set('jobId')}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.name}</option>)}</select></label>
          <label>Fab type<select value={f.type} onChange={set('type')}>{FAB_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Date<input type="date" value={f.date} onChange={set('date')} /></label>
          <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
        </div>
        <div className="form-row">
          <label>Team leader<select value={f.leader} onChange={set('leader')}><option value="">Not assigned yet</option>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Team member<select value={f.member} onChange={set('member')}><option value="">None</option>{FAB_CREW.filter((c) => c !== f.leader).map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <small>With a team leader the task starts as Scheduled. Without one it waits as Awaiting Scheduling.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create task</button>
        </div>
      </form>
    </Modal>
  );
}

function ScheduleModal({ task, onClose }) {
  const { scheduleTask } = useDemo();
  const [f, setF] = useState({ date: task.date, leader: '', member: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.date || !f.leader) return setError('A date and a team leader are required to schedule.');
    scheduleTask(task.id, f);
    return onClose();
  };

  return (
    <Modal title={`Schedule: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Date<input type="date" value={f.date} onChange={set('date')} /></label>
        <label>Team leader<select autoFocus value={f.leader} onChange={set('leader')}><option value="">Choose…</option>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Team member<select value={f.member} onChange={set('member')}><option value="">None</option>{FAB_CREW.filter((c) => c !== f.leader).map((c) => <option key={c}>{c}</option>)}</select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Schedule</button>
        </div>
      </form>
    </Modal>
  );
}

// variant: 'manager' (Fab Manager and the Fabrication menu) or 'ic2' (Fab 2IC: week view, starts on "My open").
export default function FabDashboard({ variant = 'manager' }) {
  const { tasks, jobs, role, roleId, actOnTask } = useDemo();
  const [filter, setFilter] = useState(variant === 'ic2' ? 'mine' : 'all');
  const [creating, setCreating] = useState(null);
  const [scheduling, setScheduling] = useState(null);

  const me = shortName(role.name);
  const key = toKey(today());
  const canApprove = MANAGER_ROLES.includes(roleId);
  const fab = tasks.filter((t) => t.kind === 'fab');
  const open = fab.filter((t) => !CLOSED.includes(t.stage));
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;

  const FILTERS = [
    ['all', 'All open', open],
    ['mine', 'My open', open.filter((t) => [t.leader, t.member].includes(me))],
    ['unscheduled', 'Unscheduled', open.filter((t) => t.stage === 'Awaiting Scheduling')],
    ['scheduled', 'Scheduled', open.filter((t) => t.stage === 'Scheduled')],
    ['progress', 'In progress', open.filter((t) => t.stage === 'In Progress')],
    ['review', 'In review', open.filter((t) => t.stage === 'Manager Review')],
  ];
  const rows = [...(FILTERS.find((x) => x[0] === filter) || FILTERS[0])[2]].sort((a, b) => a.date.localeCompare(b.date));

  const overdue = open.filter((t) => t.date < key && t.stage !== 'Manager Review').length;
  const booked = fab.reduce((n, t) => n + (t.booked || 0), 0);
  const quoted = fab.reduce((n, t) => n + (t.quoted || 0), 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;
  const events = fab.filter((t) => t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => (
      <div className="stack"><strong>{t.name}</strong><small><Link className="job-link" to={`/jobs/${t.jobId}`}>{t.jobId}</Link> · {jobName(t.jobId)}</small></div>) },
    { key: 'type', label: 'Type', render: (t) => <span className="type-tag"><i className="dot" style={{ background: fabTypeColors[t.type] || '#7b8794' }} />{t.type}</span> },
    { key: 'date', label: 'Date', render: (t) => <span className={t.date < key && t.stage !== 'Manager Review' ? 'over' : ''}>{formatShort(t.date)}</span> },
    { key: 'leader', label: 'Team leader', render: (t) => t.leader || 'Unassigned' },
    { key: 'member', label: 'Team member', render: (t) => t.member || '-' },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Booked / quoted', render: (t) => (t.quoted ? `${t.booked || 0}h / ${t.quoted}h` : '-') },
    { key: 'action', label: 'Action', render: (t) => (
      <div className="row-actions">
        {t.stage === 'Awaiting Scheduling' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setScheduling(t)}>Schedule</button>}
        {t.stage === 'Manager Review' && canApprove && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Approve')}>Approve</button>}
        <Link className="btn btn-ghost btn-sm" to={`/jobs/${t.jobId}`}>{t.stage === 'Manager Review' ? 'Review' : 'Open'}</Link>
      </div>) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title={variant === 'ic2' ? 'Fab 2IC Dashboard' : 'Fab Manager Dashboard'}>
        <button type="button" className="btn btn-primary" onClick={() => setCreating('')}><Plus size={16} aria-hidden="true" /> New fab task</button>
      </PageHeader>

      <div className="fab-types" aria-label="Quick create by fab type">
        {FAB_TYPES.map((t) => (
          <button key={t} type="button" onClick={() => setCreating(t)} title={`New ${t} task`}>
            <i className="dot" style={{ background: fabTypeColors[t] }} />{t}
          </button>
        ))}
      </div>

      <div className="kpis">
        <KpiCard icon={Hammer} label="Open fab tasks" value={open.length} note={`${FILTERS[1][2].length} assigned to you`} />
        <KpiCard icon={Clock} label="Unscheduled" value={FILTERS[2][2].length} tone="warn" note="need a date and a team" />
        <KpiCard icon={CheckCircle2} label="Awaiting approval" value={FILTERS[5][2].length} note={canApprove ? 'ready for you to review' : 'with the Fab Manager'} />
        <KpiCard icon={AlertTriangle} label="Overdue" value={overdue} tone="danger" note="past their date" />
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${Math.round(booked * 10) / 10} / ${quoted} hrs`} />
      </div>

      <CalendarCard title="Fabrication calendar" events={events} typeColors={fabTypeColors} defaultView={variant === 'ic2' ? 'Week' : 'Month'} />

      <div className="fab-filters">
        <div className="segmented" role="tablist" aria-label="Task filter">
          {FILTERS.map(([id, label, list]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}<em>{list.length}</em>
            </button>
          ))}
        </div>
      </div>
      <Card title="Fabrication tasks" flush>
        <ResponsiveTable columns={columns} rows={rows} empty="No fabrication tasks in this view" />
      </Card>

      {creating !== null && <NewTaskModal presetType={creating} onClose={() => setCreating(null)} />}
      {scheduling && <ScheduleModal task={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  );
}
