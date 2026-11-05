import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/ui-kit/card';
import { Button } from '../components/ui-kit/button';
import { PageHeader } from '../components/ui';
import { StageBadge } from '../components/StageBadge';
import { EmptyState, FilterPanel, FilterSelect, SavedViews, SearchBox } from '../components/ListKit';
import ChecklistDialog from '../components/ChecklistDialog';
import { useDemo } from '../context/DemoContext';
import { nextStep, stepOrder, stepTitle } from '../lib/checklists';
import { shortName } from '../lib/people';
import { cn } from '../lib/utils';

const KIND = { design: 'Design', fab: 'Fabrication', install: 'Install' };

// Checklist register: one row per person per task, with the steps as a small progress bar.
// Crew members see only their own and can carry on with the next step from here.
export default function ChecklistsPage() {
  const { checklists, tasks, role, roleId, swms } = useDemo();
  const [phase, setPhase] = useState('all');
  const [discipline, setDiscipline] = useState('all');
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [doing, setDoing] = useState(null);
  const worker = ['installer', 'fabWorker', 'workshop', 'designer', 'contractor'].includes(roleId);
  const mine = shortName(role.name);

  const base = useMemo(() => checklists.map((c) => ({ ...c, task: tasks.find((t) => t.id === c.taskId) })).filter((c) => c.task)
    .filter((c) => !worker || c.person === mine)
    .filter((c) => discipline === 'all' || c.task.kind === discipline), [checklists, tasks, worker, mine, discipline]);
  const isPost = (c) => Boolean(c.steps?.post1 || c.steps?.post2);
  const PHASES = [
    { id: 'all', label: 'All', rows: base },
    { id: 'pre', label: 'Pre-job', rows: base.filter((c) => Boolean(c.steps?.pre1 || c.steps?.pre2) && !isPost(c)) },
    { id: 'post', label: 'Post-job', rows: base.filter(isPost) },
    { id: 'open', label: 'Not finished', rows: base.filter((c) => !c.steps?.post2) },
  ];
  let rows = PHASES.find((p) => p.id === phase).rows;
  if (!worker && view !== 'all') {
    rows = view === 'pm'
      ? tasks.filter((t) => t.kind === 'install' && t.stage === 'Manager Review').map((t) => ({ id: `pm-${t.id}`, task: t, person: 'Project Manager', role: 'PM', steps: {}, status: 'Awaiting review' }))
      : rows.filter((c) => (view === 'tl' ? c.role === 'TL' : c.role === 'TM'));
  }
  const needle = q.trim().toLowerCase();
  if (needle) rows = rows.filter((c) => `${c.task.name} ${c.task.jobId} ${c.person}`.toLowerCase().includes(needle));
  const swmsFor = (t) => (swms.find((s) => s.jobId === t.jobId && s.title === t.name) || swms.find((s) => s.jobId === t.jobId))?.status || t.swms;
  const active = (discipline !== 'all' ? 1 : 0) + (view !== 'all' ? 1 : 0);

  return (
    <div className="dash">
      <PageHeader eyebrow="Field operations" title={worker ? 'My checklists' : 'Checklists'} subtitle={`${rows.length} checklist records`} />
      <Card className="ui-scope overflow-hidden font-sans">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
          <SavedViews label="Phase" value={phase} onChange={setPhase} views={PHASES.map((p) => ({ id: p.id, label: p.label, count: p.rows.length }))} />
          <SearchBox value={q} onChange={setQ} placeholder="Search task, job or person" />
          <FilterPanel active={active} onClear={() => { setDiscipline('all'); setView('all'); }}>
            <FilterSelect label="Discipline" value={discipline} onChange={setDiscipline} options={[{ value: 'all', label: 'All' }, { value: 'design', label: 'Design' }, { value: 'fab', label: 'Fabrication' }, { value: 'install', label: 'Install' }]} />
            {!worker && <FilterSelect label="Checklist view" value={view} onChange={setView} options={[{ value: 'all', label: 'All roles' }, { value: 'pm', label: 'PM review' }, { value: 'tl', label: 'Team leader' }, { value: 'tm', label: 'Team member' }]} />}
          </FilterPanel>
        </div>
        {rows.length === 0 && <EmptyState>No checklists match these filters</EmptyState>}
        <ul className="m-0 list-none p-0">
          {rows.map((c) => {
            const keys = c.role === 'PM' ? [] : stepOrder(c.task);
            const done = keys.filter((k) => c.steps?.[k]).length;
            const next = worker && c.person === mine ? nextStep(c.task, c) : { step: null };
            return (
              <li key={c.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_12rem_9rem_auto] sm:px-5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{c.task.name}</div>
                  <div className="text-xs text-muted-foreground">
                    <Link className="job-link" to={`/jobs/${c.task.jobId}`}>{c.task.jobId}</Link> · {KIND[c.task.kind]} · {c.person} ({c.role === 'TL' ? 'team leader' : c.role === 'TM' ? 'team member' : 'PM review'})
                  </div>
                </div>
                <div aria-label={keys.map((k) => `${stepTitle(c.task, k)} ${c.steps?.[k] ? 'done' : 'open'}`).join(', ') || 'PM review'}>
                  {keys.length > 0 ? (
                    <>
                      <div className="flex gap-1">{keys.map((k) => <span key={k} title={stepTitle(c.task, k)} className={cn('h-1.5 flex-1 rounded-full', c.steps?.[k] ? 'bg-brand' : 'bg-track')} />)}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{done} of {keys.length} steps{c.steps?.post2?.hours ? ` · ${c.steps.post2.hours}h` : ''}</div>
                    </>
                  ) : <span className="text-xs text-muted-foreground">Waiting for the PM</span>}
                </div>
                <StageBadge stage={c.status || (c.steps?.post2 ? 'Completed' : done ? 'In Progress' : 'Not Started')} className="w-fit" />
                <div className="flex justify-start gap-2 sm:justify-end">
                  {next.step && ['Scheduled', 'In Progress', 'Rejected', 'Reopen', 'Open'].includes(c.task.stage)
                    ? <Button size="sm" onClick={() => setDoing({ task: c.task, step: next.step })}>Continue: {stepTitle(c.task, next.step)}</Button>
                    : <Button asChild size="sm" variant="outline"><Link to={`/jobs/${c.task.jobId}`} className="no-underline">Open job</Link></Button>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {doing && <ChecklistDialog task={doing.task} person={mine} step={doing.step} swmsStatus={swmsFor(doing.task)} onClose={() => setDoing(null)} />}
    </div>
  );
}
