import { Fragment, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Card } from './ui-kit/card';
import { Button } from './ui-kit/button';
import { Checkbox } from './ui-kit/checkbox';
import { Avatar, AvatarFallback } from './ui-kit/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui-kit/tooltip';
import { StageBadge } from './StageBadge';
import { BulkBar, EmptyState, FilterPanel, FilterSelect, RowMenu, SavedViews, SearchBox } from './ListKit';
import TaskDrawer from './TaskDrawer';
import BulkDialog from './BulkTaskDialog';
import { AssignDesignerModal, DeleteTaskModal, ScheduleModal, TaskEditModal } from './TaskForms';
import { useDemo } from '../context/DemoContext';
import { crewOf } from '../lib/checklists';
import { formatShort, toKey, today } from '../lib/dates';
import { CLOSED_STAGES, MANAGER_ROLES } from '../lib/workflow';
import { cn } from '../lib/utils';

const initials = (n) => String(n).split(' ').map((p) => p[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
const isDone = (t) => CLOSED_STAGES.includes(t.stage);

export function Crew({ names }) {
  if (!names.length) return <span className="text-sm text-muted-foreground">Unassigned</span>;
  return (
    <div className="flex -space-x-2">
      {names.slice(0, 4).map((n) => (
        <Tooltip key={n}>
          <TooltipTrigger asChild>
            <Avatar className="h-7 w-7 border-2 border-card"><AvatarFallback className="bg-secondary text-[10px] font-bold">{initials(n)}</AvatarFallback></Avatar>
          </TooltipTrigger>
          <TooltipContent>{n}</TooltipContent>
        </Tooltip>
      ))}
      {names.length > 4 && <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-card bg-secondary text-[10px] font-bold">+{names.length - 4}</span>}
    </div>
  );
}

export function HoursBar({ t }) {
  const pct = t.quoted ? Math.min(100, ((t.booked || 0) / t.quoted) * 100) : 0;
  const over = t.quoted && (t.booked || 0) > t.quoted;
  return (
    <div className={cn('flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground', over && 'font-semibold text-destructive')}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-track"><div className={cn('h-full rounded-full', over ? 'bg-destructive' : 'bg-brand')} style={{ width: `${pct}%` }} /></div>
      {t.booked || 0} / {t.quoted || 0}h
    </div>
  );
}

// One task list for the Fabrication, Installation and Design screens.
// views: [{ id, label, rows }]. Rows open in the same drawer as on Job details.
// typeColors: dot colour per type. extraColumns: [{ key, label, render }]. groupable: offer group by job / sign group.
export default function TaskList({
  title, views, view, onView, typeColors = {}, extraColumns = [], groupable = false, canSchedule, jobName, subtitle, emptyText = 'No tasks in this view',
}) {
  const { roleId, notify, runTaskAction, scheduleTask } = useDemo();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [groupBy, setGroupBy] = useState('none');
  const [selected, setSelected] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null);
  const [bulk, setBulk] = useState(null);
  const canManage = MANAGER_ROLES.includes(roleId);
  const mayScheduleRow = canSchedule ?? canManage;
  const key = toKey(today());
  const late = (t) => !isDone(t) && t.stage !== 'Manager Review' && t.date && t.date < key;

  const current = views.find((v) => v.id === view) || views[0];
  const all = views[0].rows;
  const types = [...new Set(all.map((t) => t.type).filter(Boolean))].sort();
  const needle = q.trim().toLowerCase();
  const rows = current.rows.filter((t) => (type === 'All' || t.type === type)
    && (!needle || `${t.name} ${t.jobId} ${jobName(t.jobId)} ${crewOf(t).join(' ')}`.toLowerCase().includes(needle)));
  const groups = groupBy === 'none' ? [{ key: '', label: '', rows }] : (() => {
    const out = [];
    rows.forEach((t) => {
      const k = groupBy === 'job' ? t.jobId : t.signGroup || '';
      let g = out.find((x) => x.key === k);
      if (!g) { g = { key: k, label: groupBy === 'job' ? `${t.jobId} · ${jobName(t.jobId)}` : k ? `${t.jobId} · ${k}` : 'No sign group', rows: [] }; out.push(g); }
      g.rows.push(t);
    });
    return groupBy === 'signGroup' ? [...out.filter((g) => g.key), ...out.filter((g) => !g.key)] : out;
  })();
  const openTask = all.find((t) => t.id === openId) || views.flatMap((v) => v.rows).find((t) => t.id === openId) || null;
  const picked = all.filter((t) => selected.includes(t.id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const request = (kind, task) => { setOpenId(null); setModal({ kind, task }); };
  const fresh = (t) => all.find((x) => x.id === t.id) || t;

  const rowAction = (t) => {
    if (t.stage === 'Awaiting Scheduling' && mayScheduleRow) return ['Schedule', () => request('schedule', t)];
    if (t.stage === 'To be Assigned' && canManage) return ['Assign', () => request('assign', t)];
    if (t.stage === 'Manager Review' && canManage) return ['Review', () => setOpenId(t.id)];
    return null;
  };
  const menu = (t) => [
    { label: 'Open task', onSelect: () => setOpenId(t.id) },
    { label: 'Open job', onSelect: () => navigate(`/jobs/${t.jobId}`) },
    { separator: true, hidden: !canManage },
    { label: 'Edit task', icon: Pencil, onSelect: () => request('edit', t), hidden: !canManage },
    { label: t.leader ? 'Change date or crew' : 'Schedule', icon: CalendarDays, onSelect: () => request('schedule', t), hidden: !canManage || t.kind === 'design' || isDone(t) || ['In Progress', 'Manager Review'].includes(t.stage) },
    { label: t.owner ? 'Change designer' : 'Assign designer', icon: UserPlus, onSelect: () => request('assign', t), hidden: !canManage || t.kind !== 'design' || !['To be Assigned', 'Assigned'].includes(t.stage) },
    { separator: true, hidden: !canManage },
    { label: 'Delete task', icon: Trash2, danger: true, onSelect: () => request('delete', t), hidden: !canManage },
  ];
  const tickable = canManage;
  const allTicked = rows.length > 0 && rows.every((t) => selected.includes(t.id));
  const colCount = 7 + extraColumns.length + (tickable ? 1 : 0);

  return (
    <TooltipProvider delayDuration={200}>
      <Card className="ui-scope overflow-hidden font-sans">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
          {title && <h2 className="m-0 mr-2 text-[15px] font-bold">{title}</h2>}
          <SavedViews label="Task filter" value={current.id} onChange={(v) => { onView(v); setSelected([]); }} views={views.map((v) => ({ id: v.id, label: v.label, count: v.rows.length }))} />
          <SearchBox value={q} onChange={setQ} placeholder="Search task, job or person" label="Search tasks" />
          <FilterPanel active={(type !== 'All' ? 1 : 0) + (groupBy !== 'none' ? 1 : 0)} onClear={() => { setType('All'); setGroupBy('none'); }}>
            <FilterSelect label="Type" value={type} onChange={setType} options={['All', ...types]} />
            {groupable && (
              <div className="grid gap-1 text-xs font-semibold text-muted-foreground">
                <span>Group</span>
                <SavedViews label="Group tasks" value={groupBy} onChange={setGroupBy} views={[{ id: 'none', label: 'No grouping' }, { id: 'job', label: 'By job' }, { id: 'signGroup', label: 'By sign group' }]} />
              </div>
            )}
          </FilterPanel>
        </div>

        {tickable && selected.length > 0 && (
          <div className="px-3 pt-3 sm:px-4">
            <BulkBar count={selected.length} onClear={() => setSelected([])}>
              <Button size="sm" variant="outline" onClick={() => setBulk('schedule')}><CalendarDays /> Schedule crew and date</Button>
              <Button size="sm" variant="outline" onClick={() => setBulk('hold')}>Put on hold</Button>
              <Button size="sm" variant="outline" className="text-destructive" onClick={() => setBulk('cancel')}>Cancel tasks</Button>
            </BulkBar>
          </div>
        )}

        {rows.length === 0 && <EmptyState>{emptyText}</EmptyState>}

        {rows.length > 0 && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-semibold text-muted-foreground">
                  {tickable && <th className="w-10 py-2 pl-4"><Checkbox checked={allTicked} onCheckedChange={() => setSelected(allTicked ? [] : rows.map((t) => t.id))} aria-label="Select all tasks" /></th>}
                  <th className={cn('py-2 pr-3', !tickable && 'pl-4')}>Task</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">People</th>
                  {extraColumns.map((c) => <th key={c.key} className="py-2 pr-3">{c.label}</th>)}
                  <th className="py-2 pr-3">Stage</th><th className="py-2 pr-3">Hours</th><th className="w-36 py-2 pr-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <Fragment key={g.key || 'all'}>
                    {g.label && <tr className="bg-muted/70" data-group={g.label}><td colSpan={colCount} className="px-4 py-1.5 text-xs font-bold text-muted-foreground">{g.label} ({g.rows.length})</td></tr>}
                    {g.rows.map((t) => {
                      const act = rowAction(t);
                      return (
                        <tr key={t.id} className={cn('group cursor-pointer border-b transition-colors hover:bg-muted/40', selected.includes(t.id) && 'bg-accent/60')} onClick={() => setOpenId(t.id)}>
                          {tickable && <td className="py-2.5 pl-4" onClick={(e) => e.stopPropagation()}><Checkbox checked={selected.includes(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Select ${t.name}`} /></td>}
                          <td className={cn('py-2.5 pr-3', !tickable && 'pl-4')}>
                            <button type="button" className="text-left font-semibold hover:underline" onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}>{t.parentId ? '↳ ' : ''}{t.name}</button>
                            <div className="text-xs text-muted-foreground">
                              <Link className="job-link" to={`/jobs/${t.jobId}`} onClick={(e) => e.stopPropagation()}>{t.jobId}</Link> · {jobName(t.jobId)}{subtitle ? subtitle(t) : ''}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-1.5 whitespace-nowrap"><i className="inline-block h-2 w-2 rounded-full" style={{ background: typeColors[t.type] || '#9aa39a' }} />{t.type || '-'}</span></td>
                          <td className={cn('whitespace-nowrap py-2.5 pr-3', late(t) && 'font-bold text-destructive')}>{t.date ? formatShort(t.date) : '-'}</td>
                          <td className="py-2.5 pr-3"><Crew names={crewOf(t)} /></td>
                          {extraColumns.map((c) => <td key={c.key} className="py-2.5 pr-3">{c.render(t)}</td>)}
                          <td className="py-2.5 pr-3"><StageBadge stage={t.stage} /></td>
                          <td className="py-2.5 pr-3"><HoursBar t={t} /></td>
                          <td className="py-2.5 pr-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              {act && <Button size="sm" variant="outline" onClick={act[1]}>{act[0]}</Button>}
                              <RowMenu label={`More for ${t.name}`} items={menu(t)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-2 p-3 md:hidden">
          {rows.map((t) => {
            const act = rowAction(t);
            return (
              <div key={t.id} className="grid gap-2 rounded-lg border bg-card p-3" role="button" tabIndex={0} aria-label={`Open ${t.name}`} onClick={() => setOpenId(t.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(t.id); }}>
                <div className="flex items-start justify-between gap-2"><b className="text-sm">{t.parentId ? '↳ ' : ''}{t.name}</b><StageBadge stage={t.stage} /></div>
                <p className="m-0 text-xs text-muted-foreground">{t.type} · <span className={cn(late(t) && 'font-bold text-destructive')}>{t.date ? formatShort(t.date) : '-'}</span> · {crewOf(t).join(', ') || 'unassigned'}</p>
                <p className="m-0 text-xs text-muted-foreground">{t.jobId} · {jobName(t.jobId)}</p>
                {extraColumns.map((c) => <div key={c.key} className="text-xs">{c.label}: {c.render(t)}</div>)}
                {act && <Button variant="outline" className="h-11" onClick={(e) => { e.stopPropagation(); act[1](); }}>{act[0]}</Button>}
              </div>
            );
          })}
        </div>
      </Card>

      <TaskDrawer task={openTask} onClose={() => setOpenId(null)} onRequest={request} />
      {modal?.kind === 'edit' && <TaskEditModal task={fresh(modal.task)} onClose={() => setModal(null)} />}
      {modal?.kind === 'schedule' && <ScheduleModal task={fresh(modal.task)} onClose={() => setModal(null)} />}
      {modal?.kind === 'assign' && <AssignDesignerModal task={fresh(modal.task)} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && <DeleteTaskModal task={modal.task} onClose={() => setModal(null)} />}
      {bulk && <BulkDialog kind={bulk} tasks={picked} onClose={() => setBulk(null)} onDone={() => { setBulk(null); setSelected([]); }} runTaskAction={runTaskAction} scheduleTask={scheduleTask} notify={notify} />}
    </TooltipProvider>
  );
}
