import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Building2, Clock, FileWarning, Plus, Users } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { COMPANY_TYPES, PRIMARY_ROLES, VE_NAME, WORKER_TYPES, docTypes, inductionTypes, ticketTypes } from '../data/workersSeed';
import { STATUS_TONE, expiryText, statusOf, worst } from '../lib/compliance';
import { formatShort, fromKey, toKey, today } from '../lib/dates';
import './WorkersPage.css';

const TABS = [['ve', 'VE workers'], ['subs', 'Subcontractors'], ['compliance', 'Tickets and inductions'], ['docs', 'Company documents']];
const MANAGE_ROLES = ['pm', 'fabManager'];
const typeName = (list, id) => list.find((t) => t.id === id)?.name || id;
const StatusChip = ({ expiry }) => { const s = statusOf(expiry); return <Chip value={s} tone={STATUS_TONE[s]} />; };

function EditItemModal({ item, kind, label, years, onClose }) {
  const { updateCompliance } = useDemo();
  const [f, setF] = useState({ ref: item.ref || '', issue: item.issue || '', expiry: item.expiry || '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const suggest = () => {
    if (!f.issue || !years) return;
    const d = fromKey(f.issue);
    setF((x) => ({ ...x, expiry: toKey(new Date(d.getFullYear() + years, d.getMonth(), d.getDate())) }));
  };
  const submit = (e) => {
    e.preventDefault();
    if (!f.issue || !f.expiry) return setError('Issue date and expiry date are required.');
    if (f.expiry <= f.issue) return setError('The expiry date must be after the issue date.');
    updateCompliance(kind, item.id, kind === 'doc' ? { issue: f.issue, expiry: f.expiry } : f);
    return onClose();
  };
  return (
    <Modal title={`Update: ${label}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {kind !== 'doc' && <label>Reference number<input autoFocus value={f.ref} onChange={set('ref')} /></label>}
        <div className="form-row">
          <label>Issue date<input type="date" max={toKey(today())} value={f.issue} onChange={set('issue')} /></label>
          <label>Expiry date<input type="date" value={f.expiry} onChange={set('expiry')} /></label>
        </div>
        {years > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={suggest} disabled={!f.issue}>Set expiry {years} years after issue</button>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save</button>
        </div>
      </form>
    </Modal>
  );
}

function AddWorkerModal({ onClose }) {
  const { companies, addWorker } = useDemo();
  const active = companies.filter((c) => c.active);
  const [f, setF] = useState({ name: '', companyId: active[0]?.id || '', type: WORKER_TYPES[0], primaryRole: '', phone: '', email: '', start: toKey(today()), skills: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const isVe = companies.find((c) => c.id === f.companyId)?.name === VE_NAME;
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('The worker\'s name is required.');
    if (isVe && !f.primaryRole) return setError('Choose a primary role for a Visual Exposure worker.');
    addWorker({ ...f, name: f.name.trim(), primaryRole: isVe ? f.primaryRole : '' });
    return onClose();
  };
  return (
    <Modal title="Add a worker" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Full name<input autoFocus value={f.name} onChange={set('name')} /></label>
        <div className="form-row">
          <label>Employer<select value={f.companyId} onChange={set('companyId')}>{active.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Worker type<select value={f.type} onChange={set('type')}>{WORKER_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        </div>
        {isVe && <label>Primary role<select value={f.primaryRole} onChange={set('primaryRole')}><option value="">Choose…</option>{PRIMARY_ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>}
        <div className="form-row">
          <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <label>Start date<input type="date" value={f.start} onChange={set('start')} /></label>
        <small>The tickets and inductions this kind of worker needs are created for you to fill in.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Add worker</button>
        </div>
      </form>
    </Modal>
  );
}

function AddCompanyModal({ onClose }) {
  const { addCompany } = useDemo();
  const [f, setF] = useState({ name: '', type: COMPANY_TYPES[0], phone: '', email: '', suburb: '', state: 'VIC' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('The company name is required.');
    addCompany({ ...f, name: f.name.trim() });
    return onClose();
  };
  return (
    <Modal title="Add a subcontractor company" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Company name<input autoFocus value={f.name} onChange={set('name')} /></label>
        <label>Company type<select value={f.type} onChange={set('type')}>{COMPANY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <div className="form-row">
          <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <div className="form-row">
          <label>Suburb<input value={f.suburb} onChange={set('suburb')} /></label>
          <label>State<select value={f.state} onChange={set('state')}>{['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'].map((s) => <option key={s}>{s}</option>)}</select></label>
        </div>
        <small>The insurance and compliance documents every new company must supply are created for you to collect.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Add company</button>
        </div>
      </form>
    </Modal>
  );
}

// Everything a worker must hold, as one list.
const itemsFor = (workerId, tickets, inductions) => [
  ...tickets.filter((t) => t.workerId === workerId).map((t) => ({ ...t, kind: 'ticket', name: typeName(ticketTypes, t.typeId), years: ticketTypes.find((x) => x.id === t.typeId)?.years })),
  ...inductions.filter((t) => t.workerId === workerId).map((t) => ({ ...t, kind: 'induction', name: typeName(inductionTypes, t.typeId) })),
];

export function WorkersPage() {
  const { workers, companies, tickets, inductions, companyDocs, roleId, role } = useDemo();
  const [tab, setTab] = useState('ve');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState('');
  const canManage = roleId === 'pm';
  const company = (id) => companies.find((c) => c.id === id)?.name || id;
  const worker = (id) => workers.find((w) => w.id === id);

  const active = workers.filter((w) => w.active);
  const veWorkers = active.filter((w) => company(w.companyId) === VE_NAME);
  const subWorkers = active.filter((w) => company(w.companyId) !== VE_NAME);
  const all = [
    ...tickets.map((t) => ({ ...t, kind: 'ticket', name: typeName(ticketTypes, t.typeId), owner: worker(t.workerId)?.name, ownerId: t.workerId, years: ticketTypes.find((x) => x.id === t.typeId)?.years })),
    ...inductions.map((t) => ({ ...t, kind: 'induction', name: typeName(inductionTypes, t.typeId), owner: worker(t.workerId)?.name, ownerId: t.workerId })),
  ];
  const countBy = (s) => all.filter((x) => statusOf(x.expiry) === s).length + companyDocs.filter((x) => statusOf(x.expiry) === s).length;
  const rows = all.filter((x) => filter === 'all' || statusOf(x.expiry) === filter)
    .sort((a, b) => (a.expiry || '0000').localeCompare(b.expiry || '0000'));
  const workerStatus = (w) => worst(itemsFor(w.id, tickets, inductions).map((i) => i.expiry));
  const openItems = (w) => itemsFor(w.id, tickets, inductions).filter((i) => statusOf(i.expiry) !== 'Current').length;

  const workerCols = [
    { key: 'name', label: 'Worker', primary: true, render: (w) => <div className="stack"><Link className="job-link" to={`/workers/${w.id}`}>{w.name}</Link><small>{w.type}</small></div> },
    { key: 'role', label: 'Primary role', render: (w) => w.primaryRole || company(w.companyId) },
    { key: 'phone', label: 'Phone', render: (w) => w.phone || '-' },
    { key: 'status', label: 'Compliance', render: (w) => { const s = workerStatus(w); return <Chip value={s} tone={STATUS_TONE[s]} />; } },
    { key: 'items', label: 'Items to action', render: (w) => openItems(w) || '-' },
  ];
  const complianceCols = [
    { key: 'owner', label: 'Worker', primary: true, render: (x) => <Link className="job-link" to={`/workers/${x.ownerId}`}>{x.owner}</Link> },
    { key: 'kind', label: 'Type', render: (x) => (x.kind === 'ticket' ? 'Ticket' : 'Induction') },
    { key: 'name', label: 'Name' },
    { key: 'ref', label: 'Reference', render: (x) => x.ref || '-' },
    { key: 'expiry', label: 'Expiry', render: (x) => (x.expiry ? `${formatShort(x.expiry)} (${expiryText(x.expiry)})` : '-') },
    { key: 'status', label: 'Status', render: (x) => <StatusChip expiry={x.expiry} /> },
    { key: 'act', label: '', render: (x) => (canManage || worker(x.ownerId)?.name === role.name) && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ item: x, kind: x.kind, label: `${x.owner}, ${x.name}`, years: x.years })}>Update</button> },
  ];
  const docCols = [
    { key: 'company', label: 'Company', primary: true, render: (d) => company(d.companyId) },
    { key: 'name', label: 'Document' },
    { key: 'issue', label: 'Issued', render: (d) => (d.issue ? formatShort(d.issue) : '-') },
    { key: 'expiry', label: 'Expiry', render: (d) => (d.expiry ? `${formatShort(d.expiry)} (${expiryText(d.expiry)})` : '-') },
    { key: 'status', label: 'Status', render: (d) => <StatusChip expiry={d.expiry} /> },
    { key: 'act', label: '', render: (d) => canManage && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ item: d, kind: 'doc', label: `${company(d.companyId)}, ${d.name}`, years: docTypes.find((x) => x.id === d.typeId)?.years })}>Update</button> },
  ];
  const companyCols = [
    { key: 'name', label: 'Company', primary: true, render: (c) => <div className="stack"><strong>{c.name}</strong><small>{c.type}</small></div> },
    { key: 'where', label: 'Location', render: (c) => `${c.suburb}, ${c.state}` },
    { key: 'phone', label: 'Phone', render: (c) => c.phone || '-' },
    { key: 'workers', label: 'Workers', render: (c) => workers.filter((w) => w.companyId === c.id).length },
    { key: 'docs', label: 'Documents', render: (c) => { const s = worst(companyDocs.filter((d) => d.companyId === c.id).map((d) => d.expiry)); return <Chip value={s} tone={STATUS_TONE[s]} />; } },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow="People" title="Workers" subtitle="Employees, subcontractors, tickets, inductions and company documents.">
        {canManage && (<><button type="button" className="btn btn-primary" onClick={() => setAdding('worker')}><Plus size={16} aria-hidden="true" /> Add worker</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAdding('company')}><Building2 size={16} aria-hidden="true" /> Add company</button></>)}
      </PageHeader>

      <div className="kpis">
        <KpiCard icon={Users} label="Active workers" value={active.length} note={`${veWorkers.length} employees, ${subWorkers.length} subcontractors`} />
        <KpiCard icon={AlertTriangle} label="Expired" value={countBy('Expired')} tone="danger" note="tickets, inductions and documents" />
        <KpiCard icon={Clock} label="Expiring soon" value={countBy('Expiring')} tone="warn" note="within 30 days" />
        <KpiCard icon={FileWarning} label="Not filled in" value={countBy('Incomplete')} note="waiting for details" />
      </div>

      <div className="wk-tools">
        <div className="segmented" role="tablist" aria-label="Workers view">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      </div>

      {tab === 've' && <Card flush><ResponsiveTable columns={workerCols} rows={veWorkers} empty="No active employees" /></Card>}
      {tab === 'subs' && (
        <>
          <Card title="Subcontractor workers" flush><ResponsiveTable columns={workerCols} rows={subWorkers} empty="No active subcontractors" /></Card>
          <div className="wk-gap" />
          <Card title="Subcontractor companies" flush><ResponsiveTable columns={companyCols} rows={companies.filter((c) => c.name !== VE_NAME)} empty="No companies" /></Card>
        </>)}
      {tab === 'compliance' && (
        <>
          <div className="wk-tools">
            <div className="segmented" role="tablist" aria-label="Status filter">
              {[['all', 'All'], ['Expired', 'Expired'], ['Expiring', 'Expiring soon'], ['Incomplete', 'Not filled in']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
                  {label}<em>{id === 'all' ? all.length : all.filter((x) => statusOf(x.expiry) === id).length}</em></button>))}
            </div>
          </div>
          <Card flush><ResponsiveTable columns={complianceCols} rows={rows} empty="Nothing in this view" /></Card>
        </>)}
      {tab === 'docs' && <Card flush><ResponsiveTable columns={docCols} rows={[...companyDocs].sort((a, b) => (a.expiry || '0000').localeCompare(b.expiry || '0000'))} empty="No company documents" /></Card>}

      {editing && <EditItemModal {...editing} onClose={() => setEditing(null)} />}
      {adding === 'worker' && <AddWorkerModal onClose={() => setAdding('')} />}
      {adding === 'company' && <AddCompanyModal onClose={() => setAdding('')} />}
    </div>
  );
}

export function WorkerDetail() {
  const { workerId } = useParams();
  const { workers, companies, tickets, inductions, role, roleId } = useDemo();
  const [editing, setEditing] = useState(null);
  const w = workers.find((x) => x.id === workerId);
  if (!w) return <PlaceholderPage title="Worker not found" blurb="That worker does not exist in the demo data." />;

  const company = companies.find((c) => c.id === w.companyId)?.name;
  const items = itemsFor(w.id, tickets, inductions);
  const overall = worst(items.map((i) => i.expiry));
  const canEdit = MANAGE_ROLES.includes(roleId) || w.name === role.name;
  const avg = w.ratings.length ? Math.round((w.ratings.reduce((n, r) => n + r.rating, 0) / w.ratings.length) * 10) / 10 : null;

  const cols = (kind) => [
    { key: 'name', label: kind === 'ticket' ? 'Ticket' : 'Induction', primary: true },
    { key: 'ref', label: 'Reference', render: (x) => x.ref || '-' },
    { key: 'issue', label: 'Issued', render: (x) => (x.issue ? formatShort(x.issue) : '-') },
    { key: 'expiry', label: 'Expiry', render: (x) => (x.expiry ? `${formatShort(x.expiry)} (${expiryText(x.expiry)})` : '-') },
    { key: 'status', label: 'Status', render: (x) => <StatusChip expiry={x.expiry} /> },
    { key: 'act', label: '', render: (x) => canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing({ item: x, kind, label: x.name, years: x.years })}>Update</button> },
  ];

  return (
    <div className="dash">
      <Link to="/workers" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All workers</Link>
      <PageHeader eyebrow={w.type} title={w.name} subtitle={`${company}${w.primaryRole ? ` · ${w.primaryRole}` : ''}`}>
        <Chip value={overall} tone={STATUS_TONE[overall]} />
      </PageHeader>
      <Card title="Profile">
        <dl className="wk-profile">
          <div><dt>Phone</dt><dd>{w.phone || '-'}</dd></div>
          <div><dt>Email</dt><dd>{w.email || '-'}</dd></div>
          <div><dt>Started</dt><dd>{w.start ? formatShort(w.start) : '-'}</dd></div>
          <div><dt>Skills</dt><dd>{w.skills || '-'}</dd></div>
          <div><dt>Average rating</dt><dd>{avg ? `${avg} / 5 from ${w.ratings.length} task${w.ratings.length > 1 ? 's' : ''}` : 'No ratings yet'}</dd></div>
        </dl>
      </Card>
      <div className="wk-gap" />
      <Card title="Tickets" flush><ResponsiveTable columns={cols('ticket')} rows={items.filter((i) => i.kind === 'ticket')} empty="No tickets required" /></Card>
      <div className="wk-gap" />
      <Card title="Inductions" flush><ResponsiveTable columns={cols('induction')} rows={items.filter((i) => i.kind === 'induction')} empty="No inductions required" /></Card>
      {w.ratings.length > 0 && (<><div className="wk-gap" /><Card title="Task ratings" flush>
        <ResponsiveTable columns={[{ key: 'task', label: 'Task', primary: true }, { key: 'type', label: 'Type' }, { key: 'role', label: 'Role' }, { key: 'rating', label: 'Rating', render: (r) => `${r.rating} / 5` }]}
          rows={w.ratings.map((r, i) => ({ ...r, id: i }))} empty="" /></Card></>)}
      {editing && <EditItemModal {...editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
