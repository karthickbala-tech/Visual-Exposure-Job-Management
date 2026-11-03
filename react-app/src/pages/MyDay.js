import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, Hourglass, ListChecks, MapPin, Users } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import ChecklistDialog from '../components/ChecklistDialog';
import HoursNotFilled from '../components/HoursNotFilled';
import { Card, Chip, KpiCard, PageHeader, ResponsiveTable } from '../components/ui';
import { fabTypeColors } from '../data/fabTypes';
import { installTypeStyles } from '../data/mockData';
import { useDemo } from '../context/DemoContext';
import { formatShort, fullDate, greeting, toKey, today } from '../lib/dates';
import { CLOSED_STAGES, MAX_ENTRY_HOURS, SUBSTAGES, TRANSITIONS } from '../lib/workflow';
import { checklistPlan, nextStep, stepTitle, submitBlockReason } from '../lib/checklists';
import './MyDay.css';

// Fab Worker and Installer home: "my" tasks only, big touch targets, one clear next step.
const KIND_FOR_ROLE = { fabWorker: 'fab', installer: 'install' };
const shortName = (full) => {
  const [first, last = ''] = full.split(' ');
  return `${first} ${last.charAt(0)}.`;
};

function TaskCard({ task, jobName, swmsStatus, late }) {
  const { actOnTask, bookHours, checklists, role } = useDemo();
  const [dialog, setDialog] = useState(null);
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');

  const isInstall = task.kind === 'install';
  const inProgress = task.stage === 'In Progress';
  const subIdx = SUBSTAGES.indexOf(task.subStage);
  const plan = checklistPlan(task);
  const me = shortName(role.name);
  const mine = checklists.find((c) => c.taskId === task.id && c.person === me);
  const next = nextStep(task, mine);
  // Pre-job steps start the task, so Start is only offered when there is no pre-job checklist.
  const steps = (TRANSITIONS[task.stage] || []).filter((s) => !s.manager && !(s.action === 'Start' && plan.pre));
  const sentBack = task.stage === 'Rejected' || task.stage === 'Reopen';

  const blocked = (step) => {
    if (step.action !== 'Submit for approval') return '';
    if (plan.post) return submitBlockReason(task, checklists);
    if (isInstall && task.subStage !== 'Finished On Site') return 'Mark Finished On Site first';
    if (!task.booked) return 'Book your hours first';
    return '';
  };

  const submitHours = (e) => {
    e.preventDefault();
    const n = Number(hours);
    if (!n || n <= 0) return setError('Enter the hours you worked.');
    if (n >= MAX_ENTRY_HOURS) return setError(`A single entry must be under ${MAX_ENTRY_HOURS} hours.`);
    setError('');
    setHours('');
    return bookHours(task.id, n);
  };

  return (
    <article className={`mtask ${late ? 'late' : ''}`}>
      <div className="mtask-top">
        <div className="stack">
          <h3>{task.name}</h3>
          <Link to={`/jobs/${task.jobId}`}>{task.jobId} · {jobName}</Link>
        </div>
        <Chip value={task.stage} />
      </div>

      <div className="mtask-meta">
        <span><CalendarDays size={14} aria-hidden="true" /> {formatShort(task.date)}</span>
        <span><Users size={14} aria-hidden="true" /> {[task.leader, task.member].filter(Boolean).join(', ') || 'Unassigned'}</span>
        {task.type && <span><MapPin size={14} aria-hidden="true" /> {task.type}</span>}
        <span><Clock size={14} aria-hidden="true" /> {task.booked || 0}h of {task.quoted}h</span>
        {isInstall && <span>SWMS <Chip value={swmsStatus} /></span>}
      </div>

      {sentBack && <p className="mtask-note" role="status">Sent back by the manager: {task.history?.[0]?.text || 'see the history'}</p>}
      {isInstall && swmsStatus === 'Created' && <p className="mtask-note warn">The SWMS has not been signed by the PM yet. Check before going on site.</p>}

      {isInstall && inProgress && (
        <div className="substeps" aria-label="Site progress">
          {SUBSTAGES.map((s, i) => <span key={s} className={i <= subIdx ? 'done' : i === subIdx + 1 ? 'next' : ''}>{s}</span>)}
        </div>
      )}

      <div className="mtask-actions">
        {next.step && ['Scheduled', 'In Progress', 'Rejected', 'Reopen'].includes(task.stage) && (
          <button type="button" className="btn btn-primary" onClick={() => setDialog(next.step)}>Checklist: {stepTitle(task, next.step)}</button>
        )}
        {steps.map((step) => {
          const why = blocked(step);
          return (
            <button key={step.action} type="button" disabled={Boolean(why)} title={why}
              className={`btn ${step.action === 'Submit for approval' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => actOnTask(task.id, step.action)}>{step.action}</button>
          );
        })}
        {task.stage === 'Manager Review' && <small className="muted">Waiting for manager approval.</small>}
        {task.stage === 'Completed' && <small className="muted"><CheckCircle2 size={14} aria-hidden="true" /> Done.</small>}
      </div>

      {!next.step && next.message && (plan.pre || plan.post) && <small className="muted">{next.message}</small>}
      {plan.post && task.stage !== 'Scheduled' && (
        <small className="muted">Closure: {[task.leader, task.member].filter(Boolean).map((p) => `${p} ${checklists.find((c) => c.taskId === task.id && c.person === p)?.steps.post2 ? 'done' : 'open'}`).join(', ')}</small>
      )}
      {dialog && <ChecklistDialog task={task} person={me} step={dialog} swmsStatus={swmsStatus} onClose={() => setDialog(null)} />}

      {inProgress && !plan.post && (
        <form className="hours-form" onSubmit={submitHours} noValidate>
          <input type="number" inputMode="decimal" step="0.5" min="0" value={hours} onChange={(e) => setHours(e.target.value)} aria-label="Hours to book" placeholder="Hours" />
          <button type="submit" className="btn btn-ghost">Book hours</button>
          {error && <small className="risk" role="alert">{error}</small>}
        </form>
      )}
    </article>
  );
}

export default function MyDay() {
  const { roleId, role, tasks, jobs, swms, checklists } = useDemo();
  const kind = KIND_FOR_ROLE[roleId];
  const me = shortName(role.name);
  const key = toKey(today());

  const mine = tasks.filter((t) => t.kind === kind && [t.leader, t.member].includes(me));
  const open = mine.filter((t) => !CLOSED_STAGES.includes(t.stage) && t.stage !== 'On Hold');
  const groups = [
    { id: 'late', title: 'Earlier and still open', list: open.filter((t) => t.date < key) },
    { id: 'today', title: 'Today', list: open.filter((t) => t.date === key) },
    { id: 'soon', title: 'Coming up', list: open.filter((t) => t.date > key).sort((a, b) => a.date.localeCompare(b.date)) },
  ];
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const swmsFor = (t) => (t.swms === 'Created' ? (swms.find((s) => s.jobId === t.jobId)?.status ?? t.swms) : t.swms);
  const booked = mine.reduce((n, t) => n + (t.booked || 0), 0);
  const events = mine.filter((t) => t.stage !== 'Cancelled').map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));
  // FSD 5.12 Fab Worker dashboard: my post-job checklists, newest tasks first.
  const post = kind === 'fab'
    ? mine.filter((t) => ['In Progress', 'Rejected', 'Reopen', 'Manager Review', 'Completed'].includes(t.stage))
      .map((t) => ({ id: t.id, task: t, rec: checklists.find((c) => c.taskId === t.id && c.person === me)?.steps.post2 }))
      .sort((a, b) => b.task.date.localeCompare(a.task.date)).slice(0, 8)
    : [];
  const postCols = [
    { key: 'name', label: 'Task', primary: true, render: (r) => <strong>{r.task.name}</strong> },
    { key: 'date', label: 'Date', render: (r) => formatShort(r.task.date) },
    { key: 'stage', label: 'Task stage', render: (r) => <Chip value={r.task.stage} /> },
    { key: 'post', label: 'Post-job checklist', render: (r) => (r.rec ? <span>Done, {r.rec.hours}h</span> : <span className="over">Open</span>) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title={`${greeting()}, ${role.name.split(' ')[0]}`}
        subtitle={kind === 'install' ? 'Your install tasks as team leader or team member.' : 'Your fabrication tasks.'} />

      <div className="kpis">
        <KpiCard icon={ListChecks} label="Today" value={groups[1].list.length} note="tasks scheduled" />
        <KpiCard icon={Hourglass} label="Open tasks" value={open.length} tone="warn" note={`${groups[0].list.length} earlier than today`} />
        <KpiCard icon={CheckCircle2} label="With manager" value={open.filter((t) => t.stage === 'Manager Review').length} note="waiting for approval" />
        <KpiCard icon={Clock} label="Hours booked" value={`${Math.round(booked * 10) / 10}h`} note="across your tasks" />
      </div>

      {kind === 'fab' && <HoursNotFilled person={me} />}

      <CalendarCard title="My calendar" events={events} typeColors={kind === 'install' ? installTypeStyles : fabTypeColors} defaultView="Week" />

      {groups.map((g) => (
        <section key={g.id} className={`myday-group ${g.id === 'late' ? 'late' : ''}`} aria-label={g.title}>
          <h2>{g.title} <span className="count">{g.list.length}</span></h2>
          {g.list.length === 0
            ? <p className="myday-empty">{g.id === 'today' ? 'Nothing scheduled for today.' : 'Nothing here.'}</p>
            : <div className="myday-cols">{g.list.map((t) => <TaskCard key={t.id} task={t} jobName={jobName(t.jobId)} swmsStatus={swmsFor(t)} late={g.id === 'late'} />)}</div>}
        </section>
      ))}
      {post.length > 0 && <Card title="My post-job checklists" flush><ResponsiveTable columns={postCols} rows={post} /></Card>}
    </div>
  );
}
