import { useState } from 'react';
import { Modal } from './ui';
import { useDemo } from '../context/DemoContext';
import { MAX_HOURS, WARN_HOURS, roleOf, stepTitle, swmsReady, validateStep } from '../lib/checklists';

const Check = ({ checked, onChange, children }) => (
  <label className="check"><input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />{children}</label>
);

// One checklist step for one crew member. The questions depend on the step, the person's role (team leader or member) and the task kind.
export default function ChecklistDialog({ task, person, step, swmsStatus, onClose }) {
  const { completeChecklistStep } = useDemo();
  const role = roleOf(task, person);
  const isFab = task.kind === 'fab';
  const [d, setD] = useState({ ohsConcern: 'No', ohsDetail: '', hours: '', unbilled: '', rating: '', photos: [] });
  const [error, setError] = useState('');
  const put = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const text = (k) => (e) => put(k)(e.target.value);

  const hours = Number(d.hours);
  const needsConfirm = step === 'post2' && hours > WARN_HOURS && hours <= MAX_HOURS;
  const swmsBlocked = step === 'pre1' && role === 'TL' && task.type === 'VE Install' && !swmsReady(swmsStatus);

  const submit = (e) => {
    e.preventDefault();
    const ctx = { kind: task.kind, swmsStatus: step === 'pre1' && role === 'TL' && task.type === 'VE Install' ? swmsStatus : undefined };
    const why = validateStep(step, role, d, ctx) || completeChecklistStep(task.id, person, step, d);
    if (why) return setError(why);
    return onClose();
  };

  return (
    <Modal title={`${stepTitle(task, step)}: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <small>{person} · {role === 'TL' ? 'Team leader' : 'Team member'}</small>

        {step === 'pre1' && isFab && (
          <>
            <Check checked={d.areaSafe} onChange={put('areaSafe')}>The work area is clear and safe</Check>
            <Check checked={d.ppeChecked} onChange={put('ppeChecked')}>I have the PPE this task needs</Check>
            <Check checked={d.equipmentChecked} onChange={put('equipmentChecked')}>I checked the equipment I will use</Check>
          </>
        )}
        {step === 'pre1' && !isFab && role === 'TL' && (
          <>
            <Check checked={d.briefed} onChange={put('briefed')}>I briefed the crew on the job, the hazards and the SWMS</Check>
            {task.type === 'VE Install' && (
              <p className={swmsBlocked ? 'form-error' : 'muted'} role={swmsBlocked ? 'alert' : undefined}>
                SWMS status: {swmsStatus}. {swmsBlocked ? 'It must be signed by the PM and then the team leader before you can finish this step.' : 'Requirement met.'}
              </p>
            )}
          </>
        )}
        {step === 'pre1' && !isFab && role === 'TM' && (
          <Check checked={d.understood} onChange={put('understood')}>I was briefed and I understand the SWMS</Check>
        )}
        {step === 'pre2' && <Check checked={d.arrived} onChange={put('arrived')}>The crew has arrived on site</Check>}
        {step === 'post1' && (
          <>
            <Check checked={d.workComplete} onChange={put('workComplete')}>The on-site work is complete</Check>
            <Check checked={d.siteClean} onChange={put('siteClean')}>The site is clean and tools are packed</Check>
          </>
        )}
        {step === 'post2' && (
          <>
            <div className="form-row">
              <label>Hours worked<input type="number" step="0.5" min="0" value={d.hours} onChange={text('hours')} /></label>
              <label>Unbilled hours<input type="number" step="0.5" min="0" max={MAX_HOURS} value={d.unbilled} onChange={text('unbilled')} placeholder="0" /></label>
            </div>
            {needsConfirm && <Check checked={d.hoursConfirmed} onChange={put('hoursConfirmed')}>Yes, {hours} hours is correct</Check>}
            {!isFab && role === 'TM' && (
              <label>How good was the job briefing? (1 to 10)<input type="number" min="1" max="10" step="1" value={d.rating} onChange={text('rating')} /></label>
            )}
            <Check checked={d.reviewFlag} onChange={put('reviewFlag')}>This task needs a management review</Check>
          </>
        )}

        {['pre2', 'post1'].includes(step) && (
          <label>Photos (optional)
            <input type="file" accept="image/*" multiple onChange={(e) => put('photos')([...e.target.files].map((f) => f.name))} />
            <small>Demo: only the file names are kept. Real uploads need the backend.</small>
          </label>
        )}

        <label>Any OH&S or WHS concern?
          <select value={d.ohsConcern} onChange={text('ohsConcern')}><option>No</option><option>Yes</option></select>
        </label>
        {d.ohsConcern === 'Yes' && (
          <label>What happened?<textarea rows={3} value={d.ohsDetail} onChange={text('ohsDetail')} placeholder="An issue is raised for the department manager" /></label>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Complete step</button>
        </div>
      </form>
    </Modal>
  );
}
