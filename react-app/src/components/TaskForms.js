import { useState } from 'react';
import { Modal } from './ui';
import { useDemo } from '../context/DemoContext';
import { crewOptions, designerOptions, membersOf } from '../lib/people';
import { FAB_TYPES } from '../data/fabTypes';

const INSTALL_TYPES = ['VE Install', 'VE Subtask', 'Minor Task', 'External Install', 'Print Only'];
const DESIGN_TYPES = ['Artwork Sign Off', 'Install Plan', 'LED Design', 'Manufacturing Sign Off', 'Proof Of Posting', 'Project Management'];
export const TYPES_FOR = { fab: FAB_TYPES, install: INSTALL_TYPES, design: DESIGN_TYPES };

// TSK-3: one team leader and any number of team members, picked from the Workers register.
export function CrewFields({ kind, leader, members, onChange }) {
  const { workers } = useDemo();
  const options = crewOptions(workers, kind, [leader, ...members]);
  const toggle = (name) => onChange({ leader, members: members.includes(name) ? members.filter((m) => m !== name) : [...members, name] });
  return (
    <>
      <label>Team leader
        <select value={leader} onChange={(e) => onChange({ leader: e.target.value, members: members.filter((m) => m !== e.target.value) })}>
          <option value="">Choose…</option>
          {options.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <fieldset className="crew-pick">
        <legend>Team members <small>({members.length} chosen)</small></legend>
        {options.filter((c) => c !== leader).map((c) => (
          <label key={c} className="check"><input type="checkbox" checked={members.includes(c)} onChange={() => toggle(c)} />{c}</label>
        ))}
      </fieldset>
    </>
  );
}

// TSK-3: date, team leader and crew. Each person on the crew gets their own checklists.
export function ScheduleModal({ task, onClose }) {
  const { scheduleTask } = useDemo();
  const [f, setF] = useState({ date: task.date || '', leader: task.leader || '', members: membersOf(task) });
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!f.date || !f.leader) return setError('A date and a team leader are required to schedule.');
    scheduleTask(task.id, f);
    return onClose();
  };
  return (
    <Modal title={`Schedule: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>{task.kind === 'install' ? 'Install date' : 'Date'}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <CrewFields kind={task.kind} leader={f.leader} members={f.members} onChange={(c) => setF({ ...f, ...c })} />
        <small>Each person on the crew gets their own pre-job and post-job checklists. Taking someone off the crew removes theirs.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Schedule</button>
        </div>
      </form>
    </Modal>
  );
}

// DES-1: the PM assigns a designer, or changes the designer before work starts.
export function AssignDesignerModal({ task, onClose }) {
  const { workers, tasks, assignDesign } = useDemo();
  const options = designerOptions(workers, tasks);
  const [owner, setOwner] = useState(task.owner || '');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!owner) return setError('Choose a designer.');
    if (assignDesign(task.id, owner)) onClose();
    return undefined;
  };
  return (
    <Modal title={`${task.owner ? 'Change designer' : 'Assign designer'}: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Designer<select autoFocus value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Choose…</option>{options.map((o) => <option key={o}>{o}</option>)}</select></label>
        <small>The designer fills in the design brief check and the hand-off checklist with their hours.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{task.owner ? 'Change designer' : 'Assign'}</button>
        </div>
      </form>
    </Modal>
  );
}

const num = (v) => (v === '' || v === undefined || v === null ? '' : String(v));

// TSK-6: edit a task after it is created. Fields shown depend on the task kind and type; rollups stay read-only.
export function TaskEditModal({ task, onClose }) {
  const { updateTask, signs, equipment } = useDemo();
  const spec = task.spec || {};
  const [f, setF] = useState({
    name: task.name || '', date: task.date || '', type: task.type || '', quoted: num(task.quoted), proposed: num(task.proposed),
    description: task.description || '', signGroup: task.signGroup || '',
    leader: task.leader || '', members: membersOf(task), hiredEquipment: task.hiredEquipment || [],
    width: num(spec.ccv?.width), height: num(spec.ccv?.height), qty: num(spec.ccv?.qty), vinyl: spec.ccv?.vinyl || '',
    material: spec.cnc?.material || spec.clb?.material || '', thickness: num(spec.cnc?.thickness), returnHeight: num(spec.clb?.return_height),
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const groups = [...new Set(signs.filter((g) => g.jobId === task.jobId).map((g) => g.group))];
  const hired = equipment.filter((e) => e.offHireRequired || e.hired);
  const isFab = task.kind === 'fab';
  const isInstall = task.kind === 'install';
  const hasCrew = isFab || isInstall;
  const started = !['Awaiting Scheduling', 'Scheduled', 'To be Assigned', 'Assigned'].includes(task.stage);

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.date) return setError('Please fill the mandatory fields');
    if ([f.quoted, f.proposed].some((v) => v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0))) return setError('Hours must be zero or more.');
    if (hasCrew && task.stage === 'Scheduled' && !f.leader) return setError('A scheduled task needs a team leader. Use Reset assignment to unschedule it.');
    const patch = { name: f.name.trim(), date: f.date, type: f.type, quoted: Number(f.quoted) || 0, proposed: Number(f.proposed) || 0 };
    if (task.kind === 'design') patch.description = f.description;
    if (isFab) {
      patch.signGroup = f.signGroup;
      patch.spec = {
        ccv: { width: Number(f.width) || 0, height: Number(f.height) || 0, qty: Number(f.qty) || 0, vinyl: f.vinyl },
        cnc: { material: f.material, thickness: Number(f.thickness) || 0 },
        clb: { material: f.material, return_height: Number(f.returnHeight) || 0 },
      };
    }
    if (isInstall) { patch.signGroup = f.signGroup; patch.hiredEquipment = f.hiredEquipment; }
    if (hasCrew && !['Awaiting Scheduling'].includes(task.stage)) { patch.leader = f.leader; patch.members = f.members; }
    if (updateTask(task.id, patch)) onClose();
    return undefined;
  };

  return (
    <Modal title={`Edit task: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Task name *<input autoFocus value={f.name} onChange={set('name')} /></label>
        <div className="form-row">
          <label>{task.kind === 'design' ? 'Required finish *' : 'Scheduled date *'}<input type="date" value={f.date} onChange={set('date')} /></label>
          <label>{isFab ? 'Fab type' : isInstall ? 'Install type' : 'Design type'}
            <select value={f.type} onChange={set('type')} disabled={isInstall && started} title={isInstall && started ? 'The install type sets the checklists, so it is fixed once work starts' : ''}>
              {[...new Set([f.type, ...TYPES_FOR[task.kind]].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
          <label>Proposed hours<input type="number" min="0" step="0.5" value={f.proposed} onChange={set('proposed')} /></label>
        </div>
        <small>Booked hours ({task.booked || 0}h) come from post-job checklists and cannot be edited here.</small>

        {(isFab || isInstall) && groups.length > 0 && (
          <label>Sign group<select value={f.signGroup} onChange={set('signGroup')}><option value="">None</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
        )}

        {isFab && f.type === 'CCV' && (
          <fieldset><legend>CCV specification</legend>
            <div className="form-row"><label>Width<input type="number" value={f.width} onChange={set('width')} /></label><label>Height<input type="number" value={f.height} onChange={set('height')} /></label><label>Quantity<input type="number" value={f.qty} onChange={set('qty')} /></label></div>
            <label>Vinyl brand / colour<input value={f.vinyl} onChange={set('vinyl')} /></label>
          </fieldset>
        )}
        {isFab && ['CNC Laser', 'CNC Router'].includes(f.type) && (
          <fieldset><legend>CNC specification</legend>
            <div className="form-row"><label>Material<input value={f.material} onChange={set('material')} /></label><label>Thickness<input type="number" value={f.thickness} onChange={set('thickness')} /></label></div>
          </fieldset>
        )}
        {isFab && f.type === 'CLB' && (
          <fieldset><legend>CLB specification</legend>
            <div className="form-row"><label>Material<input value={f.material} onChange={set('material')} /></label><label>Return height<input type="number" value={f.returnHeight} onChange={set('returnHeight')} /></label></div>
          </fieldset>
        )}

        {isInstall && hired.length > 0 && (
          <fieldset className="crew-pick"><legend>Hired equipment (off hire when the crew finishes on site)</legend>
            {hired.map((e) => (
              <label key={e.id} className="check"><input type="checkbox" checked={f.hiredEquipment.includes(e.id)}
                onChange={() => setF((x) => ({ ...x, hiredEquipment: x.hiredEquipment.includes(e.id) ? x.hiredEquipment.filter((i) => i !== e.id) : [...x.hiredEquipment, e.id] }))} />{e.id} · {e.name}</label>
            ))}
          </fieldset>
        )}

        {task.kind === 'design' && <label>Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>}

        {hasCrew && task.stage !== 'Awaiting Scheduling' && (
          <CrewFields kind={task.kind} leader={f.leader} members={f.members} onChange={(c) => setF((x) => ({ ...x, ...c }))} />
        )}
        {hasCrew && task.stage === 'Awaiting Scheduling' && <small>Use Schedule to set the date and crew.</small>}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save changes</button>
        </div>
      </form>
    </Modal>
  );
}

// FSD 4.4: soft delete. A task with booked hours can only be deleted by an admin.
export function DeleteTaskModal({ task, onClose, onDeleted }) {
  const { deleteTask, roleId } = useDemo();
  const [reason, setReason] = useState('');
  const blocked = (task.booked || 0) > 0 && roleId !== 'admin';
  const submit = (e) => {
    e.preventDefault();
    if (deleteTask(task.id, reason.trim())) { onClose(); if (onDeleted) onDeleted(); }
  };
  return (
    <Modal title={`Delete task: ${task.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {blocked
          ? <p className="form-error" role="alert">This task has {task.booked}h booked. Only an admin can delete it.</p>
          : <p>The task is hidden from every list. Its hours, checklists and history are kept for audit, and its WorkDrive folder is renamed with "(DELETED)".</p>}
        {!blocked && <label>Reason (optional)<input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {!blocked && <button type="submit" className="btn btn-danger">Delete task</button>}
        </div>
      </form>
    </Modal>
  );
}
