import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, ExternalLink, FolderOpen, Plus, Search } from 'lucide-react';
import { Button } from '../components/ui-kit/button';
import { Checkbox } from '../components/ui-kit/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui-kit/dialog';
import { Chip } from '../components/ui';
import { BulkBar, FilterPanel, FilterSelect, RowMenu } from '../components/ListKit';
import { PageHeader } from '../components/ui';
import { NewJobModal } from './PmDashboard';
import { useDemo } from '../context/DemoContext';
import { formatShort, toKey, today } from '../lib/dates';
import { JOB_TABS, filterJobs } from '../lib/jobs';
import { cn } from '../lib/utils';
import './JobsWeb.css';

const STAGES = ['All', 'Preparation', 'In Progress', 'On Hold', 'Completed', 'Completed - Closed', 'Cancelled'];
const SET_STAGES = ['Preparation', 'In Progress', 'On Hold'];
const OPEN = (j) => !['Completed', 'Completed - Closed', 'Cancelled'].includes(j.stage);

const EMPTY = {
  myOpen: 'You have no open jobs. Jobs show here when you are the Project Manager or Fab Manager.',
  mine: 'You are not the Project Manager or Fab Manager on any job.',
};

function exportCsv(rows) {
  const head = ['Job', 'Name', 'Company', 'Stage', 'PM', 'Fab manager', 'Job %', 'Fab %', 'Install %', 'Booked h', 'Quoted h', 'Expected finish'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head, ...rows.map((j) => [j.id, j.name, j.client, j.stage, j.pm, j.fabManager, j.job, j.fab, j.install, j.booked, j.quoted, j.finish])].map((r) => r.map(esc).join(',')).join('\n');
  try {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'jobs.csv'; a.click(); URL.revokeObjectURL(url);
  } catch (e) { /* not available in tests */ }
}

// JOB-2: saved views (All, My Open, My Jobs, Preparation, Ongoing, Completed), search, and stage / PM / fab manager
// filters behind one "Filters" button. Managers can tick jobs to change their stage or export them.
export default function JobsPage() {
  const { jobs, role, roleId, updateJob, notify } = useDemo();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState('all');
  const [stage, setStage] = useState('All');
  const [pm, setPm] = useState('All');
  const [fabManager, setFabManager] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState([]);
  const [bulkStage, setBulkStage] = useState(null);

  const person = role.name;
  const canManage = ['admin', 'pm'].includes(roleId);
  const pms = useMemo(() => [...new Set(jobs.map((j) => j.pm).filter(Boolean))].sort(), [jobs]);
  const fabManagers = useMemo(() => [...new Set(jobs.map((j) => j.fabManager).filter(Boolean))].sort(), [jobs]);
  const rows = filterJobs(jobs, { tab, person, stage, pm, fabManager, q });
  const key = toKey(today());
  const late = (j) => OPEN(j) && j.finish && j.finish < key;
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allTicked = rows.length > 0 && rows.every((j) => selected.includes(j.id));
  const picked = jobs.filter((j) => selected.includes(j.id));

  const menu = (j) => [
    { label: 'Open job', onSelect: () => navigate(`/jobs/${j.id}`) },
    { label: 'Go to CRM deal', icon: ExternalLink, onSelect: () => notify('Opens the Zoho CRM deal (demo)') },
    { label: 'Open WorkDrive folder', icon: FolderOpen, onSelect: () => notify('Opens the WorkDrive folder (demo)') },
  ];

  const tabs = JOB_TABS.map((t) => ({ id: t.id, label: t.label }));

  return (
    <div className="ui-scope wjobs grid min-w-0 gap-4 font-sans [&>*]:min-w-0">
      <PageHeader eyebrow="Projects" title="Jobs" subtitle="Every job from deal to finished install.">
        {roleId !== 'viewer' && <button type="button" className="wbtn" onClick={() => setShowNew(true)}><Plus size={16} aria-hidden="true" /> New job</button>}
      </PageHeader>

      <section className="wcard">
        <div className="wtabs-row">
          <div className="wseg" role="tablist" aria-label="Job lists">
            {tabs.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => { setTab(t.id); setSelected([]); }}>{t.label}</button>
            ))}
          </div>
        </div>

        <div className="wfilters" role="group" aria-label="Filter jobs">
          <label className="wsearch">
            <Search size={16} aria-hidden="true" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name or deal" aria-label="Filter jobs" />
          </label>
          <label className="filter-select wfield">
            <span>Stage</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((x) => <option key={x} value={x}>{x === 'All' ? 'All stages' : x}</option>)}
            </select>
          </label>
          <FilterPanel active={[pm, fabManager].filter((v) => v !== 'All').length} onClear={() => { setPm('All'); setFabManager('All'); }}>
            <FilterSelect label="PM" value={pm} onChange={setPm} options={['All', ...pms]} />
            <FilterSelect label="Fab manager" value={fabManager} onChange={setFabManager} options={['All', ...fabManagers]} />
          </FilterPanel>
        </div>

        {canManage && selected.length > 0 && (
          <div className="wbulk">
            <BulkBar count={selected.length} onClear={() => setSelected([])}>
              <Button size="sm" variant="outline" onClick={() => setBulkStage('In Progress')}>Change stage</Button>
              <Button size="sm" variant="outline" onClick={() => { exportCsv(picked); notify(`Exported ${picked.length} job${picked.length > 1 ? 's' : ''} to CSV`); }}><Download /> Export CSV</Button>
            </BulkBar>
          </div>
        )}

        {rows.length === 0 && <p className="wempty">{q ? 'No jobs match that search.' : EMPTY[tab] || 'No jobs to show.'}</p>}

        {rows.length > 0 && (
          <div className="wtable-wrap">
            <table className="wtable">
              <caption className="sr-only">Jobs</caption>
              <thead>
                <tr>
                  {canManage && <th className="wcheck"><Checkbox checked={allTicked} onCheckedChange={() => setSelected(allTicked ? [] : rows.map((j) => j.id))} aria-label="Select all jobs" /></th>}
                  <th scope="col">Job</th><th scope="col">Stage</th><th scope="col">PM / Fab manager</th><th scope="col">Progress</th><th scope="col">Hours</th><th scope="col">Expected finish</th><th scope="col" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const over = j.quoted && j.booked > j.quoted;
                  return (
                    <tr key={j.id} className={cn(selected.includes(j.id) && 'is-selected')} onClick={() => navigate(`/jobs/${j.id}`)}>
                      {canManage && <td className="wcheck" data-label="Select" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.includes(j.id)} onCheckedChange={() => toggle(j.id)} aria-label={`Select ${j.name}`} /></td>}
                      <td data-label="Job" className="cell-primary">
                        <Link className="job-link" to={`/jobs/${j.id}`} onClick={(e) => e.stopPropagation()}>{j.name}</Link>
                        <small>{j.id} · {j.client}</small>
                        {j.risk && <small className="wrisk"><AlertTriangle size={12} aria-hidden="true" /> {j.risk}</small>}
                      </td>
                      <td data-label="Stage"><Chip value={j.stage} /></td>
                      <td data-label="PM / Fab manager"><span>{j.pm || '-'}</span><small>{j.fabManager || '-'}</small></td>
                      <td data-label="Progress">
                        <div className="wprogress" title={`Fab ${j.fab}% · Install ${j.install}%`}>
                          <span className="wprogress-track"><span style={{ width: `${Math.min(100, j.job)}%` }} /></span>
                          <span className="wprogress-value">{j.job}%</span>
                        </div>
                      </td>
                      <td data-label="Hours" className={cn(over && 'is-over')}>{j.booked} / {j.quoted}h</td>
                      <td data-label="Expected finish" className={cn(late(j) && 'is-over')}>{j.finish ? formatShort(j.finish) : '-'}</td>
                      <td data-label="" className="wmenu" onClick={(e) => e.stopPropagation()}><RowMenu label={`More for ${j.name}`} items={menu(j)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showNew && <NewJobModal onClose={() => setShowNew(false)} />}
      <Dialog open={!!bulkStage} onOpenChange={(o) => { if (!o) setBulkStage(null); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Change stage</DialogTitle><DialogDescription>{picked.length} job{picked.length > 1 ? 's' : ''}: {picked.map((j) => j.id).join(', ')}</DialogDescription></DialogHeader>
          <div className="form" style={{ padding: 0 }}>
            <label>New stage<select value={bulkStage || ''} onChange={(e) => setBulkStage(e.target.value)}>{SET_STAGES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <small>Completed and Closed are set by the tasks and by Close job, so they are not offered here.</small>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkStage(null)}>Cancel</Button>
            <Button onClick={() => { picked.filter(OPEN).forEach((j) => updateJob(j.id, { stage: bulkStage })); notify(`Stage set to ${bulkStage} on ${picked.filter(OPEN).length} job(s)`); setBulkStage(null); setSelected([]); }}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
