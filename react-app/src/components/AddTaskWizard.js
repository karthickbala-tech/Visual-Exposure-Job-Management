import { useState } from 'react';
import { Check, Hammer, PenTool, Truck, Wrench } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui-kit/dialog';
import { Button } from './ui-kit/button';
import { Separator } from './ui-kit/separator';
import { CrewFields, TYPES_FOR } from './TaskForms';
import { useDemo } from '../context/DemoContext';
import { designerOptions } from '../lib/people';
import { formatShort } from '../lib/dates';
import { cn } from '../lib/utils';

export const KINDS = [
  { id: 'design', label: 'Design task', icon: PenTool, hint: 'Artwork, plans, LED design, sign-offs' },
  { id: 'fab', label: 'Fabrication task', icon: Hammer, hint: 'Workshop work with a team leader and crew' },
  { id: 'install', label: 'Install task', icon: Truck, hint: 'Site work; needs a SWMS for VE installs' },
  { id: 'minor', label: 'Minor install', icon: Wrench, hint: 'A small site job, no SWMS' },
];
const STEPS = ['What', 'Details', 'People', 'Review'];
const SPEC_TYPES = ['CCV', 'CNC Laser', 'CNC Router', 'CLB'];

const blank = (kind) => ({
  kind, type: kind === 'fab' ? 'CCV' : kind === 'install' ? 'VE Install' : kind === 'minor' ? 'Minor Task' : 'Artwork Sign Off',
  name: '', date: '', quoted: '', proposed: '', signGroup: '', description: '', owner: '', leader: '', members: [],
  width: '', height: '', qty: '', vinyl: '', material: '', thickness: '', returnHeight: '',
});

// Add task in four short steps: what, details, people, review. Same rules as the old one-page form.
export default function AddTaskWizard({ job, kind, groups = [], onClose }) {
  const { addTask, addInstallTask, addDesignTask, workers, tasks } = useDemo();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(() => blank(kind || 'fab'));
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const crewKind = f.kind === 'minor' ? 'install' : f.kind;
  const typesFor = f.kind === 'minor' ? [] : TYPES_FOR[f.kind];
  const designers = designerOptions(workers, tasks);
  const kindLabel = KINDS.find((k) => k.id === f.kind).label.toLowerCase();

  const pickKind = (id) => setF((x) => ({ ...blank(id), name: x.name, date: x.date, quoted: x.quoted, proposed: x.proposed }));
  const next = () => {
    setError('');
    if (step === 1) {
      if (!f.name.trim() || !f.date) return setError('Please fill the mandatory fields');
      if ([f.quoted, f.proposed].some((v) => v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0))) return setError('Hours must be zero or more.');
    }
    return setStep((s) => s + 1);
  };

  const create = () => {
    const common = { name: f.name.trim(), jobId: job.id, date: f.date, quoted: Number(f.quoted) || 0, proposed: Number(f.proposed) || 0 };
    let ok;
    if (f.kind === 'design') ok = addDesignTask({ ...common, type: f.type, due: f.date, description: f.description, owner: f.owner });
    else if (f.kind === 'fab') {
      ok = addTask({
        ...common, type: f.type, signGroup: f.signGroup, leader: f.leader, members: f.members,
        spec: { ccv: { width: Number(f.width) || 0, height: Number(f.height) || 0, qty: Number(f.qty) || 0, vinyl: f.vinyl }, cnc: { material: f.material, thickness: Number(f.thickness) || 0 }, clb: { material: f.material, return_height: Number(f.returnHeight) || 0 } },
      });
    } else ok = addInstallTask({ ...common, type: f.kind === 'minor' ? 'Minor Task' : f.type, signGroup: f.signGroup, leader: f.leader, members: f.members });
    if (ok !== false) onClose();
  };

  const people = f.kind === 'design' ? (f.owner || 'Assign later') : (f.leader ? [f.leader, ...f.members].join(', ') : 'Schedule later');
  const review = [
    ['Type', `${KINDS.find((k) => k.id === f.kind).label}${f.kind !== 'minor' ? ` · ${f.type}` : ''}`],
    ['Name', f.name], [f.kind === 'design' ? 'Required finish' : 'Date', f.date ? formatShort(f.date) : '-'],
    ['Hours', `${Number(f.quoted) || 0}h quoted${f.proposed ? `, ${f.proposed}h proposed` : ''}`],
    ...(f.signGroup ? [['Sign group', f.signGroup]] : []),
    [f.kind === 'design' ? 'Designer' : 'Crew', people],
    ...(f.leader || f.owner ? [] : [['Starts as', f.kind === 'design' ? 'To be Assigned' : 'Awaiting Scheduling']]),
  ];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[600px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Add a {kindLabel} to {job.id}</DialogTitle>
          <DialogDescription>Step {step + 1} of 4{step === 1 && f.kind === 'fab' ? ' · only the spec for the type you chose is shown' : ''}</DialogDescription>
        </DialogHeader>
        <ol className="m-0 flex list-none gap-2 p-0" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li key={s} className={cn('flex flex-1 items-center gap-2 text-xs font-semibold', i > step && 'text-muted-foreground')} aria-current={i === step ? 'step' : undefined}>
              <span className={cn('grid h-6 w-6 place-items-center rounded-full border-2 border-input text-[11px]', i < step && 'border-primary bg-primary text-primary-foreground', i === step && 'border-primary text-primary')}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>{s}
            </li>
          ))}
        </ol>
        <Separator />

        <div className="form" style={{ padding: 0 }}>
          {step === 0 && (
            <>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Task type">
                {KINDS.map(({ id, label, icon: Icon, hint }) => (
                  <button key={id} type="button" role="radio" aria-checked={f.kind === id} onClick={() => pickKind(id)}
                    className={cn('flex items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent/60', f.kind === id ? 'border-primary bg-accent' : 'border-input bg-card')}>
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
                  </button>
                ))}
              </div>
              {typesFor.length > 0 && (
                <label>{f.kind === 'fab' ? 'Fab type' : f.kind === 'install' ? 'Install type' : 'Design type'}
                  <select value={f.type} onChange={set('type')}>{typesFor.map((x) => <option key={x}>{x}</option>)}</select>
                </label>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <label>Task name *<input autoFocus value={f.name} onChange={set('name')} /></label>
              <div className="form-row">
                <label>{f.kind === 'design' ? 'Required finish *' : 'Scheduled date *'}<input type="date" value={f.date} onChange={set('date')} /></label>
                {f.kind !== 'design' && groups.length > 0
                  ? <label>Sign group<select value={f.signGroup} onChange={set('signGroup')}><option value="">None</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
                  : <span />}
              </div>
              <div className="form-row">
                <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
                <label>Proposed hours<input type="number" min="0" step="0.5" value={f.proposed} onChange={set('proposed')} placeholder="Optional" /></label>
              </div>
              {f.kind === 'fab' && f.type === 'CCV' && (
                <fieldset><legend>CCV specification</legend>
                  <div className="form-row"><label>Width<input type="number" value={f.width} onChange={set('width')} /></label><label>Height<input type="number" value={f.height} onChange={set('height')} /></label><label>Quantity<input type="number" value={f.qty} onChange={set('qty')} /></label></div>
                  <label>Vinyl brand / colour<input value={f.vinyl} onChange={set('vinyl')} /></label>
                </fieldset>
              )}
              {f.kind === 'fab' && ['CNC Laser', 'CNC Router'].includes(f.type) && (
                <fieldset><legend>CNC specification</legend><div className="form-row"><label>Material<input value={f.material} onChange={set('material')} /></label><label>Thickness<input type="number" value={f.thickness} onChange={set('thickness')} /></label></div></fieldset>
              )}
              {f.kind === 'fab' && f.type === 'CLB' && (
                <fieldset><legend>CLB specification</legend><div className="form-row"><label>Material<input value={f.material} onChange={set('material')} /></label><label>Return height<input type="number" value={f.returnHeight} onChange={set('returnHeight')} /></label></div></fieldset>
              )}
              {f.kind === 'fab' && !SPEC_TYPES.includes(f.type) && <small>{f.type} has no specification fields.</small>}
              {f.kind === 'design' && <label>Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>}
            </>
          )}

          {step === 2 && (f.kind === 'design' ? (
            <label>Designer<select autoFocus value={f.owner} onChange={set('owner')}><option value="">Assign later</option>{designers.map((d) => <option key={d}>{d}</option>)}</select>
              <small>Leave as "Assign later" and the task waits in To be Assigned.</small>
            </label>
          ) : (
            <>
              <CrewFields kind={crewKind} leader={f.leader} members={f.members} onChange={(c) => setF((x) => ({ ...x, ...c }))} />
              <small>Optional. With a team leader the task starts as Scheduled for {f.date ? formatShort(f.date) : 'the date in step 2'}; without one it waits in Awaiting Scheduling.</small>
            </>
          ))}

          {step === 3 && (
            <dl className="m-0 grid gap-0 rounded-md border">
              {review.map(([k, v], i) => (
                <div key={k} className={cn('grid grid-cols-[140px_1fr] gap-3 px-3 py-2 text-sm', i > 0 && 'border-t')}>
                  <dt className="text-muted-foreground">{k}</dt><dd className="m-0 font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {step === 0 ? <Button variant="outline" onClick={onClose}>Cancel</Button> : <Button variant="outline" onClick={() => { setError(''); setStep((s) => s - 1); }}>Back</Button>}
          {step < 3 ? <Button onClick={next}>Next: {STEPS[step + 1].toLowerCase()}</Button> : <Button onClick={create}>Create task</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
