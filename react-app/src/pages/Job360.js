import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderOpen, Lock } from 'lucide-react';
import ApprovalPanel from '../components/ApprovalPanel';
import JobSitePanel from '../components/JobSitePanel';
import { Card, Chip, Modal, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { formatShort, toKey, today } from '../lib/dates';
import { KPI_GROUPS, canCloseJob, isClosedJob, jobStats } from '../lib/jobs';
import './Job360.css';

const TABS = [{ id: 'design', label: 'Design' }, { id: 'fab', label: 'Fab' }, { id: 'install', label: 'Install' }];

function Ring({ value }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 88 88" role="img" aria-label={`${value}% complete`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" className="ring-text">{value}%</text>
    </svg>
  );
}

export default function Job360() {
  const { jobId } = useParams();
  const { allJobs: jobs, tasks, notify, roleId, closeJob } = useDemo();
  const [tab, setTab] = useState('design');
  const [selectedId, setSelectedId] = useState(null);
  const [closing, setClosing] = useState(false);

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return <PlaceholderPage title="Job not found" blurb="That job does not exist in the demo data." />;

  const jobTasks = tasks.filter((t) => t.jobId === job.id);
  const stats = jobStats(jobTasks, toKey(today()));
  const closeCheck = canCloseJob(job, roleId);
  const closed = isClosedJob(job);
  const inReview = jobTasks.filter((t) => t.stage === 'Manager Review').length;
  const tabTasks = jobTasks.filter((t) => t.kind === tab);
  const selected = tabTasks.find((t) => t.id === selectedId) || tabTasks[0];
  const people = (t) => t.owner || [t.leader, t.member].filter(Boolean).join(', ') || '-';

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => (
      <button type="button" className={`task-pick ${selected && selected.id === t.id ? 'on' : ''}`} onClick={() => setSelectedId(t.id)}>
        <strong>{t.name}</strong><small>{t.type || t.kind}</small>
      </button>) },
    { key: 'date', label: tab === 'design' ? 'Due' : 'Date', render: (t) => formatShort(t.date) },
    { key: 'people', label: 'People', render: people },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Booked / quoted', render: (t) => (t.quoted ? `${t.booked}h / ${t.quoted}h` : '-') },
  ];

  return (
    <div className="dash">
      <Link to="/jobs" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All jobs</Link>

      <section className="job-head card">
        <Ring value={job.job} />
        <div className="job-head-main">
          <p className="eyebrow">{job.id} · {job.client}</p>
          <h1>{job.name}</h1>
          <div className="job-meta">
            <Chip value={job.stage} />
            <span>Expected finish <strong>{formatShort(job.finish)}</strong></span>
            <span className="mono"><FolderOpen size={14} aria-hidden="true" /> {`\\\\VE-SERVER\\Jobs\\${job.id}`}</span>
          </div>
          <div className="job-meta">
            <span>Fab finish required <strong>{job.fabRequired ? formatShort(job.fabRequired) : '-'}</strong></span>
            <span>Fab finish agreed <strong>{job.fabAgreed ? formatShort(job.fabAgreed) : 'not agreed yet'}</strong></span>
            {job.pm && <span>PM <strong>{job.pm}</strong></span>}
            {job.fabManager && <span>Fab manager <strong>{job.fabManager}</strong></span>}
          </div>
          {job.risk && <p className="risk">{job.risk}</p>}
        </div>
        <div className="job-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the Zoho CRM deal (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to deal</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the WorkDrive folder (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to WorkDrive</button>
          {closed
            ? <span className="closed-note"><Lock size={14} aria-hidden="true" /> Closed {job.closedAt ? formatShort(job.closedAt) : ''}{job.closedBy ? ` by ${job.closedBy}` : ''}</span>
            : <button type="button" className="btn btn-primary btn-sm" disabled={!closeCheck.ok} title={closeCheck.ok ? '' : closeCheck.reason} onClick={() => setClosing(true)}>Close job</button>}
        </div>
      </section>

      <section className="job-kpis" aria-label="Job KPIs">
        {KPI_GROUPS.map((g) => {
          const k = stats[g.kind];
          return (
            <div key={g.kind} className="job-kpi card">
              <h2>{g.label}</h2>
              <dl>
                <div><dt>Total</dt><dd>{k.total}</dd></div>
                <div><dt>Open</dt><dd>{k.open}</dd></div>
                <div><dt>Overdue</dt><dd className={k.overdue > 0 ? 'over' : ''}>{k.overdue}</dd></div>
                <div><dt>Complete</dt><dd>{k.pct}%</dd></div>
              </dl>
            </div>
          );
        })}
      </section>

      <JobSitePanel jobId={job.id} />

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''}
            onClick={() => { setTab(t.id); setSelectedId(null); }}>
            {t.label} <span>{jobTasks.filter((x) => x.kind === t.id).length}</span>
          </button>
        ))}
      </div>

      <div className="split">
        <Card flush><ResponsiveTable columns={columns} rows={tabTasks} empty={`No ${tab} tasks for this job yet`} /></Card>
        <Card title="Approval">{selected ? <ApprovalPanel key={selected.id} task={selected} /> : <p className="muted">Select a task to see its progress and actions.</p>}</Card>
      </div>
      {closing && (
        <Modal title="Close this job?" onClose={() => setClosing(false)}>
          <div className="form">
            <p>{job.name} is {job.job}% complete. Closing sets the stage to Completed - Closed, sends the closure report email once and updates the CRM deal (demo). No more tasks can be added after that.</p>
            {inReview > 0 && <p className="form-error">{inReview} task{inReview > 1 ? 's are' : ' is'} still in Manager Review. Closing now will not wait for approval.</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setClosing(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => { closeJob(job.id); setClosing(false); }}>Close job</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
