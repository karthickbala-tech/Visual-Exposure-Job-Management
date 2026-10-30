import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, Hourglass, ListChecks, MapPin, Users } from 'lucide-react';
import { Chip, KpiCard, PageHeader } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { formatShort, fullDate, greeting, toKey, today } from '../lib/dates';
import { MAX_ENTRY_HOURS, SUBSTAGES, TRANSITIONS } from '../lib/workflow';
import './MyDay.css';

// Fab Worker and Installer home: "my" tasks only, big touch targets, one clear next step.
const KIND_FOR_ROLE = { fabWorker: 'fab', installer: 'install' };
const shortName = (full) => {
  const [first, last = ''] = full.split(' ');
  return `${first} ${last.charAt(0)}.`;
};

function TaskCard({ task, jobName, swmsStatus, late }) {
  const { setSubStage, actOnTask, bookHours } = useDemo();
  const [hours, setHours] = useState('');
  const [error, setError] = useState('');

  const isInstall = task.kind === 'install';
  const inProgress = task.stage === 'In Progress';
  const subIdx = SUBSTAGES.indexOf(task.subStage);
  const nextSub = SUBSTAGES[subIdx + 1];
  const finished = !isInstall || subIdx === SUBSTAGES.length - 1;
  const steps = (TRANSITIONS[task.stage] || []).filter((s) => !s.manager);
  const sentBack = task.stage === 'Rejected' || task.stage === 'Reopen';

  const blocked = (step) => {
    if (step.action !== 'Submit for approval') return '';
    if (!finished) return 'Mark Finished On Site first';
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
        {isInstall && inProgress && nextSub && (
          <button type="button" className="btn btn-primary" onClick={() => setSubStage(task.id, nextSub)}>Mark: {nextSub}</button>
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

      {inProgress && (
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
  const { roleId, role, tasks, jobs, swms } = useDemo();
  const kind = KIND_FOR_ROLE[roleId];
  const me = shortName(role.name);
  const key = toKey(today());

  const mine = tasks.filter((t) => t.kind === kind && [t.leader, t.member].includes(me));
  const open = mine.filter((t) => t.stage !== 'Completed' && t.stage !== 'Cancelled');
  const groups = [
    { id: 'late', title: 'Earlier and still open', list: open.filter((t) => t.date < key) },
    { id: 'today', title: 'Today', list: open.filter((t) => t.date === key) },
    { id: 'soon', title: 'Coming up', list: open.filter((t) => t.date > key).sort((a, b) => a.date.localeCompare(b.date)) },
  ];
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const swmsFor = (t) => (t.swms === 'Created' ? (swms.find((s) => s.jobId === t.jobId)?.status ?? t.swms) : t.swms);
  const booked = mine.reduce((n, t) => n + (t.booked || 0), 0);

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

      {groups.map((g) => (
        <section key={g.id} className={`myday-group ${g.id === 'late' ? 'late' : ''}`} aria-label={g.title}>
          <h2>{g.title} <span className="count">{g.list.length}</span></h2>
          {g.list.length === 0
            ? <p className="myday-empty">{g.id === 'today' ? 'Nothing scheduled for today.' : 'Nothing here.'}</p>
            : <div className="myday-cols">{g.list.map((t) => <TaskCard key={t.id} task={t} jobName={jobName(t.jobId)} swmsStatus={swmsFor(t)} late={g.id === 'late'} />)}</div>}
        </section>
      ))}
    </div>
  );
}
