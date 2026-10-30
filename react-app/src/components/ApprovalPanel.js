import { useState } from 'react';
import { Check } from 'lucide-react';
import { Chip, Modal } from './ui';
import { useDemo } from '../context/DemoContext';
import { MANAGER_ROLES, STEPS, TRANSITIONS, stepIndex } from '../lib/workflow';

// One approval component for Design, Fab and Install tasks.
export default function ApprovalPanel({ task }) {
  const { roleId, actOnTask } = useDemo();
  const [pending, setPending] = useState(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const idx = stepIndex(task.stage);
  const actions = TRANSITIONS[task.stage] || [];
  const canManage = MANAGER_ROLES.includes(roleId);

  const run = (step) => {
    if (step.comment) { setPending(step); setComment(''); setError(''); } else actOnTask(task.id, step.action);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!comment.trim()) return setError('A comment is required.');
    actOnTask(task.id, pending.action, comment.trim());
    return setPending(null);
  };

  return (
    <div className="approval">
      <div className="approval-head">
        <div className="stack"><strong>{task.name}</strong><small>{task.jobId} · {task.kind} task</small></div>
        <Chip value={task.stage} />
      </div>

      <ol className="stepper" aria-label="Task progress">
        {STEPS.map((s, i) => {
          const state = task.stage === 'Completed' || i < idx ? 'done' : i === idx ? 'current' : '';
          return <li key={s} className={state}><span>{state === 'done' ? <Check size={13} aria-hidden="true" /> : i + 1}</span>{s}</li>;
        })}
      </ol>
      {(task.stage === 'Rejected' || task.stage === 'Reopen') && <p className="form-error">This task was sent back. See the history for the reason.</p>}

      <div className="approval-actions">
        {actions.map((step) => {
          const locked = step.manager && !canManage;
          return (
            <button key={step.action} type="button" disabled={locked}
              title={locked ? 'Only a Project Manager or Fab Manager can do this' : ''}
              className={`btn btn-sm ${step.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => run(step)}>
              {step.action}
            </button>
          );
        })}
        {actions.length === 0 && <small className="muted">No actions available.</small>}
      </div>

      <h3 className="mini-title">History</h3>
      {(task.history || []).length === 0 && <p className="muted">No activity yet.</p>}
      <ul className="history">
        {(task.history || []).map((h, i) => <li key={i}><strong>{h.who}</strong> {h.text}<small>{h.at}</small></li>)}
      </ul>

      {pending && (
        <Modal title={pending.action} onClose={() => setPending(null)}>
          <form className="form" onSubmit={submit} noValidate>
            <label>Comments
              <textarea autoFocus rows={4} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell the team why" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPending(null)}>Cancel</button>
              <button type="submit" className={`btn ${pending.danger ? 'btn-danger' : 'btn-primary'}`}>{pending.action}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
