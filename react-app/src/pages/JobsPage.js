import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Card, Chip, PageHeader, ProgressBar, ResponsiveTable } from '../components/ui';
import { NewJobModal } from './PmDashboard';
import { useDemo } from '../context/DemoContext';
import { formatShort } from '../lib/dates';

const STAGES = ['All', 'Preparation', 'In Progress', 'On Hold', 'Completed', 'Cancelled'];

export default function JobsPage() {
  const { jobs } = useDemo();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('All');
  const [showNew, setShowNew] = useState(false);

  const rows = jobs.filter((j) =>
    (stage === 'All' || j.stage === stage) && `${j.name} ${j.id} ${j.client}`.toLowerCase().includes(q.toLowerCase()));

  const columns = [
    { key: 'name', label: 'Job', primary: true, render: (j) => (
      <div className="stack"><Link className="job-link" to={`/jobs/${j.id}`}>{j.name}</Link><small>{j.id} · {j.client}</small></div>) },
    { key: 'stage', label: 'Stage', render: (j) => <Chip value={j.stage} /> },
    { key: 'fab', label: 'Fab', render: (j) => <ProgressBar value={j.fab} label="Fab complete" /> },
    { key: 'install', label: 'Install', render: (j) => <ProgressBar value={j.install} tone="blue" label="Install complete" /> },
    { key: 'job', label: 'Job', render: (j) => <ProgressBar value={j.job} tone="ink" label="Job complete" /> },
    { key: 'hours', label: 'Hours', render: (j) => <span className={j.booked > j.quoted && j.quoted ? 'over' : ''}>{j.booked} / {j.quoted}</span> },
    { key: 'finish', label: 'Expected finish', render: (j) => formatShort(j.finish) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow="Jobs" title="All jobs" subtitle={`${rows.length} of ${jobs.length} shown`}>
        <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} aria-hidden="true" /> New job</button>
      </PageHeader>
      <div className="filters">
        <label className="search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, number or company" aria-label="Filter jobs" />
        </label>
        <div className="segmented" role="tablist" aria-label="Stage filter">
          {STAGES.map((s) => <button key={s} type="button" role="tab" aria-selected={stage === s} className={stage === s ? 'on' : ''} onClick={() => setStage(s)}>{s}</button>)}
        </div>
      </div>
      <Card flush><ResponsiveTable columns={columns} rows={rows} empty="No jobs match" /></Card>
      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
