import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, PencilRuler, Plus, RotateCcw } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { formatShort, fullDate, toKey, today } from '../lib/dates';
import { MANAGER_ROLES } from '../lib/workflow';
import './DesignPage.css';

// Design types from the Creator Design Task form. Colours are only for the legend dots.
const DESIGN_TYPES = { 'Artwork Sign Off': '#2f80ed', 'Install Plan': '#0f9d8a', 'LED Design': '#d4a900', 'Manufacturing Sign Off': '#a855f7', 'Proof Of Posting': '#ec4899', 'Project Management': '#475569' };
const DESIGNERS = ['Anitha R.', 'Marco D.', 'Priya S.']; // sample design team
const COLUMNS = ['Not Started', 'In Progress', 'Manager Review', 'Rejected', 'Reopen', 'Completed'];
const isOpen = (t) => t.stage !== 'Completed' && t.stage !== 'Cancelled';

function NewDesignModal({ onClose }) {
  const { jobs, addDesignTask } = useDemo();
  const [f, setF] = useState({ name: '', jobId: jobs[0]?.id || '', type: Object.keys(DESIGN_TYPES)[0], owner: DESIGNERS[0], due: '', quoted: '', description: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim() || !f.jobId || !f.due) return setError('Task name, job and required finish date are required.');
    addDesignTask({ ...f, name: f.name.trim(), quoted: Number(f.quoted) || 0 });
    return onClose();
  };
  return (
    <Modal title="New design task" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Task name<input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Pylon artwork rev D" /></label>
        <div className="form-row">
          <label>Job<select value={f.jobId} onChange={set('jobId')}>{jobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.name}</option>)}</select></label>
          <label>Design type<select value={f.type} onChange={set('type')}>{Object.keys(DESIGN_TYPES).map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Assigned to<select value={f.owner} onChange={set('owner')}>{DESIGNERS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Required finish<input type="date" value={f.due} onChange={set('due')} /></label>
        </div>
        <label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')} /></label>
        <label>Description<textarea rows={3} value={f.description} onChange={set('description')} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Create task</button>
        </div>
      </form>
    </Modal>
  );
}

export default function DesignPage() {
  const { tasks, jobs, roleId, actOnTask } = useDemo();
  const [filter, setFilter] = useState('open');
  const [view, setView] = useState('board');
  const [creating, setCreating] = useState(false);
  const key = toKey(today());
  const isPm = roleId === 'pm';
  const canApprove = MANAGER_ROLES.includes(roleId);
  const design = tasks.filter((t) => t.kind === 'design');
  const open = design.filter(isOpen);
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const late = (t) => isOpen(t) && t.stage !== 'Manager Review' && t.date < key;

  const FILTERS = [
    ['open', 'All open', open],
    ['notstarted', 'Not started', open.filter((t) => t.stage === 'Not Started')],
    ['late', 'Overdue', open.filter(late)],
    ['review', 'Awaiting approval', open.filter((t) => t.stage === 'Manager Review')],
    ['back', 'Sent back', open.filter((t) => t.stage === 'Rejected' || t.stage === 'Reopen')],
    ['done', 'Completed', design.filter((t) => t.stage === 'Completed')],
  ];
  const shown = FILTERS.find((f) => f[0] === filter)[2];
  const rows = [...shown].sort((a, b) => a.date.localeCompare(b.date));

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => <div className="stack"><strong>{t.name}</strong><small><Link className="job-link" to={`/jobs/${t.jobId}`}>{t.jobId}</Link> · {jobName(t.jobId)}</small></div> },
    { key: 'type', label: 'Type', render: (t) => (t.type ? <span className="type-tag"><i className="dot" style={{ background: DESIGN_TYPES[t.type] }} />{t.type}</span> : '-') },
    { key: 'owner', label: 'Assigned to', render: (t) => t.owner || 'Unassigned' },
    { key: 'date', label: 'Required finish', render: (t) => <span className={late(t) ? 'over' : ''}>{formatShort(t.date)}</span> },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Booked / quoted', render: (t) => (t.quoted ? `${t.booked || 0}h / ${t.quoted}h` : '-') },
    { key: 'act', label: 'Action', render: (t) => (
      <div className="row-actions">
        {t.stage === 'Not Started' && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Start')}>Start</button>}
        {t.stage === 'In Progress' && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Submit for approval')}>Submit</button>}
        {t.stage === 'Manager Review' && canApprove && <button type="button" className="btn btn-primary btn-sm" onClick={() => actOnTask(t.id, 'Approve')}>Approve</button>}
        <Link className="btn btn-ghost btn-sm" to={`/jobs/${t.jobId}`}>{t.stage === 'Manager Review' ? 'Review' : 'Open'}</Link>
      </div>) },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Design" subtitle="Artwork, install plans, LED designs and sign-offs for every job.">
        {isPm && <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden="true" /> New design task</button>}
      </PageHeader>

      <div className="kpis">
        <KpiCard icon={PencilRuler} label="Open design tasks" value={open.length} note={`${design.length} in total`} />
        <KpiCard icon={AlertTriangle} label="Overdue" value={FILTERS[2][2].length} tone="danger" note="past the required finish" />
        <KpiCard icon={Clock} label="Awaiting approval" value={FILTERS[3][2].length} tone="warn" note={canApprove ? 'ready for you to review' : 'with the manager'} />
        <KpiCard icon={RotateCcw} label="Sent back" value={FILTERS[4][2].length} note="rejected or reopened" />
        <KpiCard icon={CheckCircle2} label="Completed" value={FILTERS[5][2].length} note="all time" />
      </div>

      <div className="ds-tools">
        <div className="segmented" role="tablist" aria-label="Task filter">
          {FILTERS.map(([id, label, list]) => <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}<em>{list.length}</em></button>)}
        </div>
        <span className="grow" />
        <div className="segmented" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {view === 'list' ? (
        <Card flush><ResponsiveTable columns={columns} rows={rows} empty="No design tasks in this view" /></Card>
      ) : (
        <div className="dkanban">
          {COLUMNS.map((st) => {
            const col = rows.filter((t) => t.stage === st);
            return (
              <section key={st} className="dcol" aria-label={st}>
                <h3>{st}<span>{col.length}</span></h3>
                {col.length === 0 && <p className="dempty">Nothing here</p>}
                {col.map((t) => (
                  <Link key={t.id} to={`/jobs/${t.jobId}`} className={`dcard ${late(t) ? 'late' : ''}`} style={{ '--c': DESIGN_TYPES[t.type] || '#9aa39a' }}>
                    <strong>{t.name}</strong>
                    <small>{t.jobId} · {jobName(t.jobId)}</small>
                    <small>{t.owner || 'Unassigned'} · due {formatShort(t.date)}{late(t) ? ' (overdue)' : ''}</small>
                  </Link>))}
              </section>);
          })}
        </div>
      )}
      {creating && <NewDesignModal onClose={() => setCreating(false)} />}
    </div>
  );
}
