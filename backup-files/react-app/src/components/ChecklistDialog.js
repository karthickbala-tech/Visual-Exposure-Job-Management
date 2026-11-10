import { useState } from 'react';
import { Modal } from './ui';
import { useDemo } from '../context/DemoContext';
import { Camera, Check as Tick, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui-kit/collapsible';
import { MAX_HOURS, WARN_HOURS, roleOf, stepOrder, stepTitle, swmsReady, validateStep } from '../lib/checklists';
import { cn } from '../lib/utils';

const Check = ({ checked, onChange, children }) => (
  <label className="check"><input type="checkbox" checked={Boolean(checked)} onChange={(e) => onChange(e.target.checked)} />{children}</label>
);

// One checklist step for one crew member. The questions depend on the step, the person's role (team leader or member) and the task kind.
export default function ChecklistDialog({ task, person, step, swmsStatus, onClose }) {
  const { completeChecklistStep, checklists } = useDemo();
  const rec = checklists.find((c) => c.taskId === task.id && c.person === person);
  const order = stepOrder(task);
  const at = order.indexOf(step);
  const role = roleOf(task, person);
  const isFab = task.kind === 'fab';
  const isDesign = task.kind === 'design';
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
        <small>{person} · {isDesign ? 'Designer' : role === 'TL' ? 'Team leader' : 'Team member'}{at >= 0 ? ` · step ${at + 1} of ${order.length}` : ''}</small>
        {order.length > 1 && (
          <ol className="m-0 flex list-none gap-1 p-0" aria-label="Checklist steps">
            {order.map((k, i) => {
              const done = Boolean(rec?.steps?.[k]);
              return (
                <li key={k} className={cn('flex flex-1 flex-col gap-1 text-[11px] font-semibold text-muted-foreground', k === step && 'text-foreground')}>
                  <span className={cn('h-1.5 rounded-full', done ? 'bg-primary' : k === step ? 'bg-brand' : 'bg-track')} />
                  <span className="flex items-center gap-1">{done && <Tick className="h-3 w-3 text-primary" aria-hidden="true" />}{stepTitle(task, k)}</span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="m-0 text-xs font-semibold text-muted-foreground">Tick each line that is true</p>

        {step === 'pre1' && isDesign && (
          <>
            <Check checked={d.briefRead} onChange={put('briefRead')}>I read the brief, the quote and the sign schedule</Check>
            <Check checked={d.filesChecked} onChange={put('filesChecked')}>I checked the source files, site photos and measurements</Check>
            <Check checked={d.questionsRaised} onChange={put('questionsRaised')}>I raised any open questions with the PM</Check>
          </>
        )}

        {step === 'pre1' && isFab && (
          <>
            <Check checked={d.areaSafe} onChange={put('areaSafe')}>The work area is clear and safe</Check>
            <Check checked={d.ppeChecked} onChange={put('ppeChecked')}>I have the PPE this task needs</Check>
            <Check checked={d.equipmentChecked} onChange={put('equipmentChecked')}>I checked the equipment I will use</Check>
          </>
        )}
        {step === 'pre1' && !isFab && !isDesign && role === 'TL' && (
          <>
            <Check checked={d.briefed} onChange={put('briefed')}>I briefed the crew on the job, the hazards and the SWMS</Check>
            {task.type === 'VE Install' && (
              <p className={swmsBlocked ? 'form-error' : 'muted'} role={swmsBlocked ? 'alert' : undefined}>
                SWMS status: {swmsStatus}. {swmsBlocked ? 'It must be signed by the PM and then the team leader before you can finish this step.' : 'Requirement met.'}
              </p>
            )}
          </>
        )}
        {step === 'pre1' && !isFab && !isDesign && role === 'TM' && (
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
            {isDesign && (
              <>
                <Check checked={d.filesSaved} onChange={put('filesSaved')}>Final files are saved to the job folder</Check>
                <Check checked={d.proofSent} onChange={put('proofSent')}>The proof or drawing is ready for the PM to review</Check>
              </>
            )}
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
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-2 text-sm font-semibold text-primary">
              <Camera className="h-4 w-4" aria-hidden="true" /> Add photos (optional){d.photos.length ? ` · ${d.photos.length} chosen` : ''}
              <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" aria-hidden="true" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <label>Photos
                <input type="file" accept="image/*" multiple onChange={(e) => put('photos')([...e.target.files].map((f) => f.name))} />
                <small>Demo: only the file names are kept. Real uploads need the backend.</small>
              </label>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="grid gap-1.5">
          <span className="text-[13px] font-semibold" id={`ohs-${task.id}`}>Any OH&amp;S or WHS concern?</span>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={`ohs-${task.id}`}>
            {['No', 'Yes'].map((v) => (
              <button key={v} type="button" role="radio" aria-checked={d.ohsConcern === v} onClick={() => put('ohsConcern')(v)}
                className={cn('h-11 rounded-md border text-sm font-semibold', d.ohsConcern === v ? (v === 'Yes' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-primary bg-accent text-primary') : 'border-input bg-card text-foreground')}>
                {v === 'No' ? 'No concern' : 'Yes, report it'}
              </button>
            ))}
          </div>
        </div>
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
