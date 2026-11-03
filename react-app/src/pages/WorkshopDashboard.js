import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ClipboardList, Plus, Search, Wrench } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import RepeatFields from '../components/RepeatFields';
import { repeatLabel, validateRepeat } from '../lib/repeat';
import HoursNotFilled from '../components/HoursNotFilled';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { fabTypeColors } from '../data/fabTypes';
import { FAB_CREW, shortName } from '../lib/people';
import { daysOverdue, isOverdue, nextDue } from '../lib/equipment';
import { WORKSHOP_TASK_TYPES } from '../lib/config';
import { CLOSED_STAGES, TRANSITIONS } from '../lib/workflow';
import { formatShort, fullDate, toKey, today } from '../lib/dates';
import './FabDashboard.css';

const CLOSED = CLOSED_STAGES;

// Workshop tasks use the workshop job from settings, never a hard-coded id in the screen (FSD FAB-5).
export function NewWorkshopTaskModal({ onClose }) {
  const { allJobs, addTask, settings } = useDemo();
  const WORKSHOP_JOB_ID = settings.workshopJobId; // set in Admin, settings
  const job = allJobs.find((j) => j.id === WORKSHOP_JOB_ID);
  const [f, setF] = useState({ name: '', type: WORKSHOP_TASK_TYPES[0], date: toKey(today()), leader: '', quoted: '', repeat: { count: '', unit: 'Weeks' } });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.date) return setError('Task name and date are required.');
    const bad = validateRepeat(f.repeat);
    if (bad) return setError(bad);
    addTask({ ...f, name: f.name.trim(), jobId: WORKSHOP_JOB_ID, member: '', quoted: Number(f.quoted) || 0 });
    return onClose();
  };

  return (
    <Modal title="New workshop task" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Task name<input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Sharpen router bits" /></label>
        <div className="form-row">
          <label>Type<select value={f.type} onChange={set('type')}>{WORKSHOP_TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Date<input type="date" value={f.date} onChange={set('date')} /></label>
        </div>
        <div className="form-row">
          <label>Team leader<select value={f.leader} onChange={set('leader')}><option value="">Not assigned yet</option>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
        </div>
        {f.type === 'Workshop' && <RepeatFields value={f.repeat} onChange={(repeat) => setF((x) => ({ ...x, repeat }))} />}
        <small>Job: {job ? `${job.id} · ${job.name}` : WORKSHOP_JOB_ID}. With a team leader the task starts as Scheduled.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create task</button>
        </div>
      </form>
    </Modal>
  );
}

export default function WorkshopDashboard() {
  const { tasks, role, equipment, completeEquipmentCheck, actOnTask } = useDemo();
  const [taskView, setTaskView] = useState('all');
  const [status, setStatus] = useState('All');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const me = shortName(role.name);
  const key = toKey(today());

  const workshop = tasks.filter((t) => t.kind === 'fab' && WORKSHOP_TASK_TYPES.includes(t.type));
  const open = workshop.filter((t) => !CLOSED.includes(t.stage));
  const mine = open.filter((t) => [t.leader, t.member].includes(me));
  const rows = [...(taskView === 'mine' ? mine : open)].sort((a, b) => a.date.localeCompare(b.date));

  const overdueAll = equipment.filter((e) => isOverdue(e, key));
  const myOverdue = overdueAll.filter((e) => e.responsible === me).sort((a, b) => nextDue(a).localeCompare(nextDue(b)));
  const inService = equipment.filter((e) => e.status === 'In service').length;

  const register = equipment.filter((e) =>
    (status === 'All' || e.status === status) && `${e.id} ${e.name} ${e.type} ${e.location}`.toLowerCase().includes(q.toLowerCase()));

  const events = workshop.filter((t) => t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));

  // The next plain action for this task. Approvals and reject/reopen stay with managers on the job page.
  const nextStep = (t) => (TRANSITIONS[t.stage] || []).find((a) => !a.manager && !a.comment && a.action !== 'Schedule');

  const taskColumns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => <div className="stack"><strong>{t.name}</strong><small>{t.id}{t.repeat ? ` · repeats: ${repeatLabel(t.repeat).toLowerCase()}` : ''}</small></div> },
    { key: 'type', label: 'Type', render: (t) => <span className="type-tag"><i className="dot" style={{ background: fabTypeColors[t.type] }} />{t.type}</span> },
    { key: 'date', label: 'Date', render: (t) => <span className={t.date < key && t.stage !== 'Manager Review' ? 'over' : ''}>{formatShort(t.date)}</span> },
    { key: 'leader', label: 'Team leader', render: (t) => t.leader || 'Unassigned' },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Booked / quoted', render: (t) => (t.quoted ? `${t.booked || 0}h / ${t.quoted}h` : '-') },
    { key: 'action', label: 'Action', render: (t) => {
      const step = nextStep(t);
      if (!step) return <span className="muted">{t.stage === 'Awaiting Scheduling' ? 'Needs a Fab Manager' : 'With manager'}</span>;
      return <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, step.action)}>{step.action}</button>;
    } },
  ];

  const dueColumns = [
    { key: 'id', label: 'Tool ID', primary: true, render: (e) => <strong>{e.id}</strong> },
    { key: 'name', label: 'Equipment', render: (e) => <div className="stack"><span>{e.name}</span><small>{e.location}</small></div> },
    { key: 'due', label: 'Was due', render: (e) => <span className="over">{formatShort(nextDue(e))} · {daysOverdue(e, key)} days late</span> },
    { key: 'action', label: 'Action', render: (e) => <button type="button" className="btn btn-primary btn-sm" onClick={() => completeEquipmentCheck(e.id)}>Mark checked</button> },
  ];

  const registerColumns = [
    { key: 'id', label: 'Tool ID', primary: true, render: (e) => <strong>{e.id}</strong> },
    { key: 'name', label: 'Equipment', render: (e) => e.name },
    { key: 'type', label: 'Type', render: (e) => e.type },
    { key: 'location', label: 'Location', render: (e) => e.location },
    { key: 'status', label: 'Status', render: (e) => <Chip value={e.status} tone={e.status === 'Off hire' ? 'amber' : 'green'} /> },
    { key: 'last', label: 'Last checked', render: (e) => formatShort(e.lastChecked) },
    { key: 'next', label: 'Next check', render: (e) => (e.status === 'Off hire' ? '-' : <span className={isOverdue(e, key) ? 'over' : ''}>{formatShort(nextDue(e))}</span>) },
    { key: 'who', label: 'Responsible', render: (e) => e.responsible },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Workshop Dashboard" subtitle="Workshop tasks, equipment checks and the equipment register.">
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> Create workshop task</button>
      </PageHeader>

      <div className="kpis">
        <KpiCard icon={ClipboardList} label="Open workshop tasks" value={open.length} note={`${mine.length} assigned to you`} />
        <KpiCard icon={AlertTriangle} label="My overdue equipment checks" value={myOverdue.length} tone={myOverdue.length ? 'danger' : 'brand'} note={`${overdueAll.length} overdue in the whole workshop`} />
        <KpiCard icon={Wrench} label="Equipment in service" value={inService} note={`${equipment.length} items in the register`} />
      </div>

      <HoursNotFilled person={me} />

      <CalendarCard title="Workshop calendar" events={events} typeColors={fabTypeColors} defaultView="Week" />

      <div className="fab-filters">
        <div className="segmented" role="tablist" aria-label="Task filter">
          {[['all', 'All open', open.length], ['mine', 'My open', mine.length]].map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={taskView === id} className={taskView === id ? 'on' : ''} onClick={() => setTaskView(id)}>{label}<em>{n}</em></button>
          ))}
        </div>
      </div>
      <Card title="Workshop tasks" flush>
        <ResponsiveTable columns={taskColumns} rows={rows} empty="No workshop tasks in this view" />
      </Card>

      <div className="fab-filters" />
      <Card title="My overdue equipment checks" flush>
        <ResponsiveTable columns={dueColumns} rows={myOverdue} empty="Nothing overdue. Your equipment checks are up to date." />
      </Card>

      <div className="fab-filters">
        <label className="search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by tool ID, name or location" aria-label="Filter equipment" />
        </label>
        <div className="segmented" role="tablist" aria-label="Equipment status">
          {['All', 'In service', 'Off hire'].map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s}</button>
          ))}
        </div>
      </div>
      <Card title="Register of equipment" flush>
        <ResponsiveTable columns={registerColumns} rows={register} empty="No equipment matches" />
      </Card>
      <p className="muted"><Link to="/equipment">Manage equipment, chemicals and locations</Link> · <Link to="/fabrication">Fab tasks for jobs are on the Fabrication page</Link></p>

      {creating && <NewWorkshopTaskModal onClose={() => setCreating(false)} />}
    </div>
  );
}
