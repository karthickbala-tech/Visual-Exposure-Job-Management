import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Download, ExternalLink, FolderOpen, Plus } from 'lucide-react';
import { Card } from '../components/ui-kit/card';
import { Button } from '../components/ui-kit/button';
import { Checkbox } from '../components/ui-kit/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui-kit/dialog';
import { StageBadge } from '../components/StageBadge';
import { BulkBar, EmptyState, FilterPanel, FilterSelect, MiniBar, RowMenu, SavedViews, SearchBox } from '../components/ListKit';
import { PageHeader } from '../components/ui';
import { NewJobModal } from './PmDashboard';
import { useDemo } from '../context/DemoContext';
import { formatShort, toKey, today } from '../lib/dates';
import { JOB_TABS, filterJobs, matchesTab } from '../lib/jobs';
import { cn } from '../lib/utils';

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
  const active = [stage, pm, fabManager].filter((v) => v !== 'All').length;
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

  return (
    <div className="ui-scope grid min-w-0 gap-4 font-sans [&>*]:min-w-0">
      <PageHeader eyebrow="Jobs" title="All jobs" subtitle={`${rows.length} of ${jobs.length} shown`}>
        {roleId !== 'viewer' && <Button onClick={() => setShowNew(true)}><Plus /> New job</Button>}
      </PageHeader>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
          <SavedViews label="Job lists" value={tab} onChange={(v) => { setTab(v); setSelected([]); }}
            views={JOB_TABS.map((t) => ({ id: t.id, label: t.label, count: jobs.filter((j) => matchesTab(j, t.id, person)).length }))} />
          <SearchBox value={q} onChange={setQ} placeholder="Search name, number or company" label="Filter jobs" />
          <FilterPanel active={active} onClear={() => { setStage('All'); setPm('All'); setFabManager('All'); }}>
            <FilterSelect label="Stage" value={stage} onChange={setStage} options={STAGES} />
            <FilterSelect label="PM" value={pm} onChange={setPm} options={['All', ...pms]} />
            <FilterSelect label="Fab manager" value={fabManager} onChange={setFabManager} options={['All', ...fabManagers]} />
          </FilterPanel>
        </div>

        {canManage && selected.length > 0 && (
          <div className="px-3 pt-3 sm:px-4">
            <BulkBar count={selected.length} onClear={() => setSelected([])}>
              <Button size="sm" variant="outline" onClick={() => setBulkStage('In Progress')}>Change stage</Button>
              <Button size="sm" variant="outline" onClick={() => { exportCsv(picked); notify(`Exported ${picked.length} job${picked.length > 1 ? 's' : ''} to CSV`); }}><Download /> Export CSV</Button>
            </BulkBar>
          </div>
        )}

        {rows.length === 0 && <EmptyState>{EMPTY[tab] || 'No jobs match. Try another view or clear the filters.'}</EmptyState>}

        {rows.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                  {canManage && <th className="w-10 py-2 pl-4"><Checkbox checked={allTicked} onCheckedChange={() => setSelected(allTicked ? [] : rows.map((j) => j.id))} aria-label="Select all jobs" /></th>}
                  <th className={cn('py-2 pr-3', !canManage && 'pl-4')}>Job</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">PM / Fab manager</th>
                  <th className="py-2 pr-3">Progress</th><th className="py-2 pr-3">Hours</th><th className="py-2 pr-3">Finish</th><th className="w-12 py-2 pr-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const over = j.quoted && j.booked > j.quoted;
                  return (
                    <tr key={j.id} className={cn('group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/40', selected.includes(j.id) && 'bg-accent/60')} onClick={() => navigate(`/jobs/${j.id}`)}>
                      {canManage && <td className="py-3 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.includes(j.id)} onCheckedChange={() => toggle(j.id)} aria-label={`Select ${j.name}`} /></td>}
                      <td className={cn('py-3 pr-3', !canManage && 'pl-4')}>
                        <Link className="job-link font-semibold text-foreground no-underline hover:underline" to={`/jobs/${j.id}`} onClick={(e) => e.stopPropagation()}>{j.name}</Link>
                        <div className="text-xs text-muted-foreground">{j.id} · {j.client}</div>
                        {j.risk && <div className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-destructive"><AlertTriangle className="h-3 w-3" /> {j.risk}</div>}
                      </td>
                      <td className="py-3 pr-3"><StageBadge stage={j.stage} /></td>
                      <td className="py-3 pr-3"><div>{j.pm || '-'}</div><div className="text-xs text-muted-foreground">{j.fabManager || '-'}</div></td>
                      <td className="py-3 pr-3"><MiniBar value={j.job} label="Job complete" /><div className="mt-1 text-[11px] text-muted-foreground">Fab {j.fab}% · Install {j.install}%</div></td>
                      <td className={cn('py-3 pr-3 whitespace-nowrap', over && 'font-semibold text-destructive')}>{j.booked} / {j.quoted}h</td>
                      <td className={cn('py-3 pr-3 whitespace-nowrap', late(j) && 'font-semibold text-destructive')}>{formatShort(j.finish)}</td>
                      <td className="py-3 pr-4 text-right"><RowMenu label={`More for ${j.name}`} items={menu(j)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-2 p-3 md:hidden">
          {rows.map((j) => (
            <Link key={j.id} to={`/jobs/${j.id}`} className="grid gap-2 rounded-lg border bg-card p-3 text-foreground no-underline">
              <div className="flex items-start justify-between gap-2"><b className="text-sm">{j.name}</b><StageBadge stage={j.stage} /></div>
              <p className="m-0 text-xs text-muted-foreground">{j.id} · {j.client} · finish <span className={cn(late(j) && 'font-bold text-destructive')}>{formatShort(j.finish)}</span></p>
              <MiniBar value={j.job} label="Job complete" />
              {j.risk && <p className="m-0 text-xs font-semibold text-destructive">{j.risk}</p>}
            </Link>
          ))}
        </div>
      </Card>

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
