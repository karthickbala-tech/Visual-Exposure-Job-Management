import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Gauge, Plus, ShieldCheck, Truck } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { installTypeStyles } from '../data/mockData';
import { fabTypeColors } from '../data/fabTypes';
import { INSTALL_CREW, shortName } from '../lib/people';
import { formatShort, fullDate, toKey, today } from '../lib/dates';
import { MANAGER_ROLES } from '../lib/workflow';
import './FabDashboard.css';

const TYPES = Object.keys(installTypeStyles);
const CLOSED = ['Completed', 'Cancelled'];

function NewInstallModal({ presetType, onClose }) {
  const { jobs, addInstallTask } = useDemo();
  const [f, setF] = useState({ name: '', jobId: jobs[0]?.id || '', type: presetType || TYPES[0], date: toKey(today()), leader: '', member: '', quoted: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const needsSwms = ['VE Install', 'VE Subtask'].includes(f.type);

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.jobId || !f.date) return setError('Task name, job and install date are required.');
    if (f.member && !f.leader) return setError('Choose a team leader before a team member.');
    addInstallTask({ ...f, name: f.name.trim(), quoted: Number(f.quoted) || 0 });
    return onClose();
  };

  return (
    <Modal title="New install task" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Task name<input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Fit pylon on site" /></label>
        <div className="form-row">
          <label>Job<select value={f.jobId} onChange={set('jobId')}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.name}</option>)}</select></label>
          <label>Install type<select value={f.type} onChange={set('type')}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Install date<input type="date" value={f.date} onChange={set('date')} /></label>
          <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
        </div>
        <div className="form-row">
          <label>Team leader<select value={f.leader} onChange={set('leader')}><option value="">Not assigned yet</option>{INSTALL_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Team member<select value={f.member} onChange={set('member')}><option value="">None</option>{INSTALL_CREW.filter((c) => c !== f.leader).map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <small>{needsSwms ? 'A SWMS will be created and sent to the Project Manager to sign.' : 'This type does not need a SWMS.'}</small>
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
        <label>Install date<input type="date" value={f.date} onChange={set('date')} /></label>
        <label>Team leader<select autoFocus value={f.leader} onChange={set('leader')}><option value="">Choose…</option>{INSTALL_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Team member<select value={f.member} onChange={set('member')}><option value="">None</option>{INSTALL_CREW.filter((c) => c !== f.leader).map((c) => <option key={c}>{c}</option>)}</select></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Schedule</button>
        </div>
      </form>
    </Modal>
  );
}

export default function InstallDashboard() {
  const { tasks, jobs, swms, role, roleId, actOnTask } = useDemo();
  const [filter, setFilter] = useState('all');
  const [withFab, setWithFab] = useState(false);
  const [creating, setCreating] = useState(null);
  const [scheduling, setScheduling] = useState(null);

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

  const FILTERS = [
    ['all', 'All open', open],
    ['mine', 'My open', open.filter((t) => [t.leader, t.member].includes(me))],
    ['unscheduled', 'Unscheduled', open.filter((t) => t.stage === 'Awaiting Scheduling')],
    ['scheduled', 'Scheduled', open.filter((t) => t.stage === 'Scheduled')],
    ['progress', 'In progress', open.filter((t) => t.stage === 'In Progress')],
    ['review', 'In review', open.filter((t) => t.stage === 'Manager Review')],
    ['swms', 'SWMS unsigned', open.filter((t) => swmsFor(t) === 'Created')],
  ];
  const rows = [...(FILTERS.find((x) => x[0] === filter) || FILTERS[0])[2]].sort((a, b) => a.date.localeCompare(b.date));

  const booked = install.reduce((n, t) => n + (t.booked || 0), 0);
  const quoted = install.reduce((n, t) => n + (t.quoted || 0), 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;

  const events = [
    ...install.filter((t) => t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type })),
    ...(withFab ? tasks.filter((t) => t.kind === 'fab' && t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: `Fab: ${t.name}`, type: t.type })) : []),
  ];
  const colors = withFab ? { ...installTypeStyles, ...fabTypeColors } : installTypeStyles;

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => (
      <div className="stack"><strong>{t.name}</strong><small><Link className="job-link" to={`/jobs/${t.jobId}`}>{t.jobId}</Link> · {jobName(t.jobId)}</small></div>) },
    { key: 'type', label: 'Type', render: (t) => <span className="type-tag"><i className="dot" style={{ background: installTypeStyles[t.type] || '#7b8794' }} />{t.type}</span> },
    { key: 'date', label: 'Install date', render: (t) => <span className={t.date < key && t.stage !== 'Manager Review' ? 'over' : ''}>{formatShort(t.date)}</span> },
    { key: 'leader', label: 'Team leader', render: (t) => t.leader || 'Unassigned' },
    { key: 'member', label: 'Team member', render: (t) => t.member || '-' },
    { key: 'swms', label: 'SWMS', render: (t) => <Chip value={swmsFor(t)} /> },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Booked / quoted', render: (t) => (t.quoted ? <span className={t.booked > t.quoted ? 'over' : ''}>{t.booked || 0}h / {t.quoted}h</span> : '-') },
    { key: 'action', label: 'Action', render: (t) => (
      <div className="row-actions">
        {isPm && t.stage === 'Awaiting Scheduling' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setScheduling(t)}>Schedule</button>}
        {t.stage === 'Manager Review' && canApprove && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Approve')}>Approve</button>}
        <Link className="btn btn-ghost btn-sm" to={`/jobs/${t.jobId}`}>{t.stage === 'Manager Review' ? 'Review' : 'Open'}</Link>
      </div>) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Installation" subtitle="Install tasks, site crews and SWMS status across all jobs.">
        {isPm && <button type="button" className="btn btn-primary" onClick={() => setCreating('')}><Plus size={16} aria-hidden="true" /> New install task</button>}
      </PageHeader>

      {isPm && (
        <div className="fab-types" aria-label="Quick create by install type">
          {TYPES.map((t) => (
            <button key={t} type="button" onClick={() => setCreating(t)} title={`New ${t} task`}>
              <i className="dot" style={{ background: installTypeStyles[t] }} />{t}
            </button>
          ))}
        </div>
      )}

      <div className="kpis">
        <KpiCard icon={Truck} label="Open install tasks" value={open.length} note={`${FILTERS[1][2].length} assigned to you`} />
        <KpiCard icon={Clock} label="Unscheduled" value={FILTERS[2][2].length} tone="warn" note="need a date and a crew" />
        <KpiCard icon={ShieldCheck} label="SWMS unsigned" value={FILTERS[6][2].length} tone="danger" note="before crews go on site" />
        <KpiCard icon={CheckCircle2} label="Awaiting approval" value={FILTERS[5][2].length} note={canApprove ? 'ready for you to review' : 'with the manager'} />
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${Math.round(booked * 10) / 10} / ${quoted} hrs`} />
      </div>

      <div className="fab-filters">
        <div className="segmented" role="tablist" aria-label="Calendar contents">
          <button type="button" role="tab" aria-selected={!withFab} className={!withFab ? 'on' : ''} onClick={() => setWithFab(false)}>Install only</button>
          <button type="button" role="tab" aria-selected={withFab} className={withFab ? 'on' : ''} onClick={() => setWithFab(true)}>Install and fab</button>
        </div>
      </div>
      <CalendarCard title="Installation calendar" events={events} typeColors={colors} defaultView="Week" />

      <div className="fab-filters">
        <div className="segmented" role="tablist" aria-label="Task filter">
          {FILTERS.map(([id, label, list]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              {label}<em>{list.length}</em>
            </button>
          ))}
        </div>
      </div>
      <Card title="Install tasks" flush>
        <ResponsiveTable columns={columns} rows={rows} empty="No install tasks in this view" />
      </Card>

      {creating !== null && <NewInstallModal presetType={creating} onClose={() => setCreating(null)} />}
      {scheduling && <ScheduleModal task={scheduling} onClose={() => setScheduling(null)} />}
    </div>
  );
}
