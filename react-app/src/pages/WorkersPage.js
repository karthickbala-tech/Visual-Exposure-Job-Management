import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Building2, Clock, FileWarning, Pencil, Plus, Users } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import KpiLink from '../components/KpiLink';
import { SearchBox } from '../components/ListKit';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui-kit/sheet';
import { Button } from '../components/ui-kit/button';
import { useDemo } from '../context/DemoContext';
import { COMPANY_TYPES, VE_NAME, WORKER_TYPES, docTypes, inductionTypes, ticketTypes } from '../data/workersSeed';
import { STATUS_TONE, bucketOf, complianceSummary, expiryText, statusOf, worst } from '../lib/compliance';
import { formatShort, fromKey, toKey, today } from '../lib/dates';
import './WorkersPage.css';

const TABS = [['ve', 'VE workers'], ['subs', 'Subcontractors'], ['compliance', 'Tickets and inductions'], ['docs', 'Company documents']];
const MANAGE_ROLES = ['admin', 'pm', 'fabManager'];
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
  const { companies, addWorker, settings } = useDemo();
  const PRIMARY_ROLES = settings.primaryRoles; // set in Admin
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

// Edit a worker's profile. Admin sets the hourly rate; anyone who manages workers can change the rest.
function EditWorkerModal({ worker, onClose }) {
  const { companies, updateWorker, settings, roleId } = useDemo();
  const [f, setF] = useState({
    name: worker.name, type: worker.type, primaryRole: worker.primaryRole || '', phone: worker.phone || '', email: worker.email || '',
    start: worker.start || '', skills: worker.skills || '', hourlyRate: worker.hourlyRate ?? '', active: worker.active !== false,
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const isVe = companies.find((c) => c.id === worker.companyId)?.name === VE_NAME;
  const isAdmin = roleId === 'admin';
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('The worker\'s name is required.');
    if (isVe && !f.primaryRole) return setError('Choose a primary role for a Visual Exposure worker.');
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address.');
    if (isAdmin && f.hourlyRate !== '' && (Number.isNaN(Number(f.hourlyRate)) || Number(f.hourlyRate) < 0)) return setError('The hourly rate must be zero or more.');
    const patch = { ...f, name: f.name.trim(), primaryRole: isVe ? f.primaryRole : '' };
    if (isAdmin) patch.hourlyRate = f.hourlyRate === '' ? undefined : Number(f.hourlyRate);
    else delete patch.hourlyRate;
    updateWorker(worker.id, patch);
    return onClose();
  };
  return (
    <Modal title={`Edit worker: ${worker.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Full name<input autoFocus value={f.name} onChange={set('name')} /></label>
        <div className="form-row">
          <label>Worker type<select value={f.type} onChange={set('type')}>{[...new Set([f.type, ...WORKER_TYPES])].map((t) => <option key={t}>{t}</option>)}</select></label>
          {isVe && <label>Primary role<select value={f.primaryRole} onChange={set('primaryRole')}><option value="">Choose…</option>{[...new Set([f.primaryRole, ...settings.primaryRoles].filter(Boolean))].map((r) => <option key={r}>{r}</option>)}</select></label>}
        </div>
        <div className="form-row">
          <label>Phone<input value={f.phone} onChange={set('phone')} /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} /></label>
        </div>
        <div className="form-row">
          <label>Start date<input type="date" value={f.start} onChange={set('start')} /></label>
          {isAdmin && <label>Hourly rate ($)<input type="number" min="0" step="0.5" value={f.hourlyRate} onChange={set('hourlyRate')} /></label>}
        </div>
        <label>Skills<input value={f.skills} onChange={set('skills')} /></label>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />Active (untick when the worker leaves; their records are kept)</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save worker</button>
        </div>
      </form>
    </Modal>
  );
}

// Add a ticket or induction the worker was not given automatically, for example a site induction for one job.
function AddItemModal({ worker, kind, have, onClose }) {
  const { addComplianceItem } = useDemo();
  const types = kind === 'ticket' ? ticketTypes : inductionTypes;
  const free = types.filter((t) => !have.includes(t.id));
  const [f, setF] = useState({ typeId: free[0]?.id || '', ref: '', issue: '', expiry: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const years = types.find((t) => t.id === f.typeId)?.years;
  const submit = (e) => {
    e.preventDefault();
    if (!f.typeId) return setError(`Choose a ${kind} type.`);
    if (f.issue && f.expiry && f.expiry <= f.issue) return setError('The expiry date must be after the issue date.');
    addComplianceItem(kind, { ...f, workerId: worker.id });
    return onClose();
  };
  const suggest = () => {
    if (!f.issue || !years) return;
    const d = fromKey(f.issue);
    setF((x) => ({ ...x, expiry: toKey(new Date(d.getFullYear() + years, d.getMonth(), d.getDate())) }));
  };
  return (
    <Modal title={`Add ${kind === 'ticket' ? 'a ticket' : 'an induction'}: ${worker.name}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        {free.length === 0 ? <p className="muted">{worker.name} already has every {kind} type. Add a new type in Admin first.</p> : (
          <>
            <label>{kind === 'ticket' ? 'Ticket' : 'Induction'}<select autoFocus value={f.typeId} onChange={set('typeId')}>{free.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Reference number<input value={f.ref} onChange={set('ref')} /></label>
            <div className="form-row">
              <label>Issue date<input type="date" max={toKey(today())} value={f.issue} onChange={set('issue')} /></label>
              <label>Expiry date<input type="date" value={f.expiry} onChange={set('expiry')} /></label>
            </div>
            {years > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={suggest} disabled={!f.issue}>Set expiry {years} years after issue</button>}
            <small>No login details are stored for training portals (CMP-5).</small>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {free.length > 0 && <button type="submit" className="btn btn-primary">Add</button>}
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

// A worker opened from the list: contact details, compliance status and what needs doing, with the full profile one link away.
function WorkerDrawer({ worker, company, onClose }) {
  const { tickets, inductions } = useDemo();
  if (!worker) return <Sheet open={false} onOpenChange={onClose} />;
  const items = itemsFor(worker.id, tickets, inductions);
  const todo = items.filter((i) => statusOf(i.expiry) !== 'Current');
  const overall = worst(items.map((i) => i.expiry));
  return (
    <Sheet open onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-background p-0 sm:max-w-[440px]" aria-describedby={undefined}>
        <SheetHeader className="space-y-1 border-b bg-card p-5 pr-12 text-left">
          <SheetDescription>{worker.type}</SheetDescription>
          <SheetTitle className="text-lg font-bold">{worker.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-sm"><Chip value={overall} tone={STATUS_TONE[overall]} />{worker.active === false && <Chip value="Inactive" tone="gray" />}</div>
        </SheetHeader>
        <div className="grid gap-4 p-5 text-sm">
          <dl className="m-0 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
            <dt className="text-muted-foreground">Company</dt><dd className="m-0">{company(worker.companyId)}</dd>
            {worker.primaryRole && <><dt className="text-muted-foreground">Primary role</dt><dd className="m-0">{worker.primaryRole}</dd></>}
            <dt className="text-muted-foreground">Phone</dt><dd className="m-0">{worker.phone ? <a href={`tel:${worker.phone}`}>{worker.phone}</a> : '-'}</dd>
            <dt className="text-muted-foreground">Email</dt><dd className="m-0 break-all">{worker.email ? <a href={`mailto:${worker.email}`}>{worker.email}</a> : '-'}</dd>
          </dl>
          <div>
            <h3 className="m-0 mb-2 text-sm font-bold">{todo.length ? `${todo.length} item${todo.length > 1 ? 's' : ''} to action` : 'All tickets and inductions are current'}</h3>
            <ul className="m-0 grid list-none gap-2 p-0">
              {todo.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2">
                  <span><b>{i.name}</b><small className="block text-muted-foreground">{i.kind === 'ticket' ? 'Ticket' : 'Induction'} · {i.expiry ? `${formatShort(i.expiry)} (${expiryText(i.expiry)})` : 'not filled in'}</small></span>
                  <StatusChip expiry={i.expiry} />
                </li>
              ))}
            </ul>
          </div>
          <Button asChild variant="outline"><Link to={`/workers/${worker.id}`} className="no-underline">Open full profile</Link></Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function WorkersPage() {
  const { workers, companies, tickets, inductions, companyDocs, roleId, role } = useDemo();
  const [tab, setTab] = useState('ve');
  const [filter, setFilter] = useState('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState(null);
  const canManage = ['admin', 'pm'].includes(roleId);
  const selfOnly = ['installer','fabWorker','workshop','designer','contractor'].includes(roleId);
  const myWorker = workers.find((w) => w.name === role.name || w.name === role.name.replace(/\s+([A-Z]).*$/, ' $1.'));
  const scopedTickets = selfOnly ? tickets.filter((x) => x.workerId === myWorker?.id) : tickets;
  const scopedInductions = selfOnly ? inductions.filter((x) => x.workerId === myWorker?.id) : inductions;
  const company = (id) => companies.find((c) => c.id === id)?.name || id;
  const worker = (id) => workers.find((w) => w.id === id);

  const sum = complianceSummary({ workers: selfOnly ? workers.filter(w => w.id === myWorker?.id) : workers, companies, tickets: scopedTickets, inductions: scopedInductions, companyDocs: selfOnly ? [] : companyDocs, veName: VE_NAME, activeOnly: selfOnly ? false : activeOnly });
  const needle = q.trim().toLowerCase();
  const hit = (text) => !needle || String(text || '').toLowerCase().includes(needle);
  const veWorkers = sum.shownWorkers.filter((w) => company(w.companyId) === VE_NAME && hit(`${w.name} ${w.primaryRole} ${w.phone}`));
  const subWorkers = sum.shownWorkers.filter((w) => company(w.companyId) !== VE_NAME && hit(`${w.name} ${company(w.companyId)}`));
  const all = [
    ...sum.tickets.map((t) => ({ ...t, kind: 'ticket', name: typeName(ticketTypes, t.typeId), owner: worker(t.workerId)?.name, ownerId: t.workerId, years: ticketTypes.find((x) => x.id === t.typeId)?.years })),
    ...sum.inductions.map((t) => ({ ...t, kind: 'induction', name: typeName(inductionTypes, t.typeId), owner: worker(t.workerId)?.name, ownerId: t.workerId })),
  ];
  const rows = all.filter((x) => (filter === 'all' || bucketOf(x.expiry) === filter) && hit(`${x.owner} ${x.name} ${x.ref}`))
    .sort((a, b) => (a.expiry || '0000').localeCompare(b.expiry || '0000'));
  const b = sum.buckets;
  const split = (k) => `${b[k].tickets} tickets, ${b[k].inductions} inductions, ${b[k].docs} documents`;
  const workerStatus = (w) => worst(itemsFor(w.id, tickets, inductions).map((i) => i.expiry));
  const openItems = (w) => itemsFor(w.id, tickets, inductions).filter((i) => statusOf(i.expiry) !== 'Current').length;

  const workerCols = [
    { key: 'name', label: 'Worker', primary: true, render: (w) => <div className="stack"><button type="button" className="link-btn text-left" onClick={() => setOpenId(w.id)}>{w.name}</button><small>{w.type}{w.active ? '' : ' · Inactive'}</small></div> },
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
      <PageHeader eyebrow="People" title={selfOnly ? "My tickets & inductions" : "Workers"} subtitle={selfOnly ? "Only your own compliance records are shown." : "Employees, subcontractors, tickets, inductions and company documents."}>
        {!selfOnly && canManage && (<><button type="button" className="btn btn-primary" onClick={() => setAdding('worker')}><Plus size={16} aria-hidden="true" /> Add worker</button>
          <button type="button" className="btn btn-ghost" onClick={() => setAdding('company')}><Building2 size={16} aria-hidden="true" /> Add company</button></>)}
      </PageHeader>

      {!selfOnly && <div className="wk-tools">
        <div className="segmented" role="tablist" aria-label="Active filter">
          <button type="button" role="tab" aria-selected={activeOnly} className={activeOnly ? 'on' : ''} onClick={() => setActiveOnly(true)}>Active only</button>
          <button type="button" role="tab" aria-selected={!activeOnly} className={!activeOnly ? 'on' : ''} onClick={() => setActiveOnly(false)}>All</button>
        </div>
      </div>}
      {!selfOnly && <div className="kpis" aria-label="Compliance summary">
        <KpiCard icon={Users} label={activeOnly ? 'Active VE workers' : 'VE workers'} value={sum.workers.ve} note="employees" />
        <KpiCard icon={Users} label={activeOnly ? 'Active non-VE workers' : 'Non-VE workers'} value={sum.workers.nonVe} note="subcontractors" />
        <KpiLink icon={AlertTriangle} label="Expired" value={b.Expired.total} tone={b.Expired.total ? 'danger' : 'brand'} note={split('Expired')} onClick={() => { setTab('compliance'); setFilter('Expired'); }} active={tab === 'compliance' && filter === 'Expired'} />
        <KpiLink icon={Clock} label="Expires today" value={b.Today.total} tone={b.Today.total ? 'danger' : 'brand'} note={split('Today')} onClick={() => { setTab('compliance'); setFilter('Today'); }} active={tab === 'compliance' && filter === 'Today'} />
        <KpiLink icon={Clock} label="Within 30 days" value={b.Soon.total} tone={b.Soon.total ? 'warn' : 'brand'} note={split('Soon')} onClick={() => { setTab('compliance'); setFilter('Soon'); }} active={tab === 'compliance' && filter === 'Soon'} />
        <KpiLink icon={FileWarning} label="Not filled in" value={b.Incomplete.total} note="waiting for details" onClick={() => { setTab('compliance'); setFilter('Incomplete'); }} active={tab === 'compliance' && filter === 'Incomplete'} />
      </div>}

      {!selfOnly && <div className="wk-tools ui-scope font-sans">
        <SearchBox value={q} onChange={setQ} placeholder="Search name, role, company or ticket" label="Search workers" />
        <div className="segmented" role="tablist" aria-label="Workers view">
          {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
        </div>
      </div>}

      {!selfOnly && tab === 've' && <Card flush><ResponsiveTable columns={workerCols} rows={veWorkers} empty="No active employees" /></Card>}
      {!selfOnly && tab === 'subs' && (
        <>
          <Card title="Subcontractor workers" flush><ResponsiveTable columns={workerCols} rows={subWorkers} empty="No active subcontractors" /></Card>
          <div className="wk-gap" />
          <Card title="Subcontractor companies" flush><ResponsiveTable columns={companyCols} rows={companies.filter((c) => c.name !== VE_NAME)} empty="No companies" /></Card>
        </>)}
      {(selfOnly || tab === 'compliance') && (
        <>
          <div className="wk-tools">
            <div className="segmented" role="tablist" aria-label="Status filter">
              {[['all', 'All'], ['Expired', 'Expired'], ['Today', 'Expires today'], ['Soon', 'Within 30 days'], ['Incomplete', 'Not filled in']].map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
                  {label}<em>{id === 'all' ? all.length : all.filter((x) => bucketOf(x.expiry) === id).length}</em></button>))}
            </div>
          </div>
          <Card flush><ResponsiveTable columns={complianceCols} rows={rows} empty="Nothing in this view" /></Card>
        </>)}
      {!selfOnly && tab === 'docs' && <Card flush><ResponsiveTable columns={docCols} rows={[...sum.docs].sort((a, b) => (a.expiry || '0000').localeCompare(b.expiry || '0000'))} empty="No company documents" /></Card>}

      {editing && <EditItemModal {...editing} onClose={() => setEditing(null)} />}
      <WorkerDrawer worker={workers.find((w) => w.id === openId) || null} company={company} onClose={() => setOpenId(null)} />
      {adding === 'worker' && <AddWorkerModal onClose={() => setAdding('')} />}
      {adding === 'company' && <AddCompanyModal onClose={() => setAdding('')} />}
    </div>
  );
}

export function WorkerDetail() {
  const { workerId } = useParams();
  const { workers, companies, tickets, inductions, role, roleId } = useDemo();
  const [editing, setEditing] = useState(null);
  const [modal, setModal] = useState('');
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
      <PageHeader eyebrow={w.type} title={w.name} subtitle={`${company}${w.primaryRole ? ` · ${w.primaryRole}` : ''}${w.active === false ? ' · inactive' : ''}`}>
        <Chip value={overall} tone={STATUS_TONE[overall]} />
        {MANAGE_ROLES.includes(roleId) && <button type="button" className="btn btn-ghost" onClick={() => setModal('edit')}><Pencil size={16} aria-hidden="true" /> Edit worker</button>}
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
      <Card title="Tickets" flush action={canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('ticket')}><Plus size={14} aria-hidden="true" /> Add ticket</button>}>
        <ResponsiveTable columns={cols('ticket')} rows={items.filter((i) => i.kind === 'ticket')} empty="No tickets yet" />
      </Card>
      <div className="wk-gap" />
      <Card title="Inductions" flush action={canEdit && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal('induction')}><Plus size={14} aria-hidden="true" /> Add induction</button>}>
        <ResponsiveTable columns={cols('induction')} rows={items.filter((i) => i.kind === 'induction')} empty="No inductions yet" />
      </Card>
      {w.ratings.length > 0 && (<><div className="wk-gap" /><Card title="Task ratings" flush>
        <ResponsiveTable columns={[{ key: 'task', label: 'Task', primary: true }, { key: 'type', label: 'Type' }, { key: 'role', label: 'Role' }, { key: 'rating', label: 'Rating', render: (r) => `${r.rating} / 5` }]}
          rows={w.ratings.map((r, i) => ({ ...r, id: i }))} empty="" /></Card></>)}
      {editing && <EditItemModal {...editing} onClose={() => setEditing(null)} />}
      {modal === 'edit' && <EditWorkerModal worker={w} onClose={() => setModal('')} />}
      {(modal === 'ticket' || modal === 'induction') && (
        <AddItemModal worker={w} kind={modal} onClose={() => setModal('')}
          have={(modal === 'ticket' ? tickets : inductions).filter((x) => x.workerId === w.id).map((x) => x.typeId)} />
      )}
    </div>
  );
}
