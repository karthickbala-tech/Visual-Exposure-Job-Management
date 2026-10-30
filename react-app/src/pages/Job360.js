import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderOpen } from 'lucide-react';
import ApprovalPanel from '../components/ApprovalPanel';
import { Card, Chip, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { formatShort } from '../lib/dates';

const TABS = [{ id: 'design', label: 'Design' }, { id: 'fab', label: 'Fab' }, { id: 'install', label: 'Install' }];

function Ring({ value }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 88 88" role="img" aria-label={`${value}% complete`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#e8ecea" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" className="ring-text">{value}%</text>
    </svg>
  );
}

export default function Job360() {
  const { jobId } = useParams();
  const { jobs, tasks, notify } = useDemo();
  const [tab, setTab] = useState('design');
  const [selectedId, setSelectedId] = useState(null);

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return <PlaceholderPage title="Job not found" blurb="That job does not exist in the demo data." />;

  const jobTasks = tasks.filter((t) => t.jobId === job.id);
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
          {job.risk && <p className="risk">{job.risk}</p>}
        </div>
        <div className="job-head-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the Zoho CRM deal (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to deal</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the WorkDrive folder (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to WorkDrive</button>
        </div>
      </section>

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
    </div>
  );
}
