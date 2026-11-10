import { useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Chip, Modal } from './ui';
import Attachments from './Attachments';
import { useDemo } from '../context/DemoContext';
import { MANAGER_ROLES, stepIndexFor, stepsFor, transitionsFor } from '../lib/workflow';
import { AssignDesignerModal, DeleteTaskModal, TaskEditModal } from './TaskForms';
import { checklistPlan, crewOf, stepOrder, stepTitle } from '../lib/checklists';
import { availableActions } from '../lib/taskActions';
import './ApprovalPanel.css';

// One approval component for Design, Fab and Install tasks. It also holds the manager's task actions,
// the crew checklist summary, the PM review (INS-5) and the stage history.
export default function ApprovalPanel({ task }) {
  const { roleId, role, actOnTask, runTaskAction, createSubtask, checklists } = useDemo();
  const [pending, setPending] = useState(null);
  const [comment, setComment] = useState('');
  const [review, setReview] = useState({ ohs: 'No', mgmtReview: false, tlRating: '' });
  const [error, setError] = useState('');
  const [modal, setModal] = useState('');

  const steps = stepsFor(task);
  const idx = stepIndexFor(task);
  const transitions = transitionsFor(task);
  const canManage = MANAGER_ROLES.includes(roleId);
  const extras = canManage ? availableActions(task) : [];
  const finalStage = steps[steps.length - 1];
  const canSub = canManage && ['install', 'fab'].includes(task.kind) && !['Cancelled', 'Complete - Not Used'].includes(task.stage);
  const plan = checklistPlan(task);
  const crew = crewOf(task);
  const lists = checklists.filter((c) => c.taskId === task.id);
  const flagged = lists.some((c) => c.steps.post2?.reviewFlag);
  const stageLog = (task.history || []).filter((h) => h.to);

  const open = (step, kind) => { setPending({ ...step, kind }); setComment(''); setError(''); setReview({ ohs: 'No', mgmtReview: flagged, tlRating: '' }); };
  const run = (step) => {
    if (step.assign) setModal('assign');
    else if (step.action === 'Approve') open(step, 'review');
    else if (step.comment) open(step, 'transition');
    else actOnTask(task.id, step.action);
  };
  const runExtra = (a) => {
    if (a.comment) open({ action: a.label, id: a.id, comment: true, danger: a.danger }, 'extra');
    else runTaskAction(task.id, a.id);
  };

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

  return (
    <div className="approval">
      <div className="approval-head">
        <div className="stack"><strong>{task.name}</strong><small>{task.jobId} · {task.kind} task</small></div>
        <Chip value={task.stage} />
      </div>

      <ol className="stepper" aria-label="Task progress" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
        {steps.map((s, i) => {
          const state = task.stage === finalStage || i < idx ? 'done' : i === idx ? 'current' : '';
          return <li key={s} className={state}><span>{state === 'done' ? <Check size={13} aria-hidden="true" /> : i + 1}</span>{s}</li>;
        })}
      </ol>
      {(task.stage === 'Rejected' || task.stage === 'Reopen') && <p className="form-error">This task was sent back. See the history for the reason.</p>}
      {task.stage === 'On Hold' && <p className="muted">This task is on hold. Take it off hold to carry on.</p>}
      {task.kind === 'design' && <p className="muted">Designer: <strong>{task.owner || 'not assigned yet'}</strong></p>}

      <div className="approval-actions">
        {transitions.map((step) => {
          const locked = step.manager && !canManage;
          return (
            <button key={step.action} type="button" disabled={locked}
              title={locked ? 'Only a Project Manager or Fab Manager can do this' : ''}
              className={`btn btn-sm ${step.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => run(step)}>
              {step.action === 'Approve' ? 'Review and approve' : step.action}
            </button>
          );
        })}
        {transitions.length === 0 && extras.length === 0 && <small className="muted">No actions available.</small>}
      </div>

      {(extras.length > 0 || canSub) && (
        <div className="approval-actions" aria-label="Task actions">
          {extras.map((a) => (
            <button key={a.id} type="button" className={`btn btn-sm ${a.danger ? 'btn-danger' : 'btn-ghost'}`} onClick={() => runExtra(a)}>{a.label}</button>
          ))}
          {canSub && <button type="button" className="btn btn-ghost btn-sm" onClick={() => createSubtask(task.id)}>Create subtask</button>}
        </div>
      )}

      {canManage && (
        <div className="approval-actions" aria-label="Edit task">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('edit')}><Pencil size={14} aria-hidden="true" /> Edit task</button>
          {task.kind === 'design' && task.stage === 'Assigned' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('assign')}>Change designer</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('delete')}><Trash2 size={14} aria-hidden="true" /> Delete task</button>
        </div>
      )}
      {modal === 'edit' && <TaskEditModal task={task} onClose={() => setModal('')} />}
      {modal === 'assign' && <AssignDesignerModal task={task} onClose={() => setModal('')} />}
      {modal === 'delete' && <DeleteTaskModal task={task} onClose={() => setModal('')} />}

      {task.pmReview && (
        <>
          <h3 className="mini-title">PM review</h3>
          <p className="muted">
            {task.pmReview.by}: OH&S question {task.pmReview.ohs}{task.pmReview.mgmtReview ? ', management review flagged' : ''}
            {task.pmReview.tlRating ? `, team leader rated ${task.pmReview.tlRating}/10` : ''}{task.pmReview.comment ? `. ${task.pmReview.comment}` : ''}
          </p>
        </>
      )}

      {(plan.pre || plan.post) && (
        <>
          <h3 className="mini-title">Crew checklists</h3>
          {crew.length === 0 ? <p className="muted">Checklists are created when a crew is assigned.</p> : (
            <ul className="history">
              {crew.map((p) => {
                const rec = lists.find((c) => c.person === p);
                return (
                  <li key={p}>
                    <strong>{p}</strong> {task.kind === 'design' ? '(designer)' : p === task.leader ? '(team leader)' : '(team member)'}
                    {stepOrder(task).map((k) => ` ${stepTitle(task, k)}: ${rec?.steps[k] ? 'done' : 'open'}`).join(' · ')}
                    {rec?.steps.post2 && <small>{rec.steps.post2.hours}h worked{rec.steps.post2.unbilled ? `, ${rec.steps.post2.unbilled}h unbilled` : ''}{rec.steps.post2.rating ? `, briefing rated ${rec.steps.post2.rating}/10` : ''}{rec.steps.post2.reviewFlag ? ', review flagged' : ''}</small>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Attachments taskId={task.id} />

      {stageLog.length > 0 && (
        <>
          <h3 className="mini-title">Stage history</h3>
          <table className="mini-table">
            <thead><tr><th>When</th><th>From</th><th>To</th><th>By</th></tr></thead>
            <tbody>{stageLog.map((h, i) => <tr key={i}><td>{h.at}</td><td>{h.from}</td><td>{h.to}</td><td>{h.who}</td></tr>)}</tbody>
          </table>
        </>
      )}

      <h3 className="mini-title">History</h3>
      {(task.history || []).length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="history">
        {(task.history || []).map((h, i) => <li key={i}><strong>{h.who}</strong> {h.text}<small>{h.at}</small></li>)}
      </ul>

      {pending && (
        <Modal title={pending.kind === 'review' ? 'Review and approve' : pending.action} onClose={() => setPending(null)}>
          <form className="form" onSubmit={submit} noValidate>
            {pending.kind === 'review' && flagged && <p className="muted">The crew flagged this task for management review.</p>}
            <label>Comments{pending.kind === 'review' ? ' (optional)' : ''}
              <textarea autoFocus rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={pending.kind === 'review' ? 'Anything the team should know' : 'Tell the team why'} />
            </label>
            {pending.kind === 'review' && (
              <>
                <label>Was there an OH&S incident or concern?
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
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              <button type="submit" className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}>{pending.kind === 'review' ? 'Approve' : pending.action}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
