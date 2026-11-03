import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { Card, Chip, PageHeader, ProgressBar, ResponsiveTable } from '../components/ui';
import { NewJobModal } from './PmDashboard';
import { useDemo } from '../context/DemoContext';
import { formatShort } from '../lib/dates';
import { JOB_TABS, filterJobs, matchesTab } from '../lib/jobs';

const STAGES = ['All', 'Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];

const EMPTY = {
  myOpen: 'You have no open jobs. Jobs show here when you are the Project Manager or Fab Manager.',
  mine: 'You are not the Project Manager or Fab Manager on any job.',
};

// JOB-2: tabs (All, My Open, My Jobs, Preparation, Ongoing, Completed) plus stage, PM and fab manager filters.
export default function JobsPage() {
  const { jobs, role, roleId } = useDemo();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [stage, setStage] = useState('All');
  const [pm, setPm] = useState('All');
  const [fabManager, setFabManager] = useState('All');
  const [showNew, setShowNew] = useState(false);

  const person = role.name;
  const pms = useMemo(() => [...new Set(jobs.map((j) => j.pm).filter(Boolean))].sort(), [jobs]);
  const fabManagers = useMemo(() => [...new Set(jobs.map((j) => j.fabManager).filter(Boolean))].sort(), [jobs]);
  const rows = filterJobs(jobs, { tab, person, stage, pm, fabManager, q });

  const columns = [
    { key: 'name', label: 'Job', primary: true, render: (j) => (
      <div className="stack"><Link className="job-link" to={`/jobs/${j.id}`}>{j.name}</Link><small>{j.id} · {j.client}</small></div>) },
    { key: 'stage', label: 'Stage', render: (j) => <Chip value={j.stage} /> },
    { key: 'people', label: 'PM / Fab manager', render: (j) => (
      <div className="stack"><span>{j.pm || '-'}</span><small>{j.fabManager || '-'}</small></div>) },
    { key: 'fab', label: 'Fab', render: (j) => <ProgressBar value={j.fab} label="Fab complete" /> },
    { key: 'install', label: 'Install', render: (j) => <ProgressBar value={j.install} tone="blue" label="Install complete" /> },
    { key: 'job', label: 'Job', render: (j) => <ProgressBar value={j.job} tone="ink" label="Job complete" /> },
    { key: 'hours', label: 'Hours', render: (j) => <span className={j.booked > j.quoted && j.quoted ? 'over' : ''}>{j.booked} / {j.quoted}</span> },
    { key: 'finish', label: 'Expected finish', render: (j) => formatShort(j.finish) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow="Jobs" title="All jobs" subtitle={`${rows.length} of ${jobs.length} shown`}>
        {roleId !== 'viewer' && <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={16} aria-hidden="true" /> New job</button>}
      </PageHeader>

      <div className="tabs" role="tablist" aria-label="Job lists">
        {JOB_TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label} <span>{jobs.filter((j) => matchesTab(j, t.id, person)).length}</span>
          </button>
        ))}
      </div>

      <div className="filters">
        <label className="search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, number or company" aria-label="Filter jobs" />
        </label>
        <label className="filter-select"><span>Stage</span>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="filter-select"><span>PM</span>
          <select value={pm} onChange={(e) => setPm(e.target.value)}><option>All</option>{pms.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
        <label className="filter-select"><span>Fab manager</span>
          <select value={fabManager} onChange={(e) => setFabManager(e.target.value)}><option>All</option>{fabManagers.map((p) => <option key={p}>{p}</option>)}</select>
        </label>
      </div>
      <Card flush><ResponsiveTable columns={columns} rows={rows} empty={EMPTY[tab] || 'No jobs match'} /></Card>
      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
