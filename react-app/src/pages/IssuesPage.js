import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Flag, Link2, Plus, Printer } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { DEPARTMENTS, DIRECTIONS, PEOPLE, PRIORITIES, SITES, STATUSES } from '../data/issuesSeed';
import { fmtStamp, formatShort, toKey, today } from '../lib/dates';
import { PRINT_LAYOUTS, canCreateDeal, defaultLayout, layoutById, printRows } from '../lib/issuePrint';
import './IssuesPage.css';

const STATUS_TONE = {
  'To Be discussed': 'gray', 'To Be Quoted': 'amber', Quoted: 'purple', 'Quote Sent': 'purple', 'In Progress': 'blue', 'On Hold': 'red', Completed: 'green',
};
const PRIORITY_TONE = { High: 'red', Medium: 'amber', Low: 'gray' };
const MANAGE_ROLES = ['admin', 'pm', 'fabManager'];
const isOpen = (i) => i.status !== 'Completed';

function ReportModal({ onClose }) {
  const { addIssue, tasks } = useDemo();
  const [f, setF] = useState({ subject: '', description: '', department: DEPARTMENTS[0], priority: 'Medium', location: '', site: '', direction: '', taskId: '', review: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const related = tasks.find((t) => t.id === f.taskId);
  const reviewOptions = related?.kind === 'install' ? ['Management Review', 'WHS Reported'] : related?.kind === 'fab' ? ['Management Review', 'OH&S Reported'] : [];

  const submit = (e) => {
    e.preventDefault();
    if (!f.subject.trim() || !f.description.trim()) return setError('A subject and a description are required.');
    addIssue({ ...f, subject: f.subject.trim(), description: f.description.trim(), review: reviewOptions.includes(f.review) ? f.review : '' });
    return onClose();
  };

  return (
    <Modal title="Report an issue" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Subject<input autoFocus value={f.subject} onChange={set('subject')} placeholder="Short summary" /></label>
        <label>What happened?<textarea rows={3} value={f.description} onChange={set('description')} /></label>
        <div className="form-row">
          <label>Department<select value={f.department} onChange={set('department')}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></label>
          <label>Priority<select value={f.priority} onChange={set('priority')}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></label>
        </div>
        {f.department === 'Civic Billboards' ? (
          <div className="form-row">
            <label>Billboard site<select value={f.site} onChange={set('site')}><option value="">Choose…</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label>Which face<select value={f.direction} onChange={set('direction')}><option value="">Choose…</option>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select></label>
          </div>
        ) : <label>Location<input value={f.location} onChange={set('location')} placeholder="Where did it happen?" /></label>}
        <label>Related task (optional)
          <select value={f.taskId} onChange={set('taskId')}><option value="">None</option>
            {tasks.filter((t) => t.kind !== 'design').map((t) => <option key={t.id} value={t.id}>{t.id} · {t.name}</option>)}</select></label>
        {reviewOptions.length > 0 && <label>Review needed<select value={f.review} onChange={set('review')}><option value="">None</option>{reviewOptions.map((r) => <option key={r}>{r}</option>)}</select></label>}
        <small>The department manager is assigned and emailed automatically.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Report issue</button>
        </div>
      </form>
    </Modal>
  );
}

export function IssuesBoard() {
  const { issues, role, roleId } = useDemo();
  const [dept, setDept] = useState('All');
  const [scope, setScope] = useState('all');
  const [view, setView] = useState('board');
  const [reporting, setReporting] = useState(false);
  const key = toKey(today());
  const me = role.name;

  const scoped = issues.filter((i) => (scope === 'mine' ? i.reportedBy === me : scope === 'assigned' ? i.assignedTo === me : true));
  const shown = scoped.filter((i) => dept === 'All' || i.department === dept);
  const open = issues.filter(isOpen);
  const overdue = open.filter((i) => i.dueDate && i.dueDate < key);
  const deptCount = (d) => scoped.filter((i) => isOpen(i) && (d === 'All' || i.department === d)).length;

  const list = [...shown].sort((a, b) => (isOpen(b) - isOpen(a)) || PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));
  const columns = [
    { key: 'subject', label: 'Issue', primary: true, render: (i) => <div className="stack"><Link className="job-link" to={`/issues/${i.id}`}>{i.subject}</Link><small>{i.id} · {i.department}</small></div> },
    { key: 'priority', label: 'Priority', render: (i) => <Chip value={i.priority} tone={PRIORITY_TONE[i.priority]} /> },
    { key: 'status', label: 'Status', render: (i) => <Chip value={i.status} tone={STATUS_TONE[i.status]} /> },
    { key: 'assignedTo', label: 'Assigned to' },
    { key: 'reportedBy', label: 'Reported by' },
    { key: 'dueDate', label: 'Due', render: (i) => (i.dueDate ? <span className={isOpen(i) && i.dueDate < key ? 'over' : ''}>{formatShort(i.dueDate)}</span> : '-') },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow="Safety and operations" title="Issues" subtitle="Report problems, track who owns them and what happens next.">
        {roleId !== 'viewer' && <button type="button" className="btn btn-primary" onClick={() => setReporting(true)}><Plus size={16} aria-hidden="true" /> Report an issue</button>}
      </PageHeader>

      <div className="kpis">
        <KpiCard icon={Flag} label="Open issues" value={open.length} note={`${issues.length} in total`} />
        <KpiCard icon={AlertTriangle} label="High priority" value={open.filter((i) => i.priority === 'High').length} tone="danger" note="still open" />
        <KpiCard icon={Clock} label="Overdue" value={overdue.length} tone={overdue.length ? 'warn' : 'brand'} note="past their due date" />
        <KpiCard icon={CheckCircle2} label="Completed" value={issues.length - open.length} note="all time" />
      </div>

      <div className="is-tools">
        <div className="segmented" role="tablist" aria-label="Department board">
          {['All', ...DEPARTMENTS].map((d) => <button key={d} type="button" role="tab" aria-selected={dept === d} className={dept === d ? 'on' : ''} onClick={() => setDept(d)}>{d}<em>{deptCount(d)}</em></button>)}
        </div>
      </div>
      <div className="is-tools">
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Whose issues">
          <option value="all">All issues</option><option value="mine">Reported by me</option><option value="assigned">Assigned to me</option>
        </select>
        <span className="grow" />
        <div className="segmented" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'board'} className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button type="button" role="tab" aria-selected={view === 'list'} className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
      </div>

      {view === 'list' ? (
        <Card flush><ResponsiveTable columns={columns} rows={list} empty="No issues in this view" /></Card>
      ) : (
        <div className="kanban">
          {STATUSES.map((st) => {
            const col = shown.filter((i) => i.status === st);
            return (
              <section key={st} className="kcol" aria-label={st}>
                <h3>{st}<span>{col.length}</span></h3>
                {col.length === 0 && <p className="kempty">Nothing here</p>}
                {col.map((i) => (
                  <Link key={i.id} to={`/issues/${i.id}`} className={`kcard ${i.priority.toLowerCase()}`}>
                    <strong>{i.subject}</strong>
                    <div className="meta"><Chip value={i.department} tone="gray" /><Chip value={i.priority} tone={PRIORITY_TONE[i.priority]} /></div>
                    <small>{i.assignedTo}{i.dueDate ? ` · due ${formatShort(i.dueDate)}` : ''}</small>
                  </Link>))}
              </section>);
          })}
        </div>
      )}
      {reporting && <ReportModal onClose={() => setReporting(false)} />}
    </div>
  );
}

function UpdateForm({ issue }) {
  const { addIssueUpdate } = useDemo();
  const civic = issue.department === 'Civic Billboards';
  const [f, setF] = useState({ status: issue.status, personResponsible: issue.assignedTo, nextStep: '', workCompleted: '', dueDate: '', site: issue.site, direction: issue.direction });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const done = f.status === 'Completed';

  const submit = (e) => {
    e.preventDefault();
    if (done) {
      if (!f.workCompleted.trim()) return setError('Add notes on how this was completed.');
      if (civic && !f.site) return setError('Choose the billboard site for a Civic issue.');
      if (civic && !f.direction) return setError('Choose which face of the billboard has the issue.');
    } else {
      if (!f.nextStep.trim()) return setError('Add the next step for any status other than Completed.');
      if (!f.dueDate) return setError('Add a due date for any status other than Completed.');
    }
    setError('');
    addIssueUpdate(issue.id, { ...f, nextStep: f.nextStep.trim(), workCompleted: f.workCompleted.trim() });
    return setF((x) => ({ ...x, nextStep: '', workCompleted: '', dueDate: '' }));
  };

  return (
    <form className="form" onSubmit={submit} noValidate style={{ padding: '4px 0 0' }}>
      <div className="form-row">
        <label>Status<select value={f.status} onChange={set('status')}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Person responsible<select value={f.personResponsible} onChange={set('personResponsible')}>{PEOPLE.map((p) => <option key={p}>{p}</option>)}</select></label>
      </div>
      {civic && (
        <div className="form-row">
          <label>Billboard site<select value={f.site} onChange={set('site')}><option value="">Choose…</option>{SITES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Which face<select value={f.direction} onChange={set('direction')}><option value="">Choose…</option>{DIRECTIONS.map((d) => <option key={d}>{d}</option>)}</select></label>
        </div>)}
      {!done && (
        <>
          <label>Next step<textarea rows={2} value={f.nextStep} onChange={set('nextStep')} /></label>
          <label>Due date<input type="date" value={f.dueDate} onChange={set('dueDate')} /></label>
        </>)}
      <label>{done ? 'How was it completed?' : 'Work completed so far (optional)'}<textarea rows={2} value={f.workCompleted} onChange={set('workCompleted')} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary">{done ? 'Complete issue' : 'Add update'}</button></div>
    </form>
  );
}

export function IssueDetail() {
  const { issueId } = useParams();
  const { issues, tasks, jobs, roleId, role, createCrmDeal } = useDemo();
  const [layoutId, setLayoutId] = useState('');
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return <PlaceholderPage title="Issue not found" blurb="That issue does not exist in the demo data." />;

  const task = tasks.find((t) => t.id === issue.taskId);
  const key = toKey(today());
  const canManage = MANAGE_ROLES.includes(roleId);
  const late = isOpen(issue) && issue.dueDate && issue.dueDate < key;
  const history = [...issue.history].reverse();
  const layout = layoutById(layoutId || defaultLayout(issue));
  const rows = printRows(layout, issue, { taskName: task ? `${task.id} · ${task.name}` : '' });
  const dealOk = canCreateDeal(issue, { canManage, person: role.name });

  return (
    <div className="dash">
      <div className="is-noprint">
      <Link to="/issues" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All issues</Link>
      <PageHeader eyebrow={`${issue.id} · ${issue.department}`} title={issue.subject}>
        <Chip value={issue.priority} tone={PRIORITY_TONE[issue.priority]} />
        <Chip value={issue.status} tone={STATUS_TONE[issue.status]} />
        {issue.crmDealId && <Chip value={`CRM deal ${issue.crmDealId}`} tone="purple" />}
        {dealOk && (
          <button type="button" className="btn btn-ghost btn-sm" title="Demo: records a deal number. The real Zoho CRM call needs the backend." onClick={() => createCrmDeal(issue.id)}>
            <Link2 size={14} aria-hidden="true" /> Create CRM deal
          </button>
        )}
      </PageHeader>

      <div className="is-grid">
        <div className="stack" style={{ gap: 16 }}>
          <Card title="Details">
            <p>{issue.description}</p>
            <dl>
              <dt>Reported by</dt><dd>{issue.reportedBy} on {formatShort(issue.date)}</dd>
              <dt>Assigned manager</dt><dd>{issue.assignedTo}</dd>
              <dt>Also informed</dt><dd>{issue.notify.length ? issue.notify.join(', ') : '-'}</dd>
              <dt>Due</dt><dd className={late ? 'over' : ''}>{issue.dueDate ? formatShort(issue.dueDate) : 'Not set'}{late ? ' (overdue)' : ''}</dd>
              {issue.location && <><dt>Location</dt><dd>{issue.location}</dd></>}
              {issue.site && <><dt>Billboard</dt><dd>{issue.site}{issue.direction ? `, ${issue.direction}` : ''}</dd></>}
              {task && <><dt>Related task</dt><dd><Link to={`/jobs/${task.jobId}`}>{task.id} · {task.name}</Link> ({jobs.find((j) => j.id === task.jobId)?.name})</dd></>}
              {issue.review && <><dt>Review</dt><dd><Chip value={issue.review} tone="purple" /></dd></>}
              {issue.status === 'Completed' && <><dt>Completed</dt><dd>{formatShort(issue.dateCompleted)}. {issue.completionNotes}</dd></>}
            </dl>
          </Card>
          {canManage && isOpen(issue) && <Card title="Add an update"><UpdateForm issue={issue} /></Card>}
          {!canManage && isOpen(issue) && <p className="muted">Only the Project Manager and Fab Manager can update an issue.</p>}
        </div>

        <Card title="Management history">
          {history.length === 0 && <p className="muted">No updates yet. The manager adds the first one.</p>}
          <ul className="timeline">
            {history.map((h, idx) => (
              <li key={idx}>
                <strong>{h.status}</strong>
                <small>{h.by}, {fmtStamp(h.at)} · responsible: {h.personResponsible}</small>
                {h.nextStep && <span>Next step: {h.nextStep}{h.dueDate ? ` (due ${formatShort(h.dueDate)})` : ''}</span>}
                {h.workCompleted && <span>Work completed: {h.workCompleted}</span>}
              </li>))}
            <li><strong>Reported</strong><small>{issue.reportedBy}, {formatShort(issue.date)}</small></li>
          </ul>
        </Card>
      </div>

      <Card title="Print">
        <div className="is-print-tools">
          <label>Layout
            <select value={layout.id} onChange={(e) => setLayoutId(e.target.value)} aria-label="Print layout">
              {PRINT_LAYOUTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}><Printer size={14} aria-hidden="true" /> Print or save as PDF</button>
        </div>
        <small className="muted">Seven layouts: two general and one per department. The layout names are placeholders until they are checked against the Creator originals.</small>
      </Card>
      </div>

      <article className="is-sheet" aria-label="Print preview">
        <p className="is-sheet-eyebrow">Visual Exposure · {layout.title}</p>
        <h2>{issue.subject}</h2>
        <dl>{rows.map((r) => <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>)}</dl>
        {layout.description && <><h3>Description</h3><p>{issue.description}</p></>}
        {layout.history && (
          <>
            <h3>Management history</h3>
            {history.length === 0 && <p>No updates yet.</p>}
            <ol>
              {history.map((h, idx) => (
                <li key={idx}><strong>{h.status}</strong> · {h.by}, {fmtStamp(h.at)} · responsible: {h.personResponsible}
                  {h.nextStep && <div>Next step: {h.nextStep}{h.dueDate ? ` (due ${formatShort(h.dueDate)})` : ''}</div>}
                  {h.workCompleted && <div>Work completed: {h.workCompleted}</div>}</li>))}
            </ol>
          </>
        )}
      </article>
    </div>
  );
}
