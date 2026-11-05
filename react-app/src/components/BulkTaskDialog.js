import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui-kit/dialog';
import { Button } from './ui-kit/button';
import { StageBadge } from './StageBadge';
import { CrewFields } from './TaskForms';
import { availableActions } from '../lib/taskActions';
import { CLOSED_STAGES } from '../lib/workflow';

const DONE = [...CLOSED_STAGES];

// Bulk actions on ticked tasks. Tasks the action does not apply to are skipped and counted.
export default function BulkDialog({ kind, tasks, onClose, onDone, runTaskAction, scheduleTask, notify }) {
  const [comment, setComment] = useState('');
  const [f, setF] = useState({ date: '', leader: '', members: [] });
  const [error, setError] = useState('');
  const actionId = kind === 'hold' ? 'hold' : 'cancel';
  const crewKinds = [...new Set(tasks.filter((t) => ['fab', 'install'].includes(t.kind)).map((t) => t.kind))];
  const fits = kind === 'schedule'
    ? tasks.filter((t) => ['fab', 'install'].includes(t.kind) && !DONE.includes(t.stage) && !['In Progress', 'Manager Review'].includes(t.stage))
    : tasks.filter((t) => availableActions(t).some((a) => a.id === actionId));
  const skipped = tasks.length - fits.length;
  const title = { schedule: 'Schedule crew and date', hold: 'Put on hold', cancel: 'Cancel tasks' }[kind];

  const run = () => {
    if (fits.length === 0) return setError('None of the ticked tasks can take this action.');
    if (kind === 'schedule') {
      if (crewKinds.length > 1) return setError('Tick only fabrication or only install tasks to schedule them together.');
      if (!f.date || !f.leader) return setError('A date and a team leader are required to schedule.');
      fits.forEach((t) => scheduleTask(t.id, f));
    } else {
      if (!comment.trim()) return setError('A comment is required.');
      fits.forEach((t) => runTaskAction(t.id, actionId, comment.trim()));
    }
    notify(`${title}: ${fits.length} task${fits.length > 1 ? 's' : ''} updated${skipped ? `, ${skipped} skipped` : ''}`);
    return onDone();
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader><DialogTitle>{title}</DialogTitle>
          <DialogDescription>{fits.length} of {tasks.length} ticked task{tasks.length > 1 ? 's' : ''} {fits.length === 1 ? 'is' : 'are'} affected{skipped ? `; ${skipped} cannot take this action and will be skipped` : ''}.</DialogDescription>
        </DialogHeader>
        <ul className="m-0 grid max-h-32 list-none gap-1 overflow-y-auto p-0 text-sm">{fits.map((t) => <li key={t.id} className="flex items-center gap-2"><StageBadge stage={t.stage} /> {t.name}</li>)}</ul>
        <div className="form" style={{ padding: 0 }}>
          {kind === 'schedule' ? (
            <>
              <label>Date<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
              {crewKinds.length === 1 && <CrewFields kind={crewKinds[0]} leader={f.leader} members={f.members} onChange={(c) => setF((x) => ({ ...x, ...c }))} />}
            </>
          ) : <label>Reason *<textarea autoFocus rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Tell the team why" /></label>}
          {error && <p className="form-error" role="alert">{error}</p>}
        </div>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={onClose}>Back</Button><Button variant={kind === 'cancel' ? 'destructive' : 'default'} onClick={run}>{title}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

