import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, CalendarDays, ChevronDown, ChevronRight, CircleCheck, Copy, ExternalLink, FolderOpen, Lock,
  MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, UserPlus,
} from 'lucide-react';
import { Button } from '../components/ui-kit/button';
import { Card } from '../components/ui-kit/card';
import { Checkbox } from '../components/ui-kit/checkbox';
import { Progress } from '../components/ui-kit/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui-kit/tabs';
import { ToggleGroup, ToggleGroupItem } from '../components/ui-kit/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui-kit/collapsible';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../components/ui-kit/accordion';
import { Avatar, AvatarFallback } from '../components/ui-kit/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui-kit/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui-kit/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../components/ui-kit/dropdown-menu';
import { StageBadge } from '../components/StageBadge';
import TaskDrawer from '../components/TaskDrawer';
import BulkDialog from '../components/BulkTaskDialog';
import AddTaskWizard, { KINDS } from '../components/AddTaskWizard';
import { AssignDesignerModal, DeleteTaskModal, ScheduleModal, TaskEditModal } from '../components/TaskForms';
import { SIGN_STAGES, SignModal } from '../components/JobSitePanel';
import { Chip, Modal } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { formatShort, toKey, today } from '../lib/dates';
import { KPI_GROUPS, canCloseJob, isClosedJob, jobStats } from '../lib/jobs';
import { addressLine, locationsForJob, mapsUrl, signGroups } from '../lib/jobSites';
import { crewOf } from '../lib/checklists';
import { formatSize } from '../lib/attachments';
import { CLOSED_STAGES, MANAGER_ROLES } from '../lib/workflow';
import { shortName } from '../lib/people';
import { seedQuotes } from '../data/quotesSeed';
import { cn } from '../lib/utils';
import './JobsWeb.css';

const GROUP_LABEL = { design: 'Design', fab: 'Fabrication', install: 'Installation' };
const DONE = [...CLOSED_STAGES];
const initials = (n) => String(n).split(' ').map((p) => p[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
const money = (n) => Number(n || 0).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });
const serverPath = (job) => job.serverPath || `\\\\VE-SERVER\\Jobs\\${job.id}`;

function Ring({ value }) {
  return (
    <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--ui-brand)) ${value}%, hsl(var(--ui-track)) 0)` }} role="img" aria-label={`${value}% complete`}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-card text-sm font-bold">{value}%</div>
    </div>
  );
}

function Crew({ names }) {
  if (!names.length) return <span className="text-sm text-muted-foreground">Not scheduled</span>;
  return (
    <div className="flex -space-x-2">
      {names.map((n) => (
        <Tooltip key={n}>
          <TooltipTrigger asChild>
            <Avatar className="h-7 w-7 border-2 border-card"><AvatarFallback className="bg-secondary text-[10px] font-bold">{initials(n)}</AvatarFallback></Avatar>
          </TooltipTrigger>
          <TooltipContent>{n}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function HoursBar({ t, wide }) {
  const pct = t.quoted ? Math.min(100, ((t.booked || 0) / t.quoted) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Progress value={pct} className={cn('h-1.5 bg-track [&>div]:bg-brand', wide ? 'flex-1' : 'w-20')} aria-label={`${t.booked || 0} of ${t.quoted || 0} hours booked`} />
      {t.booked || 0} / {t.quoted || 0}h
    </div>
  );
}

// Signs as a 4-step progress: deal, artwork, manufacturing, install. 2 = done, 1 = under way, 0 = not started.
const STEP_LEVEL = (k, v) => SIGN_STAGES[k].indexOf(v) === SIGN_STAGES[k].length - 1 ? 2 : SIGN_STAGES[k].indexOf(v) > 0 ? 1 : (k === 'deal' && v === 'Quoted' ? 1 : 0);
const signNow = (g) => (g.install === 'Installed' ? 'Installed' : g.install === 'Scheduled' ? 'Install scheduled' : g.manufacturing !== 'Not started' ? g.manufacturing : g.artwork !== 'Not started' ? g.artwork : g.deal);

export default function Job360() {
  const { jobId } = useParams();
  const demo = useDemo();
  const { allJobs: jobs, tasks, notify, roleId, role, closeJob, updateJob, sites, signs, addSign, updateSign, attachments, workers, runTaskAction, scheduleTask } = demo;
  const [tab, setTab] = useState('tasks');
  const [view, setView] = useState('all');
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null); // { kind, task }
  const [adding, setAdding] = useState('');
  const [editing, setEditing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [bulk, setBulk] = useState(null); // 'schedule' | 'hold' | 'cancel'
  const [signFilter, setSignFilter] = useState('all');
  const [editingSign, setEditingSign] = useState(null);

  const job = jobs.find((j) => j.id === jobId);
  const todayKey = toKey(today());
  const jobTasks = useMemo(() => tasks.filter((t) => job && t.jobId === job.id), [tasks, job]);
  if (!job) return <PlaceholderPage title="Job not found" blurb="That job does not exist in the demo data." />;

  const stats = jobStats(jobTasks, todayKey);
  const closeCheck = canCloseJob(job, roleId);
  const closed = isClosedJob(job);
  const canManage = MANAGER_ROLES.includes(roleId);
  const canEditJob = roleId === 'admin' || roleId === 'pm';
  const canCreate = canManage && !closed;
  const me = shortName(role.name);
  const isDone = (t) => DONE.includes(t.stage);
  const late = (t) => !isDone(t) && t.date && t.date < todayKey;
  const needsMe = (t) => (canManage
    ? ['Manager Review', 'Awaiting Scheduling', 'To be Assigned'].includes(t.stage)
    : !isDone(t) && crewOf(t).includes(me));
  const VIEWS = [
    ['all', 'All', () => true],
    ['mine', 'Needs my action', needsMe],
    ['late', 'Overdue', late],
    ['review', 'In review', (t) => ['Manager Review', 'Awaiting Submission'].includes(t.stage)],
    ['done', 'Done', isDone],
  ];
  const viewFn = VIEWS.find((v) => v[0] === view)[2];
  const shown = jobTasks.filter(viewFn);
  const groups = ['design', 'fab', 'install'].map((k) => ({ k, rows: shown.filter((t) => t.kind === k) })).filter((g) => g.rows.length);
  const inReview = jobTasks.filter((t) => t.stage === 'Manager Review').length;
  const toApprove = canManage ? inReview : 0;
  const openTask = jobTasks.find((t) => t.id === openId) || null;
  const selectedTasks = jobTasks.filter((t) => selected.includes(t.id));
  const places = locationsForJob(job.id, sites, signs);
  const jobSigns = places.flatMap((p) => p.signs);
  const sGroups = signGroups(jobSigns);
  const quotes = seedQuotes.filter((q) => q.jobId === job.id);
  const jobFiles = attachments.filter((a) => jobTasks.some((t) => t.id === a.taskId));
  const activity = jobTasks.flatMap((t) => (t.history || []).map((h, i) => ({ ...h, task: t.name, key: `${t.id}-${i}` })));

  const request = (kind, task) => { setOpenId(null); setModal({ kind, task }); };
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const rowAction = (t) => {
    if (!canManage) return null;
    if (t.stage === 'Awaiting Scheduling') return ['Schedule', () => request('schedule', t)];
    if (t.stage === 'To be Assigned') return ['Assign', () => request('assign', t)];
    if (t.stage === 'Manager Review') return ['Review', () => setOpenId(t.id)];
    return null;
  };
  const copyPath = () => { try { navigator.clipboard?.writeText(serverPath(job)); } catch (e) { /* not available */ } notify('Server path copied'); };

  const RowMenu = ({ t }) => canManage && (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label={`More for ${t.name}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setOpenId(t.id)}>Open</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => request('edit', t)}><Pencil /> Edit task</DropdownMenuItem>
        {['fab', 'install'].includes(t.kind) && !isDone(t) && <DropdownMenuItem onSelect={() => request('schedule', t)}><CalendarDays /> {t.leader ? 'Change date or crew' : 'Schedule'}</DropdownMenuItem>}
        {t.kind === 'design' && ['To be Assigned', 'Assigned'].includes(t.stage) && <DropdownMenuItem onSelect={() => request('assign', t)}><UserPlus /> {t.owner ? 'Change designer' : 'Assign designer'}</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => request('delete', t)}><Trash2 /> Delete task</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="ui-scope wjobs wjob grid min-w-0 gap-4 font-sans [&>*]:min-w-0">
        <Link to="/jobs" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground no-underline hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All jobs</Link>

        {/* 1. Header: one main button, the rest in More */}
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
            <div className="min-w-0">
              <p className="wj-eyebrow">Job · {job.id} · {job.client}</p>
              <h1 className="job-title wj-title">{job.name}</h1>
              <div className="wj-meta">
                <Chip value={job.stage} />
                <span>Expected finish {job.finish ? formatShort(job.finish) : '-'}</span>
                {job.pm && <span className="wj-dot">PM <b>{job.pm}</b></span>}
                {job.fabManager && <span className="wj-dot">Fab manager <b>{job.fabManager}</b></span>}
              </div>
            </div>
            <div className="flex gap-2 md:ml-auto">
              {closed && <span className="inline-flex items-center gap-1.5 self-center text-sm font-semibold text-muted-foreground"><Lock className="h-4 w-4" /> Closed {job.closedAt ? formatShort(job.closedAt) : ''}</span>}
              {canEditJob && <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setEditing(true)}><Pencil /> Edit job</Button>}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild><Button variant="outline" aria-label="More job actions"><MoreHorizontal /> More</Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {canEditJob && <DropdownMenuItem className="sm:hidden" onSelect={() => setEditing(true)}><Pencil /> Edit job</DropdownMenuItem>}
                  <DropdownMenuItem onSelect={() => notify('Opens the Zoho CRM deal (demo)')}><ExternalLink /> Go to CRM deal</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => notify('Opens the WorkDrive folder (demo)')}><FolderOpen /> Open WorkDrive folder</DropdownMenuItem>
                  <DropdownMenuItem onSelect={copyPath}><Copy /> Copy server path</DropdownMenuItem>
                  {!closed && !(closeCheck.ok && canCreate) && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem disabled={!closeCheck.ok} onSelect={() => setClosing(true)} className="flex-col items-start gap-0">
                        <span className="flex items-center gap-2"><CircleCheck className="h-4 w-4" /> Close job</span>
                        {!closeCheck.ok && <span className="pl-6 text-xs">{closeCheck.reason}</span>}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              {!closed && closeCheck.ok && canCreate && <Button className="flex-1 sm:flex-none" onClick={() => setClosing(true)}><CircleCheck /> Close job</Button>}
              {canCreate && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild><Button variant={closeCheck.ok ? 'outline' : 'default'} className="flex-1 sm:flex-none"><Plus /> Add task <ChevronDown className="opacity-70" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60">
                      <DropdownMenuLabel>Add a task to this job</DropdownMenuLabel>
                      {KINDS.map(({ id, label, icon: Icon }) => <DropdownMenuItem key={id} onSelect={() => setAdding(id)}><Icon /> {label}</DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
            </div>
            <div className="hidden md:block"><Ring value={job.job} /></div>
          </div>

          {(toApprove > 0 || job.risk) && !closed && (
            <div className="mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-warn-line bg-warn px-3 py-2 text-sm text-warn-ink sm:mx-5" role="status">
              <AlertTriangle className="h-4 w-4" />
              {toApprove > 0 && <><span><b>{toApprove} task{toApprove > 1 ? 's' : ''}</b> waiting for your approval</span>
                <Button variant="link" className="h-auto p-0 text-warn-ink underline" onClick={() => { setTab('tasks'); setView('review'); }}>Review</Button></>}
              {toApprove > 0 && job.risk && <span aria-hidden="true">·</span>}
              {job.risk && <span>{job.risk}</span>}
            </div>
          )}

          {/* 2. Details on demand */}
          <Collapsible>
            <CollapsibleTrigger className="group flex w-full items-center gap-2 border-t px-5 py-2.5 text-left text-sm text-muted-foreground hover:bg-muted/60">
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
              <b className="text-foreground">Job details</b><span className="hidden sm:inline">server path, fab finish dates, CRM deal, created date</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="m-0 grid gap-3 px-5 pb-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
                {[['Server path', serverPath(job)], ['Fab finish required', job.fabRequired ? formatShort(job.fabRequired) : '-'], ['Fab finish agreed', job.fabAgreed ? formatShort(job.fabAgreed) : 'not agreed yet'], ['CRM deal', job.dealId || 'linked (demo)'], ['Created', job.createdAt ? formatShort(job.createdAt) : '-']].map(([k, v]) => (
                  <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="m-0 break-all font-semibold">{v}</dd></div>
                ))}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* 3. Discipline tiles and progress, as on the web job page */}
        <div className="wj-kpis" aria-label="Progress by discipline">
          {KPI_GROUPS.map((g) => {
            const k = stats[g.kind];
            return (
              <div key={g.kind} className="wj-kpi">
                <span className="wj-kpi-label">{GROUP_LABEL[g.kind]} tasks</span>
                <span className="wj-kpi-value">{k.open} open</span>
                <span className="wj-kpi-note">
                  {k.total} total, {k.overdue > 0
                    ? <button type="button" className="wj-late" onClick={() => { setTab('tasks'); setView('late'); }}>{k.overdue} overdue</button>
                    : '0 overdue'}, {k.pct}% done
                </span>
              </div>
            );
          })}
        </div>

        <section className="wj-card" aria-label="Progress">
          <h2 className="wj-card-head">Progress</h2>
          <div className="wj-progress">
            {[['Fab', job.fab], ['Install', job.install], ['Job', job.job]].map(([label, v]) => (
              <div key={label} className="wj-progress-row">
                <span className="wj-progress-label">{label}</span>
                <span className="wprogress-track"><span style={{ width: `${Math.min(100, v || 0)}%` }} /></span>
                <span className="wprogress-value">{v || 0}%</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Page tabs */}
        <Card className="overflow-hidden">
          <Tabs value={tab} onValueChange={setTab}>
            <div className="overflow-x-auto border-b px-2 pt-2 sm:px-3">
              <TabsList className="h-10 w-max justify-start rounded-none bg-transparent p-0">
                {[['tasks', 'Tasks', jobTasks.length], ['signs', 'Signs & site', jobSigns.length], ['quotes', 'Quotes', quotes.length], ['files', 'Files', jobFiles.length], ['activity', 'Activity', 0], ...(roleId === 'admin' ? [['profit', 'Profit', 0]] : [])].map(([v, l, n]) => (
                  <TabsTrigger key={v} value={v} className="h-10 rounded-none border-0 border-b-2 border-transparent bg-transparent px-3 font-semibold data-[state=active]:border-brand data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                    {l}{n > 0 && <span className="ml-1.5 rounded-sm bg-secondary px-1.5 text-[11px]">{n}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* 5. Tasks: saved views, bulk actions, one list grouped by discipline */}
            <TabsContent value="tasks" className="mt-0">
              <div className="overflow-x-auto px-3 py-3 sm:px-4">
                <ToggleGroup type="single" value={view} onValueChange={(v) => { if (v) { setView(v); setSelected([]); } }} variant="outline" size="sm" className="w-max justify-start gap-0" aria-label="Saved views">
                  {VIEWS.map(([v, l, fn]) => (
                    <ToggleGroupItem key={v} value={v} className="whitespace-nowrap rounded-none px-3 first:rounded-l-md last:rounded-r-md data-[state=on]:bg-foreground data-[state=on]:text-background">
                      {l} <span className="opacity-60">{jobTasks.filter(fn).length}</span>
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              {selected.length > 0 && (
                <div className="mx-3 mb-3 flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-accent px-3 py-2 text-sm font-semibold sm:mx-4" role="region" aria-label="Bulk actions">
                  <Checkbox checked onCheckedChange={() => setSelected([])} aria-label="Clear selection" /> {selected.length} selected
                  <Button size="sm" variant="outline" onClick={() => setBulk('schedule')}><CalendarDays /> Schedule crew and date</Button>
                  <Button size="sm" variant="outline" onClick={() => setBulk('hold')}>Put on hold</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setBulk('cancel')}>Cancel tasks</Button>
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>Clear</Button>
                </div>
              )}

              {groups.length === 0 && <p className="m-0 px-4 pb-6 text-sm text-muted-foreground">{jobTasks.length === 0 ? 'No tasks on this job yet. Use "Add task" to create the first one.' : 'No tasks in this view.'}</p>}

              {groups.length > 0 && (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                        <th className="w-10 py-2 pl-4" aria-label="Select" /><th className="py-2 pr-3">Task</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">People</th><th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Hours</th><th className="w-44 py-2 pr-4" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => [
                        <tr key={g.k} className="bg-muted/70"><td /><td colSpan={6} className="py-1.5 text-xs font-bold text-muted-foreground">{GROUP_LABEL[g.k]} · {g.rows.length}</td></tr>,
                        ...g.rows.map((t) => {
                          const act = rowAction(t);
                          return (
                            <tr key={t.id} className={cn('group cursor-pointer border-b transition-colors hover:bg-muted/40', selected.includes(t.id) && 'bg-accent/60')} onClick={() => setOpenId(t.id)}>
                              <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}>
                                {canManage && <Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.name}`} />}
                              </td>
                              <td className="py-2.5 pr-3">
                                <button type="button" className="text-left font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>{t.name}</button>
                                <div className="text-xs text-muted-foreground">{t.type || GROUP_LABEL[t.kind]}{t.kind === 'install' && t.swms && !['Completed', 'Not Required'].includes(t.swms) ? ` · SWMS ${t.swms.toLowerCase()}` : ''}{t.parentId ? ' · subtask' : ''}</div>
                              </td>
                              <td className={cn('py-2.5 pr-3', late(t) && 'font-bold text-destructive')}>{t.date ? formatShort(t.date) : '-'}</td>
                              <td className="py-2.5 pr-3"><Crew names={crewOf(t)} /></td>
                              <td className="py-2.5 pr-3"><StageBadge stage={t.stage} /></td>
                              <td className="py-2.5 pr-3"><HoursBar t={t} /></td>
                              <td className="py-2.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  {act && <Button size="sm" variant="outline" onClick={act[1]}>{act[0]}</Button>}
                                  <RowMenu t={t} />
                                </div>
                              </td>
                            </tr>
                          );
                        }),
                      ])}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Phone: cards with one 44 px action */}
              <div className="grid gap-2 px-3 pb-3 md:hidden">
                {groups.flatMap((g) => g.rows).map((t) => {
                  const act = rowAction(t);
                  return (
                    <Card key={t.id} className="grid gap-2 p-3" onClick={() => setOpenId(t.id)} role="button" tabIndex={0} aria-label={`Open ${t.name}`}>
                      <div className="flex items-start justify-between gap-2"><b className="text-sm">{t.name}</b><StageBadge stage={t.stage} /></div>
                      <p className="m-0 text-xs text-muted-foreground">{t.type || GROUP_LABEL[t.kind]} · <span className={cn(late(t) && 'font-bold text-destructive')}>{t.date ? formatShort(t.date) : '-'}</span> · {crewOf(t).join(', ') || 'not scheduled'}</p>
                      {(t.quoted || 0) > 0 && <HoursBar t={t} wide />}
                      {act && <Button variant="outline" className="h-11" onClick={(e) => { e.stopPropagation(); act[1](); }}>{act[0]}</Button>}
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Signs and site */}
            <TabsContent value="signs" className="mt-0">
              {places.length === 0 ? <p className="m-0 p-4 text-sm text-muted-foreground">No site is linked to this job yet. Sites come from the CRM deal; add one there and it appears here.</p> : (
                <>
                  <div className="flex flex-wrap items-start gap-4 border-b px-4 py-3 text-sm">
                    {places.map(({ site }) => (
                      <div key={site.id}><b>{site.name}</b><div className="text-muted-foreground">{addressLine(site)}</div>
                        <a className="text-xs font-semibold text-primary" href={mapsUrl(site)} target="_blank" rel="noopener noreferrer">Open in maps <ExternalLink className="inline h-3 w-3" /></a></div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <ToggleGroup type="single" value={signFilter} onValueChange={(v) => v && setSignFilter(v)} variant="outline" size="sm" className="gap-0" aria-label="Sign groups">
                      {[['all', `All ${jobSigns.length}`], ...sGroups.map((g) => [g.name, `${g.name} ${g.signs}`])].map(([v, l]) => (
                        <ToggleGroupItem key={v} value={v} className="rounded-none px-3 first:rounded-l-md last:rounded-r-md data-[state=on]:bg-foreground data-[state=on]:text-background">{l}</ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {canCreate && <Button size="sm" className="ml-auto" onClick={() => setEditingSign('new')}><Plus /> Add sign</Button>}
                  </div>
                  <Accordion type="single" collapsible className="px-4 pb-3">
                    {jobSigns.filter((g) => signFilter === 'all' || g.group === signFilter).map((g) => (
                      <AccordionItem key={g.id} value={g.id}>
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 pr-2 text-left">
                            <div className="min-w-[14rem]"><div className="font-semibold">{g.name}</div><div className="text-xs font-normal text-muted-foreground">Rev {g.rev} · {g.group} · Qty {g.qty}</div></div>
                            <div className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground" aria-label={`Deal ${g.deal}, artwork ${g.artwork}, manufacturing ${g.manufacturing}, install ${g.install}`}>
                              {['deal', 'artwork', 'manufacturing', 'install'].map((k) => { const lv = STEP_LEVEL(k, g[k]); return <span key={k} title={`${k}: ${g[k]}`} className={cn('h-2 w-8 rounded-full', lv === 2 ? 'bg-brand' : lv === 1 ? 'bg-[#e9b44c]' : 'bg-track')} />; })}
                              <span className="ml-1">{signNow(g)}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                          <span>Deal {g.deal} · Artwork {g.artwork} · Manufacturing {g.manufacturing} · Install {g.install}<br />{[g.medium, g.finishing].filter(Boolean).join(' · ') || 'No medium or finish recorded'}</span>
                          {canCreate && <Button size="sm" variant="outline" onClick={() => setEditingSign(g)} aria-label={`Edit ${g.name}`}><Pencil /> Edit sign</Button>}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </>
              )}
            </TabsContent>

            {/* Quotes from CRM (as in the web app) */}
            <TabsContent value="quotes" className="mt-0">
              <div className="flex items-center gap-2 px-4 py-3">
                <span className="text-sm text-muted-foreground">{quotes.length ? `Last synced ${quotes[0].synced}` : 'No quotes saved yet.'}</span>
                {canManage && <Button size="sm" variant="outline" className="ml-auto" onClick={() => notify('Quotes synced from the CRM deal (demo)')}><RefreshCw /> Sync from CRM</Button>}
              </div>
              {quotes.map((q) => {
                const sub = q.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
                return (
                  <div key={q.id} className="overflow-x-auto border-t">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm"><b>{q.name}</b><span className="rounded-sm bg-secondary px-1.5 text-xs font-semibold">{q.stage}</span><span className="text-muted-foreground">{q.id} · total {money(sub + q.tax)}</span></div>
                    <table className="w-full border-collapse text-sm">
                      <thead><tr className="border-b text-left text-xs font-semibold text-muted-foreground"><th className="px-4 py-2">Item</th><th className="py-2 pr-3">Qty</th><th className="py-2 pr-3">Unit price</th><th className="py-2 pr-4 text-right">Line total</th></tr></thead>
                      <tbody>{q.lines.map((l) => <tr key={l.product} className="border-b"><td className="px-4 py-2"><b>{l.product}</b><div className="text-xs text-muted-foreground">{l.description}</div></td><td className="py-2 pr-3">{l.qty}</td><td className="py-2 pr-3">{money(l.unitPrice)}</td><td className="py-2 pr-4 text-right font-semibold">{money(l.qty * l.unitPrice)}</td></tr>)}</tbody>
                    </table>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="files" className="mt-0">
              {jobFiles.length === 0 ? <p className="m-0 p-4 text-sm text-muted-foreground">No files yet. Files are added on each task.</p> : (
                <ul className="m-0 grid list-none p-0">
                  {jobFiles.map((a) => { const t = jobTasks.find((x) => x.id === a.taskId); return (
                    <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 text-sm">
                      <b>{a.name}</b><span className="text-muted-foreground">{formatSize(a.size)} · {a.by} · {a.at}</span>
                      <Button size="sm" variant="link" className="ml-auto h-auto p-0" onClick={() => setOpenId(a.taskId)}>{t?.name}</Button>
                    </li>); })}
                </ul>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              {activity.length === 0 ? <p className="m-0 p-4 text-sm text-muted-foreground">No activity yet.</p> : (
                <ul className="m-0 grid list-none gap-3 p-4 text-sm">
                  {activity.slice(0, 60).map((h) => (
                    <li key={h.key} className={cn('border-l-2 pl-3', h.to && 'border-brand')}>
                      {h.to ? <><b>{h.from} → {h.to}</b> by {h.who}</> : <><b>{h.who}</b> {h.text}</>}
                      <div className="text-xs text-muted-foreground">{h.task} · {h.at}</div>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {roleId === 'admin' && (
              <TabsContent value="profit" className="mt-0">
                <dl className="m-0 grid gap-3 border-b p-4 text-sm sm:grid-cols-3">
                  {[['Revenue', job.revenue], ['Purchases', job.purchases], ['Profit', job.profit]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="m-0 text-lg font-bold">{money(v)}</dd></div>)}
                </dl>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead><tr className="border-b text-left text-xs font-semibold text-muted-foreground"><th className="px-4 py-2">Task</th><th className="py-2 pr-3">Booked</th><th className="py-2 pr-3">Hourly rate</th><th className="py-2 pr-4 text-right">Labour cost</th></tr></thead>
                    <tbody>
                      {jobTasks.map((t) => {
                        const who = t.owner || t.leader || '';
                        const person = workers.find((w) => shortName(w.name) === who || w.name === who);
                        const rate = Number(person?.hourlyRate || 0);
                        return <tr key={t.id} className="border-b"><td className="px-4 py-2">{t.name}</td><td className="py-2 pr-3">{t.booked || 0}h</td><td className="py-2 pr-3">{rate ? `$${rate.toFixed(2)}/h` : 'Not set'}</td><td className="py-2 pr-4 text-right font-semibold">{rate ? `$${((t.booked || 0) * rate).toFixed(2)}` : '-'}</td></tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </Card>

        <TaskDrawer task={openTask} onClose={() => setOpenId(null)} onRequest={request} />

        {adding && <AddTaskWizard job={job} kind={adding} groups={sGroups.map((g) => g.name)} onClose={() => setAdding('')} />}
        {modal?.kind === 'edit' && <TaskEditModal task={jobTasks.find((t) => t.id === modal.task.id) || modal.task} onClose={() => setModal(null)} />}
        {modal?.kind === 'schedule' && <ScheduleModal task={jobTasks.find((t) => t.id === modal.task.id) || modal.task} onClose={() => setModal(null)} />}
        {modal?.kind === 'assign' && <AssignDesignerModal task={jobTasks.find((t) => t.id === modal.task.id) || modal.task} onClose={() => setModal(null)} />}
        {modal?.kind === 'delete' && <DeleteTaskModal task={modal.task} onClose={() => setModal(null)} />}
        {editing && <Modal title="Edit job details" onClose={() => setEditing(false)}><JobEditForm job={job} roleId={roleId} onSave={(patch) => { updateJob(job.id, patch); setEditing(false); }} onCancel={() => setEditing(false)} /></Modal>}
        {editingSign && (
          <SignModal sign={editingSign === 'new' ? null : editingSign} jobId={job.id} places={places} groups={sGroups.map((g) => g.name)}
            onSave={(rec) => (editingSign === 'new' ? addSign(rec) : updateSign(editingSign.id, rec))} onClose={() => setEditingSign(null)} />
        )}

        <Dialog open={closing} onOpenChange={setClosing}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader><DialogTitle>Close this job?</DialogTitle><DialogDescription>{job.name}</DialogDescription></DialogHeader>
            <ul className="m-0 grid list-none gap-2 p-0 text-sm">
              <li className="flex gap-2"><CircleCheck className="h-4 w-4 text-primary" /> {job.job}% complete</li>
              <li className={cn('flex gap-2', inReview > 0 && 'text-destructive')}><AlertTriangle className="h-4 w-4" /> {inReview > 0 ? `${inReview} task${inReview > 1 ? 's are' : ' is'} still in Manager Review. Closing will not wait for approval.` : 'No tasks waiting for approval'}</li>
              <li className="flex gap-2"><CircleCheck className="h-4 w-4 text-primary" /> Sends the closure report email once and updates the CRM deal (demo)</li>
              <li className="flex gap-2"><Lock className="h-4 w-4" /> No more tasks can be added afterwards</li>
            </ul>
            <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setClosing(false)}>Cancel</Button><Button onClick={() => { closeJob(job.id); setClosing(false); }}>Close job</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {bulk && <BulkDialog kind={bulk} tasks={selectedTasks} onClose={() => setBulk(null)} onDone={() => { setBulk(null); setSelected([]); }} runTaskAction={runTaskAction} scheduleTask={scheduleTask} notify={notify} />}
      </div>
    </TooltipProvider>
  );
}

function JobEditForm({ job, roleId, onSave, onCancel }) {
 const [f,setF]=useState({name:job.name||'',finish:job.finish||'',stage:job.stage||'',serverPath:job.serverPath||`\\VE-SERVER\\Jobs\\${job.id}`,dealId:job.dealId||'',createdAt:job.createdAt||new Date().toISOString().slice(0,10)}); const set=k=>e=>setF(x=>({...x,[k]:e.target.value})); const [err,setErr]=useState('');
 return <form className="form" onSubmit={e=>{e.preventDefault();if(!f.name.trim()||!f.finish||!f.stage||!f.serverPath.trim())return setErr('Please fill the mandatory fields');onSave({...f,name:f.name.trim()});}}><label>Job subject *<input value={f.name} onChange={set('name')} disabled={roleId!=='admin'} /></label><div className="form-row"><label>Expected job finish *<input type="date" value={f.finish} onChange={set('finish')}/></label><label>Stage *<select value={f.stage} onChange={set('stage')}>{['Preparation','In Progress','On Hold','Completed','Completed - Closed','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>File location on VE server *<input value={f.serverPath} onChange={set('serverPath')}/></label>{roleId==='admin'&&<div className="form-row"><label>CRM Deal link / ID<input value={f.dealId} onChange={set('dealId')}/></label><label>Job created date<input type="date" value={f.createdAt} onChange={set('createdAt')}/></label></div>}<small>Completion, hours and cost rollups are read-only.</small>{err&&<p className="form-error">{err}</p>}<div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button><button className="btn btn-primary">Save changes</button></div></form>
}

