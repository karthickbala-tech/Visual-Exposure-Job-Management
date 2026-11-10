import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Briefcase, Clock, Gauge, Plus, ShieldCheck } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import SignSwmsDialog from '../components/SignSwmsDialog';
import { Card, KpiCard, Modal, PageHeader } from '../components/ui';
import KpiLink from '../components/KpiLink';
import ToDoList from '../components/ToDoList';
import TaskList from '../components/TaskList';
import TaskDrawer from '../components/TaskDrawer';
import { MiniBar, SavedViews } from '../components/ListKit';
import { StageBadge } from '../components/StageBadge';
import { AssignDesignerModal, DeleteTaskModal, ScheduleModal, TaskEditModal } from '../components/TaskForms';
import { useDemo } from '../context/DemoContext';
import { useNavigate } from 'react-router-dom';
import { CLOSED_STAGES } from '../lib/workflow';
import { CLIENTS, installTypeStyles } from '../data/mockData';
import { formatShort, fullDate, toKey, today } from '../lib/dates';

const todayKey = () => toKey(today());

export function NewJobModal({ onClose }) {
  const { addJob } = useDemo();
  const [form, setForm] = useState({ name: '', client: CLIENTS[0], finish: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.finish) return setError('Job name and expected finish date are required.');
    if (form.finish < todayKey()) return setError('Expected finish cannot be in the past.');
    addJob({ name: form.name.trim(), client: form.client, finish: form.finish });
    return onClose();
  };

  return (
    <Modal title="New job" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Job name
          <input autoFocus value={form.name} onChange={set('name')} placeholder="e.g. Harbour Plaza Pylon" />
        </label>
        <label>Company
          <select value={form.client} onChange={set('client')}>{CLIENTS.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label>Expected job finish
          <input type="date" min={todayKey()} value={form.finish} onChange={set('finish')} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create job</button>
        </div>
      </form>
    </Modal>
  );
}

// PM home: what needs the PM now (one button each), then their open jobs, then hours, calendar and
// install tasks one tab away. Everything that was on this page is still here.
export default function PmDashboard() {
  const { jobs, swms, tasks, role, signSwms } = useDemo();
  const navigate = useNavigate();
  const [signing, setSigning] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [req, setReq] = useState(null);
  const [more, setMore] = useState('hours');
  const [installView, setInstallView] = useState('all');

  const key = todayKey();
  const me = role.name;
  const isOpen = (t) => !CLOSED_STAGES.includes(t.stage);
  const myJobs = jobs.filter((j) => j.pm === me && !['Completed', 'Completed - Closed', 'Cancelled'].includes(j.stage));
  const mineIds = new Set(myJobs.map((j) => j.id));
  const designTasks = tasks.filter((t) => t.kind === 'design');
  const installTasks = tasks.filter((t) => t.kind === 'install');
  const overdueDesign = designTasks.filter((t) => isOpen(t) && t.date < key);
  const awaiting = swms.filter((s) => s.status === 'Created');
  const review = tasks.filter((t) => t.stage === 'Manager Review' && mineIds.has(t.jobId));
  const unscheduled = installTasks.filter((t) => t.stage === 'Awaiting Scheduling' && mineIds.has(t.jobId));
  const atRisk = jobs.filter((j) => j.risk);
  const booked = jobs.reduce((n, j) => n + j.booked, 0);
  const quoted = jobs.reduce((n, j) => n + j.quoted, 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;

  const todo = [
    ...awaiting.map((s) => ({ id: `sw-${s.id}`, tone: 'danger', title: `Sign SWMS: ${s.title}`, detail: `${s.jobId} · on site ${formatShort(s.onSite)} · ${s.hazards.join(', ')}`, action: { label: 'Sign as PM', onClick: () => setSigning(s) } })),
    ...review.map((t) => ({ id: `rv-${t.id}`, tone: 'warn', title: `Review: ${t.name}`, detail: `${t.jobId} · ${jobName(t.jobId)} · ready for approval`, action: { label: 'Review', onClick: () => setOpenId(t.id) } })),
    ...unscheduled.map((t) => ({ id: `sc-${t.id}`, tone: 'info', title: `Schedule: ${t.name}`, detail: `${t.jobId} · install ${formatShort(t.date)} · needs a crew`, action: { label: 'Schedule', onClick: () => setReq({ kind: 'schedule', task: t }) } })),
    ...overdueDesign.map((t) => ({ id: `ds-${t.id}`, tone: 'danger', title: `Overdue design: ${t.name}`, detail: `${t.jobId} · ${t.owner || 'no designer'} · due ${formatShort(t.date)}`, action: { label: 'Open', onClick: () => setOpenId(t.id) } })),
    ...atRisk.filter((j) => j.pm === me).map((j) => ({ id: `jr-${j.id}`, tone: 'warn', title: `${j.name}: ${j.risk}`, detail: `${j.id} · finish ${formatShort(j.finish)}`, action: { label: 'Open job', to: `/jobs/${j.id}` } })),
  ];

  const events = installTasks.map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));
  const hoursJobs = jobs.filter((j) => j.quoted > 0);
  const openInstall = installTasks.filter(isOpen).sort((a, b) => a.date.localeCompare(b.date));
  const fresh = (t) => tasks.find((x) => x.id === t.id) || t;

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Project Manager Dashboard">
        <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} aria-hidden="true" /> New job</button>
      </PageHeader>

      <div className="kpis">
        <KpiLink icon={Briefcase} label="Open jobs" value={jobs.length} note={`${atRisk.length} flagged at risk`} onClick={() => navigate('/jobs')} />
        <KpiLink icon={Clock} label="Overdue design tasks" value={overdueDesign.length} tone="danger" note={`of ${designTasks.length} design tasks`} onClick={() => navigate('/design')} />
        <KpiLink icon={ShieldCheck} label="SWMS awaiting your signature" value={awaiting.length} tone="warn" note="before crews go on site" onClick={() => navigate('/swms')} />
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${booked} / ${quoted} hrs`} />
      </div>

      <ToDoList items={todo} />

      <Card title="My open jobs" flush action={<Link className="view-all" to="/jobs">View all <ArrowUpRight size={13} aria-hidden="true" /></Link>}>
        <ul className="ui-scope m-0 list-none p-0 font-sans">
          {(myJobs.length ? myJobs : jobs).slice(0, 6).map((j) => (
            <li key={j.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-1 border-b px-5 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_10rem_5rem]">
              <div className="min-w-0"><Link className="font-semibold text-foreground no-underline hover:underline" to={`/jobs/${j.id}`}>{j.name}</Link>
                <div className="text-xs text-muted-foreground">{j.id} · {j.client}{j.risk && <span className="font-semibold text-destructive"> · {j.risk}</span>}</div></div>
              <StageBadge stage={j.stage} className="w-fit" />
              <MiniBar value={j.job} label="Job complete" />
              <span className={`text-sm ${j.finish < key ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>{formatShort(j.finish)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="ui-scope font-sans">
        <SavedViews label="More" value={more} onChange={setMore} views={[{ id: 'hours', label: 'Booked vs quoted hours' }, { id: 'calendar', label: 'Install calendar' }, { id: 'install', label: 'Open install tasks' }]} />
      </div>
      {more === 'hours' && (
        <Card title="Booked vs quoted hours">
          <ul className="hours">
            {hoursJobs.map((j) => {
              const max = Math.max(j.booked, j.quoted);
              const over = j.booked > j.quoted;
              return (
                <li key={j.id} title={j.name}>
                  <div className="hours-top"><strong>{j.id} · {j.name}</strong><span className={over ? 'over' : ''}>{j.booked} / {j.quoted} hrs</span></div>
                  <div className="hours-bar" aria-hidden="true">
                    <div className="hours-quote" style={{ width: `${(j.quoted / max) * 100}%` }} />
                    <div className={`hours-fill ${over ? 'bar-red' : 'bar-brand'}`} style={{ width: `${(j.booked / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="legend-note"><i className="sq sq-brand" /> Booked <i className="sq sq-red" /> Over quote <i className="tick" /> Quoted</p>
        </Card>
      )}
      {more === 'calendar' && <CalendarCard title="Install calendar" events={events} typeColors={installTypeStyles} />}
      {more === 'install' && (
        <TaskList title="Open install tasks" views={[{ id: 'all', label: 'All open', rows: openInstall }, { id: 'mine', label: 'My jobs', rows: openInstall.filter((t) => mineIds.has(t.jobId)) }]}
          view={installView} onView={setInstallView} typeColors={installTypeStyles} jobName={jobName} />
      )}

      <TaskDrawer task={tasks.find((t) => t.id === openId) || null} onClose={() => setOpenId(null)} onRequest={(kind, task) => { setOpenId(null); setReq({ kind, task }); }} />
      {req?.kind === 'schedule' && <ScheduleModal task={fresh(req.task)} onClose={() => setReq(null)} />}
      {req?.kind === 'edit' && <TaskEditModal task={fresh(req.task)} onClose={() => setReq(null)} />}
      {req?.kind === 'assign' && <AssignDesignerModal task={fresh(req.task)} onClose={() => setReq(null)} />}
      {req?.kind === 'delete' && <DeleteTaskModal task={req.task} onClose={() => setReq(null)} />}
      {signing && (
        <SignSwmsDialog record={signing} signer={role} onClose={() => setSigning(null)}
          onSigned={(signer) => { signSwms(signing.id, signer); setSigning(null); }} />
      )}
      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
