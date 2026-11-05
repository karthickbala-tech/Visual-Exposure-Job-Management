import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, PencilRuler, RotateCcw, UserPlus } from 'lucide-react';
import ChecklistDialog from '../components/ChecklistDialog';
import { AssignDesignerModal } from '../components/TaskForms';
import { Modal, PageHeader } from '../components/ui';
import KpiLink from '../components/KpiLink';
import TaskList from '../components/TaskList';
import TaskDrawer from '../components/TaskDrawer';
import { SavedViews } from '../components/ListKit';
import { StageBadge } from '../components/StageBadge';
import { AssignDesignerModal as AssignModal2, DeleteTaskModal, TaskEditModal } from '../components/TaskForms';
import { useDemo } from '../context/DemoContext';
import { formatShort, fullDate, toKey, today } from '../lib/dates';
import { nextStep, stepTitle } from '../lib/checklists';
import { shortName } from '../lib/people';
import { MANAGER_ROLES } from '../lib/workflow';
import './DesignPage.css';

// Design types from the Creator Design Task form. Colours are only for the legend dots.
const DESIGN_TYPES = { 'Artwork Sign Off': '#2f80ed', 'Install Plan': '#0f9d8a', 'LED Design': '#d4a900', 'Manufacturing Sign Off': '#a855f7', 'Proof Of Posting': '#ec4899', 'Project Management': '#475569' };
// WORKFLOWS section 6, in the order a design task moves.
const COLUMNS = ['To be Assigned', 'Assigned', 'In Progress', 'Client Review', 'Open', 'Awaiting Submission', 'Manager Review', 'Reopen', 'On Hold', 'Approved & Completed'];
const DONE = ['Completed', 'Approved & Completed', 'Cancelled', 'Complete - Not Used'];
const isOpen = (t) => !DONE.includes(t.stage);

export default function DesignPage() {
  const { tasks, jobs, roleId, role, actOnTask, checklists } = useDemo();
  const [filter, setFilter] = useState('open');
  const [view, setView] = useState('board');
  const [assigning, setAssigning] = useState(null);
  const [checklist, setChecklist] = useState(null);
  const [asking, setAsking] = useState(null);
  const [comment, setComment] = useState('');
  const [openId, setOpenId] = useState(null);
  const [req, setReq] = useState(null);
  const key = toKey(today());
  const me = shortName(role.name);
  const isPm = roleId === 'pm';
  const canApprove = MANAGER_ROLES.includes(roleId);
  const design = tasks.filter((t) => t.kind === 'design');
  const open = design.filter(isOpen);
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  // DES-3: overdue when the required finish has passed and the task is not finished.
  const late = (t) => isOpen(t) && t.date < key;
  const mineToDo = (t) => t.owner === me && isOpen(t);

  const FILTERS = [
    ['open', 'All open', open],
    ...(roleId === 'designer' ? [['mine', 'My tasks', open.filter(mineToDo)]] : []),
    ['unassigned', 'To be assigned', open.filter((t) => t.stage === 'To be Assigned')],
    ['late', 'Overdue', open.filter(late)],
    ['review', 'Awaiting approval', open.filter((t) => ['Awaiting Submission', 'Manager Review'].includes(t.stage))],
    ['back', 'Sent back', open.filter((t) => t.stage === 'Reopen')],
    ['done', 'Completed', design.filter((t) => ['Approved & Completed', 'Completed'].includes(t.stage))],
  ];
  const count = (id) => FILTERS.find((f) => f[0] === id)?.[2].length ?? 0;
  const shown = FILTERS.find((f) => f[0] === filter)[2];
  const rows = [...shown].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // The one next thing for this task, for this person. Approving with the PM review happens on the job page.
  function Actions({ t }) {
    const rec = checklists.find((c) => c.taskId === t.id && c.person === t.owner);
    const step = t.owner === me ? nextStep(t, rec) : { step: null };
    const why = !t.booked ? 'Booked hours are required. They come from the hand-off checklist.' : '';
    return (
      <div className="row-actions">
        {t.stage === 'To be Assigned' && canApprove && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAssigning(t)}><UserPlus size={14} aria-hidden="true" /> Assign</button>}
        {t.stage === 'Assigned' && t.owner === me && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Start')}>Start</button>}
        {step.step && ['In Progress', 'Open', 'Reopen'].includes(t.stage) && <button type="button" className="btn btn-primary btn-sm" onClick={() => setChecklist({ task: t, step: step.step })}>{stepTitle(t, step.step)}</button>}
        {t.stage === 'In Progress' && (t.owner === me || canApprove) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAsking(t); setComment(''); }}>Send to client</button>}
        {t.stage === 'Client Review' && (t.owner === me || canApprove) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => actOnTask(t.id, 'Client replied')}>Client replied</button>}
        {t.stage === 'Awaiting Submission' && (t.owner === me || canApprove) && <button type="button" className="btn btn-primary btn-sm" disabled={Boolean(why)} title={why} onClick={() => actOnTask(t.id, 'Submit for approval')}>Submit for approval</button>}
        <Link className="btn btn-ghost btn-sm" to={`/jobs/${t.jobId}`}>{t.stage === 'Manager Review' && canApprove ? 'Review' : 'Open'}</Link>
      </div>
    );
  }


  const boardCols = COLUMNS.filter((st) => !['On Hold', 'Client Review', 'Reopen'].includes(st) || rows.some((t) => t.stage === st));

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Design" subtitle="Artwork, install plans, LED designs and sign-offs for every job.">
        {isPm && <Link className="btn btn-primary" to="/jobs">Create from a job</Link>}
      </PageHeader>

      <div className="kpis">
        <KpiLink icon={PencilRuler} label="Open design tasks" value={open.length} note={`${count('unassigned')} waiting for a designer`} onClick={() => setFilter('open')} active={filter === 'open'} />
        <KpiLink icon={AlertTriangle} label="Overdue" value={count('late')} tone="danger" note="past the required finish" onClick={() => setFilter('late')} active={filter === 'late'} />
        <KpiLink icon={Clock} label="Awaiting approval" value={count('review')} tone="warn" note={canApprove ? 'ready for you to review' : 'with the manager'} onClick={() => setFilter('review')} active={filter === 'review'} />
        <KpiLink icon={RotateCcw} label="Sent back" value={count('back')} note="rejected and reopened" onClick={() => setFilter('back')} active={filter === 'back'} />
        <KpiLink icon={CheckCircle2} label="Completed" value={count('done')} note="all time" onClick={() => setFilter('done')} active={filter === 'done'} />
      </div>

      <div className="ui-scope flex flex-wrap items-center gap-2 font-sans">
        <SavedViews label="Task filter" value={filter} onChange={setFilter} views={FILTERS.map(([id, label, list]) => ({ id, label, count: list.length }))} />
        <span className="grow" />
        <SavedViews label="View" value={view} onChange={setView} views={[{ id: 'board', label: 'Board' }, { id: 'list', label: 'List' }]} />
      </div>

      {view === 'list' ? (
        <TaskList title="Design tasks" views={[{ id: filter, label: FILTERS.find((f) => f[0] === filter)[1], rows }]} view={filter} onView={() => {}} typeColors={DESIGN_TYPES} jobName={jobName} emptyText="No design tasks in this view" />
      ) : (
        <div className="dkanban">
          {boardCols.map((st) => {
            const col = rows.filter((t) => t.stage === st);
            return (
              <section key={st} className="dcol" aria-label={st}>
                <h3>{st}<span>{col.length}</span></h3>
                {col.length === 0 && <p className="dempty">Nothing here</p>}
                {col.map((t) => (
                  <article key={t.id} className={`dcard ${late(t) ? 'late' : ''}`} style={{ '--c': DESIGN_TYPES[t.type] || '#9aa39a' }}>
                    <button type="button" className="dcard-title text-left" onClick={() => setOpenId(t.id)}><strong>{t.name}</strong></button>
                    <small>{t.jobId} · {jobName(t.jobId)}</small>
                    <small>{t.owner || 'Not assigned'} · due {formatShort(t.date)}{late(t) ? ' (overdue)' : ''}</small>
                    {['On Hold', 'Client Review', 'Reopen'].includes(t.stage) && <StageBadge stage={t.stage} className="w-fit" />}
                    <Actions t={t} />
                  </article>))}
              </section>);
          })}
        </div>
      )}

      {assigning && <AssignDesignerModal task={assigning} onClose={() => setAssigning(null)} />}
      <TaskDrawer task={design.find((t) => t.id === openId) || null} onClose={() => setOpenId(null)} onRequest={(kind, task) => { setOpenId(null); setReq({ kind, task }); }} />
      {req?.kind === 'edit' && <TaskEditModal task={design.find((t) => t.id === req.task.id) || req.task} onClose={() => setReq(null)} />}
      {req?.kind === 'assign' && <AssignModal2 task={design.find((t) => t.id === req.task.id) || req.task} onClose={() => setReq(null)} />}
      {req?.kind === 'delete' && <DeleteTaskModal task={req.task} onClose={() => setReq(null)} />}
      {checklist && <ChecklistDialog task={checklist.task} person={me} step={checklist.step} onClose={() => setChecklist(null)} />}
      {asking && (
        <Modal title={`Send to client: ${asking.name}`} onClose={() => setAsking(null)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); if (actOnTask(asking.id, 'Send to client', comment.trim())) setAsking(null); }} noValidate>
            <label>What did you send?<textarea autoFocus rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="For example: proof rev B for sign-off" /></label>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setAsking(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!comment.trim()}>Send to client</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
