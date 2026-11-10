import { useState } from 'react';
import { CalendarDays, ChevronDown, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from './ui-kit/sheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui-kit/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui-kit/dropdown-menu';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui-kit/accordion';
import { Avatar, AvatarFallback } from './ui-kit/avatar';
import { Button } from './ui-kit/button';
import { StageBadge } from './StageBadge';
import Attachments from './Attachments';
import { useDemo } from '../context/DemoContext';
import { MANAGER_ROLES, stepIndexFor, stepsFor, transitionsFor } from '../lib/workflow';
import { checklistPlan, crewOf, stepOrder, stepTitle, submitBlockReason } from '../lib/checklists';
import { availableActions } from '../lib/taskActions';
import { formatShort, toKey, today, fromKey } from '../lib/dates';
import { cn } from '../lib/utils';

const KIND = { design: 'Design', fab: 'Fabrication', install: 'Installation' };
const initials = (n) => String(n).split(' ').map((p) => p[0]).join('').replace('.', '').slice(0, 2).toUpperCase();
const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];

// What the person should do next, in plain words, for the "Next" box.
function nextText(task, crew, blocked) {
  if (DONE.includes(task.stage)) return 'This task is finished. Nothing else to do.';
  switch (task.stage) {
    case 'Awaiting Scheduling': return 'Next: choose a date and a crew.';
    case 'To be Assigned': return 'Next: assign a designer.';
    case 'Assigned': return `Next: ${task.owner || 'the designer'} starts the task.`;
    case 'Scheduled': return `Next: ${task.leader || 'the team leader'} starts the pre-job checklist on the day.`;
    case 'In Progress': return blocked ? 'Next: the crew finishes their post-job checklists, then submits for approval.' : 'Next: submit the task for approval.';
    case 'Open': return 'Next: the designer completes the hand-off checklist.';
    case 'Awaiting Submission': return 'Next: submit the design for approval.';
    case 'Client Review': return 'Waiting for the client. Mark it when they reply.';
    case 'Manager Review': return 'Next: review the work and approve it, or reject it with a comment.';
    case 'Rejected': case 'Reopen': return 'This task was sent back. The reason is in Activity.';
    case 'On Hold': return 'This task is on hold. Take it off hold to carry on.';
    default: return crew.length ? '' : 'No crew yet.';
  }
}

// The task drawer on Job details: stepper, one main action, everything else in "More actions", collapsible sections.
// Edit, delete, schedule and assign open the existing forms through onRequest, after the drawer closes.
export default function TaskDrawer({ task, onClose, onRequest }) {
  const { roleId, role, actOnTask, runTaskAction, createSubtask, checklists, attachments } = useDemo();
  const [pending, setPending] = useState(null);
  const [comment, setComment] = useState('');
  const [review, setReview] = useState({ ohs: 'No', mgmtReview: false, tlRating: '' });
  const [error, setError] = useState('');
  const open = !!task;
  if (!task) return <Sheet open={false} onOpenChange={() => onClose()} />;

  const steps = stepsFor(task);
  const idx = stepIndexFor(task);
  const finalStage = steps[steps.length - 1];
  const transitions = transitionsFor(task);
  const canManage = MANAGER_ROLES.includes(roleId);
  const extras = canManage ? availableActions(task) : [];
  const canSub = canManage && ['install', 'fab'].includes(task.kind) && !['Cancelled', 'Complete - Not Used'].includes(task.stage);
  const plan = checklistPlan(task);
  const crew = crewOf(task);
  const lists = checklists.filter((c) => c.taskId === task.id);
  const flagged = lists.some((c) => c.steps.post2?.reviewFlag);
  const blockReason = transitions.some((s) => s.action === 'Submit for approval')
    ? (submitBlockReason(task, checklists) || (task.kind === 'design' && !(task.booked > 0) ? 'Booked hours are required first.' : ''))
    : '';
  const late = !DONE.includes(task.stage) && task.date && task.date < toKey(today());
  const daysLate = late ? Math.round((fromKey(toKey(today())) - fromKey(task.date)) / 86400000) : 0;
  const primary = transitions.find((s) => !s.danger);
  const others = transitions.filter((s) => s !== primary);
  const closed = lists.filter((c) => c.steps.post2).length;
  const files = attachments.filter((a) => a.taskId === task.id).length;
  const spec = task.kind === 'fab' && task.spec ? task.spec : null;

  const ask = (step, kind) => { setPending({ ...step, kind }); setComment(''); setError(''); setReview({ ohs: 'No', mgmtReview: flagged, tlRating: '' }); };
  const run = (step) => {
    if (step.assign) return onRequest('assign', task);
    if (step.action === 'Schedule') return onRequest('schedule', task);
    if (step.action === 'Approve') return ask(step, 'review');
    if (step.comment) return ask(step, 'transition');
    return actOnTask(task.id, step.action);
  };
  const runExtra = (a) => (a.comment ? ask({ action: a.label, id: a.id, comment: true, danger: a.danger }, 'extra') : runTaskAction(task.id, a.id));
  const locked = (s) => (s.manager && !canManage) || (s.action === 'Submit for approval' && Boolean(blockReason));

  const submit = (e) => {
    e.preventDefault();
    const text = comment.trim();
    if (pending.kind === 'review') {
      const r = Number(review.tlRating);
      if (review.tlRating !== '' && (!Number.isInteger(r) || r < 1 || r > 10)) return setError('Team leader rating must be a whole number from 1 to 10.');
      actOnTask(task.id, 'Approve', text, { pmReview: { comment: text, ohs: review.ohs, mgmtReview: review.mgmtReview, tlRating: review.tlRating === '' ? null : r, by: role.name } });
      return setPending(null);
    }
    if (!text) return setError('A comment is required.');
    if (pending.kind === 'extra') runTaskAction(task.id, pending.id, text);
    else actOnTask(task.id, pending.action, text);
    return setPending(null);
  };

  const hasMore = others.length > 0 || extras.length > 0 || canSub || canManage;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden bg-background p-0 sm:max-w-[480px]" aria-describedby={undefined}>
        <SheetHeader className="space-y-1 border-b bg-card p-5 pr-12 text-left">
          <SheetDescription>{KIND[task.kind]} · {task.type || 'task'} · {task.id}</SheetDescription>
          <SheetTitle className="text-lg font-bold">{task.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StageBadge stage={task.stage} />
            {task.date && <span className="text-muted-foreground">{task.kind === 'design' ? 'Due' : 'Date'} {formatShort(task.date)}</span>}
            {late && <span className="font-bold text-destructive">{daysLate} day{daysLate === 1 ? '' : 's'} overdue</span>}
          </div>
          <ol className="!mt-3 grid gap-1 text-center text-[11px] font-semibold text-muted-foreground" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }} aria-label="Task progress">
            {steps.map((s, i) => {
              const done = task.stage === finalStage || i < idx;
              return (
                <li key={s} className={cn(i === idx && 'text-foreground')}>
                  <div className={cn('mb-1.5 h-1.5 rounded-full', done ? 'bg-primary' : i === idx ? 'bg-brand' : 'bg-track')} />{s}
                </li>
              );
            })}
          </ol>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="m-4 rounded-md border border-primary/30 bg-accent/70 p-4">
            <p className="mb-3 text-sm font-semibold">{nextText(task, crew, Boolean(blockReason))}</p>
            <div className="flex flex-wrap gap-2">
              {primary && (
                <Button className="min-w-0 flex-1" disabled={locked(primary)} onClick={() => run(primary)}
                  title={primary.manager && !canManage ? 'Only a Project Manager or Fab Manager can do this' : blockReason}>
                  {primary.action === 'Approve' ? 'Review and approve' : primary.action}
                </Button>
              )}
              {hasMore && (
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild><Button variant="outline" className={cn(!primary && 'flex-1')}>More actions <ChevronDown /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {others.map((s) => (
                      <DropdownMenuItem key={s.action} disabled={locked(s)} className={cn(s.danger && 'text-destructive focus:text-destructive')} onSelect={() => run(s)}>{s.action}</DropdownMenuItem>
                    ))}
                    {extras.map((a) => (
                      <DropdownMenuItem key={a.id} className={cn(a.danger && 'text-destructive focus:text-destructive')} onSelect={() => runExtra(a)}>{a.label}</DropdownMenuItem>
                    ))}
                    {canSub && <DropdownMenuItem onSelect={() => createSubtask(task.id)}>Create subtask</DropdownMenuItem>}
                    {canManage && (
                      <>
                        {(others.length > 0 || extras.length > 0 || canSub) && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">This task</DropdownMenuLabel>
                        <DropdownMenuItem onSelect={() => onRequest('edit', task)}><Pencil /> Edit task</DropdownMenuItem>
                        {['fab', 'install'].includes(task.kind) && task.stage === 'Scheduled' && <DropdownMenuItem onSelect={() => onRequest('schedule', task)}><CalendarDays /> Change date or crew</DropdownMenuItem>}
                        {task.kind === 'design' && task.stage === 'Assigned' && <DropdownMenuItem onSelect={() => onRequest('assign', task)}><UserPlus /> Change designer</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onRequest('delete', task)}><Trash2 /> Delete task</DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {blockReason && <p className="mt-2 text-xs text-muted-foreground">Submit unlocks when this is done: {blockReason.replace('Closure step still open for', 'closure for').replace(/\.$/, '')}.</p>}
          </div>

          <Accordion type="multiple" defaultValue={['crew', 'activity']} className="px-5">
            {(plan.pre || plan.post || crew.length > 0) && (
              <AccordionItem value="crew">
                <AccordionTrigger className="text-sm">
                  <span className="flex flex-1 items-center justify-between pr-2">{task.kind === 'design' ? 'Designer & checklists' : 'Crew & checklists'}
                    {plan.post && crew.length > 0 && <span className="text-xs font-normal text-muted-foreground">{closed} of {crew.length} closed</span>}</span>
                </AccordionTrigger>
                <AccordionContent className="grid gap-3">
                  {crew.length === 0 && <p className="text-sm text-muted-foreground">{task.kind === 'design' ? 'No designer yet.' : 'Checklists are created when a crew is assigned.'}</p>}
                  {crew.map((p) => {
                    const rec = lists.find((c) => c.person === p);
                    const keys = plan.pre || plan.post ? stepOrder(task) : [];
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8"><AvatarFallback className="bg-secondary text-[11px] font-bold">{initials(p)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{p}</div>
                          <div className="text-xs text-muted-foreground">
                            {task.kind === 'design' ? 'designer' : p === task.leader ? 'team leader' : 'team member'}
                            {rec?.steps.post2 ? ` · ${rec.steps.post2.hours}h worked${rec.steps.post2.rating ? `, briefing ${rec.steps.post2.rating}/10` : ''}` : ''}
                          </div>
                        </div>
                        <div className="flex gap-1" aria-label={keys.map((k) => `${stepTitle(task, k)} ${rec?.steps[k] ? 'done' : 'open'}`).join(', ')}>
                          {keys.map((k) => <span key={k} title={`${stepTitle(task, k)}: ${rec?.steps[k] ? 'done' : 'open'}`} className={cn('h-1.5 w-6 rounded-full', rec?.steps[k] ? 'bg-brand' : 'bg-track')} />)}
                        </div>
                      </div>
                    );
                  })}
                  {canManage && ['fab', 'install'].includes(task.kind) && !DONE.includes(task.stage) && (
                    <Button variant="link" className="h-auto justify-start p-0 text-primary" onClick={() => onRequest('schedule', task)}>{crew.length ? 'Change crew' : 'Schedule a crew'}</Button>
                  )}
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="hours">
              <AccordionTrigger className="text-sm"><span className="flex flex-1 items-center justify-between pr-2">Hours &amp; cost<span className="text-xs font-normal text-muted-foreground">{task.booked || 0} of {task.quoted || 0}h</span></span></AccordionTrigger>
              <AccordionContent>
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Quoted</dt><dd className="m-0 font-semibold">{task.quoted || 0}h</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Proposed</dt><dd className="m-0 font-semibold">{task.proposed || 0}h</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Booked</dt><dd className="m-0 font-semibold">{task.booked || 0}h</dd></div>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">Booked hours come from the post-job checklists. Labour cost is on the Profit tab.</p>
              </AccordionContent>
            </AccordionItem>

            {spec && (
              <AccordionItem value="spec">
                <AccordionTrigger className="text-sm">{task.type} specification</AccordionTrigger>
                <AccordionContent className="text-sm">
                  {task.type === 'CCV' && spec.ccv && <p>Width {spec.ccv.width || '-'} · Height {spec.ccv.height || '-'} · Qty {spec.ccv.qty || '-'} · Vinyl {spec.ccv.vinyl || '-'}</p>}
                  {['CNC Laser', 'CNC Router'].includes(task.type) && spec.cnc && <p>Material {spec.cnc.material || '-'} · Thickness {spec.cnc.thickness || '-'}</p>}
                  {task.type === 'CLB' && spec.clb && <p>Material {spec.clb.material || '-'} · Return height {spec.clb.return_height || '-'}</p>}
                  {!['CCV', 'CNC Laser', 'CNC Router', 'CLB'].includes(task.type) && <p className="text-muted-foreground">No specification fields for this fab type.</p>}
                </AccordionContent>
              </AccordionItem>
            )}

            {task.pmReview && (
              <AccordionItem value="review">
                <AccordionTrigger className="text-sm">PM review</AccordionTrigger>
                <AccordionContent className="text-sm">
                  {task.pmReview.by}: OH&amp;S question {task.pmReview.ohs}{task.pmReview.mgmtReview ? ', management review flagged' : ''}
                  {task.pmReview.tlRating ? `, team leader rated ${task.pmReview.tlRating}/10` : ''}{task.pmReview.comment ? `. ${task.pmReview.comment}` : ''}
                </AccordionContent>
              </AccordionItem>
            )}

            <AccordionItem value="files">
              <AccordionTrigger className="text-sm"><span className="flex flex-1 items-center justify-between pr-2">Files<span className="text-xs font-normal text-muted-foreground">{files}</span></span></AccordionTrigger>
              <AccordionContent><Attachments taskId={task.id} /></AccordionContent>
            </AccordionItem>

            <AccordionItem value="activity" className="border-b-0">
              <AccordionTrigger className="text-sm">Activity</AccordionTrigger>
              <AccordionContent>
                {(task.history || []).length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
                <ul className="grid gap-3 text-sm">
                  {(task.history || []).map((h, i) => (
                    <li key={i} className={cn('border-l-2 pl-3', h.to && 'border-brand')}>
                      {h.to ? <><b>{h.from} → {h.to}</b> by {h.who}{h.text && !['Start'].includes(h.text) ? <span className="text-muted-foreground"> · {h.text}</span> : null}</> : <><b>{h.who}</b> {h.text}</>}
                      <div className="text-xs text-muted-foreground">{h.at}</div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Dialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
          {pending && (
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>{pending.kind === 'review' ? 'Review and approve' : pending.action}</DialogTitle>
                <DialogDescription>{task.name}</DialogDescription>
              </DialogHeader>
              <form className="form" onSubmit={submit} noValidate>
                {pending.kind === 'review' && flagged && <p className="muted">The crew flagged this task for management review.</p>}
                <label>Comments{pending.kind === 'review' ? ' (optional)' : ''}
                  <textarea autoFocus rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={pending.kind === 'review' ? 'Anything the team should know' : 'Tell the team why'} />
                </label>
                {pending.kind === 'review' && (
                  <>
                    <label>Was there an OH&amp;S incident or concern?
                      <select value={review.ohs} onChange={(e) => setReview((r) => ({ ...r, ohs: e.target.value }))}><option>No</option><option>Yes</option></select>
                    </label>
                    <label className="check"><input type="checkbox" checked={review.mgmtReview} onChange={(e) => setReview((r) => ({ ...r, mgmtReview: e.target.checked }))} />Needs management review</label>
                    {task.kind !== 'design' && (
                      <label>Team leader rating (1 to 10, optional)
                        <input type="number" min="1" max="10" step="1" value={review.tlRating} onChange={(e) => setReview((r) => ({ ...r, tlRating: e.target.value }))} />
                      </label>
                    )}
                  </>
                )}
                {error && <p className="form-error" role="alert">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setPending(null)}>Cancel</Button>
                  <Button type="submit" variant={pending.danger ? 'destructive' : 'default'}>{pending.kind === 'review' ? 'Approve' : pending.action}</Button>
                </div>
              </form>
            </DialogContent>
          )}
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
