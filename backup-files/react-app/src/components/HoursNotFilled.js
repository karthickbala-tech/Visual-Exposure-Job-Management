import { useState } from 'react';
import { Hourglass } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, ResponsiveTable } from './ui';
import { useDemo } from '../context/DemoContext';
import { hoursNotFilled, splitNotFilled } from '../lib/hours';
import { needsHoursConfirm } from '../lib/checklists';
import { formatShort, toKey, today } from '../lib/dates';

// HRS-4: completed post-job checklists with zero hours, split into workshop and other fab tasks. The cutoff date is a setting.
export default function HoursNotFilled({ person }) {
  const { tasks, checklists, settings, fillHours } = useDemo();
  const [filling, setFilling] = useState(null);
  const [hours, setHours] = useState('');
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');

  const list = hoursNotFilled({ tasks, checklists, person, cutoff: settings.hoursCutoff, todayKey: toKey(today()) });
  const split = splitNotFilled(list);
  const rows = list.map((x) => ({ id: x.task.id, task: x.task, workshop: x.workshop }));

  const submit = (e) => {
    e.preventDefault();
    const err = fillHours(filling.id, person, hours, sure);
    if (err) return setError(err);
    setFilling(null); setHours(''); setSure(false); setError('');
    return null;
  };

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (r) => <strong>{r.task.name}</strong> },
    { key: 'date', label: 'Date', render: (r) => formatShort(r.task.date) },
    { key: 'type', label: 'Type', render: (r) => <Chip value={r.workshop ? 'Workshop' : 'Fab'} tone={r.workshop ? 'amber' : 'blue'} /> },
    { key: 'act', label: 'Action', render: (r) => <button type="button" className="btn btn-primary btn-sm" onClick={() => { setFilling(r.task); setHours(''); setSure(false); setError(''); }}>Enter hours</button> },
  ];

  return (
    <section aria-label="Hours not filled">
      <div className="kpis">
        <KpiCard icon={Hourglass} label="Hours not filled: workshop" value={split.workshop} tone={split.workshop ? 'danger' : 'brand'} note={`tasks since ${formatShort(settings.hoursCutoff)}`} />
        <KpiCard icon={Hourglass} label="Hours not filled: fab" value={split.other} tone={split.other ? 'danger' : 'brand'} note={`tasks since ${formatShort(settings.hoursCutoff)}`} />
      </div>
      {rows.length > 0 && <Card title="Closed checklists with no hours" flush><ResponsiveTable columns={columns} rows={rows} /></Card>}
      {filling && (
        <Modal title={`Enter hours: ${filling.name}`} onClose={() => setFilling(null)}>
          <form className="form" onSubmit={submit} noValidate>
            <label>Hours worked<input type="number" inputMode="decimal" step="0.5" min="0" autoFocus value={hours} onChange={(e) => setHours(e.target.value)} /></label>
            {needsHoursConfirm(hours) && <label className="check-inline"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} />Yes, {hours} hours is correct</label>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setFilling(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Save hours</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
