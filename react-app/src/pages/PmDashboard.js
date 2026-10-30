import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Briefcase, CheckCircle2, Clock, FileSignature, Gauge, Plus, ShieldCheck } from 'lucide-react';
import CalendarCard from '../components/CalendarCard';
import SignSwmsDialog from '../components/SignSwmsDialog';
import { Card, Chip, KpiCard, Modal, PageHeader, ProgressBar, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { CLIENTS, installTypeStyles } from '../data/mockData';
import { fmtStamp, formatShort, fullDate, toKey, today } from '../lib/dates';

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

export default function PmDashboard() {
  const { jobs, swms, tasks, role, signSwms } = useDemo();
  const [signing, setSigning] = useState(null);
  const designTasks = tasks.filter((t) => t.kind === 'design');
  const installTasks = tasks.filter((t) => t.kind === 'install');
  const [showNew, setShowNew] = useState(false);

  const key = todayKey();
  const overdue = designTasks.filter((t) => t.date < key && t.stage !== 'Completed');
  const awaiting = swms.filter((s) => s.status === 'Created');
  const open = swms.filter((s) => s.status !== 'Completed');
  const atRisk = jobs.filter((j) => j.risk).length;
  const booked = jobs.reduce((n, j) => n + j.booked, 0);
  const quoted = jobs.reduce((n, j) => n + j.quoted, 0);
  const pct = quoted ? Math.round((booked / quoted) * 100) : 0;
  const designList = [...designTasks].filter((t) => t.stage !== 'Completed').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);

  const events = installTasks.map((t) => ({ id: t.id, date: t.date, title: t.name, type: t.type }));
  const hoursJobs = jobs.filter((j) => j.quoted > 0);

  const jobColumns = [
    {
      key: 'name', label: 'Job', primary: true,
      render: (j) => (
        <div className="stack">
          <strong>{j.name}</strong>
          <small>{j.id} · {j.client}{j.risk && <span className="risk"> <AlertTriangle size={12} aria-hidden="true" /> {j.risk}</span>}</small>
        </div>
      ),
    },
    { key: 'stage', label: 'Stage', render: (j) => <Chip value={j.stage} tone="gray" /> },
    { key: 'fab', label: '% Fab', render: (j) => <ProgressBar value={j.fab} label="Fab complete" /> },
    { key: 'install', label: '% Install', render: (j) => <ProgressBar value={j.install} tone="blue" label="Install complete" /> },
    { key: 'job', label: '% Job', render: (j) => <ProgressBar value={j.job} tone="ink" label="Job complete" /> },
    { key: 'finish', label: 'Expected finish', render: (j) => formatShort(j.finish) },
  ];

  const swmsFor = (t) => (t.swms === 'Created' ? (swms.find((s) => s.jobId === t.jobId)?.status ?? t.swms) : t.swms);
  const taskColumns = [
    {
      key: 'name', label: 'Task', primary: true,
      render: (t) => (
        <div className="stack">
          <strong><i className="dot" style={{ background: installTypeStyles[t.type] }} /> {t.name}</strong>
          <small>{t.jobId} · {t.type}</small>
        </div>
      ),
    },
    { key: 'date', label: 'Install date', render: (t) => formatShort(t.date) },
    { key: 'leader', label: 'Team leader' },
    { key: 'member', label: 'Team member', render: (t) => t.member || '-' },
    { key: 'swms', label: 'SWMS', render: (t) => <Chip value={swmsFor(t)} /> },
    { key: 'quoted', label: 'Quoted', render: (t) => `${t.quoted}h` },
    { key: 'booked', label: 'Booked', render: (t) => <span className={t.booked > t.quoted ? 'over' : ''}>{t.booked}h</span> },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Project Manager Dashboard">
        <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} aria-hidden="true" /> New job</button>
      </PageHeader>

      <div className="kpis">
        <KpiCard icon={Briefcase} label="Open jobs" value={jobs.length} note={`${atRisk} flagged at risk`} />
        <KpiCard icon={Clock} label="Overdue design tasks" value={overdue.length} tone="danger" note={`of ${designTasks.length} open`} />
        <KpiCard icon={ShieldCheck} label="SWMS awaiting your signature" value={awaiting.length} tone="warn" note="before crews go on site" />
        <KpiCard icon={Gauge} label="Booked vs quoted" value={`${pct}%`} tone={pct > 100 ? 'danger' : 'brand'} note={`${booked} / ${quoted} hrs`}>
          <ProgressBar value={Math.min(pct, 100)} tone={pct > 100 ? 'red' : 'brand'} label="Booked versus quoted hours" />
        </KpiCard>
      </div>

      <Card title="My open jobs" flush action={<Link className="view-all" to="/jobs">View all <ArrowUpRight size={13} aria-hidden="true" /></Link>}>
        <ResponsiveTable columns={jobColumns} rows={jobs} empty="No open jobs" />
      </Card>

      <div className="triple">
        <Card title="Overdue design tasks">
          {designList.length === 0 && <p className="muted">Nothing open.</p>}
          <ul className="task-list">
            {designList.map((t) => {
              const late = t.date < key;
              return (
                <li key={t.id} className={`task-item ${late ? 'late' : ''}`}>
                  <strong>{t.name}</strong>
                  <small>{t.jobId} · {t.owner} · {t.stage}</small>
                  <span className={`due ${late ? 'risk' : ''}`}>{late ? 'Due ' : ''}{formatShort(t.date)}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="SWMS awaiting signature">
          {open.length === 0 && <p className="muted">All SWMS signed.</p>}
          <ul className="swms-list">
            {open.map((s) => (
              <li key={s.id} className="swms-item">
                <div className="swms-top">
                  <div className="stack"><strong>{s.title}</strong><small>{s.id} · {s.jobId} · on site {formatShort(s.onSite)}</small></div>
                  <Chip value={s.status} />
                </div>
                <div className="swms-foot">
                  <span className="tags">{s.hazards.map((h) => <em key={h}>{h}</em>)}</span>
                  {s.status === 'Created' && (
                    <button type="button" className="link-btn" onClick={() => setSigning(s)}><FileSignature size={15} aria-hidden="true" /> Sign as PM</button>
                  )}
                </div>
                {s.pmSignature && (
                  <div className="signed-note">
                    <CheckCircle2 size={14} aria-hidden="true" />
                    <span>Signed by <b>{s.pmSignature.name}</b> ({s.pmSignature.role}) · {fmtStamp(s.pmSignature.signedAt)}</span>
                  </div>
                )}
                {s.status === 'PM Signed' && <small>Awaiting team leader signature</small>}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Booked vs quoted hours">
          <ul className="hours">
            {hoursJobs.map((j) => {
              const max = Math.max(j.booked, j.quoted);
              const over = j.booked > j.quoted;
              return (
                <li key={j.id} title={j.name}>
                  <div className="hours-top"><strong>{j.id}</strong><span className={over ? 'over' : ''}>{j.booked} / {j.quoted} hrs</span></div>
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
      </div>

      <CalendarCard title="Install calendar" events={events} typeColors={installTypeStyles} />

      <Card title="My open install tasks" flush>
        <ResponsiveTable columns={taskColumns} rows={installTasks.filter((t) => t.stage !== 'Completed')} />
      </Card>

      {signing && (
        <SignSwmsDialog record={signing} signer={role} onClose={() => setSigning(null)}
          onSigned={(signer) => { signSwms(signing.id, signer); setSigning(null); }} />
      )}
      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
