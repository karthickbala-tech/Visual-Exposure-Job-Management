import { useState } from 'react';
import { AlertTriangle, Boxes, FlaskConical, Plus, Search, Wrench } from 'lucide-react';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import KpiLink from '../components/KpiLink';
import { useDemo } from '../context/DemoContext';
import { EQUIPMENT_TYPES, CHEMICAL_UNITS } from '../data/equipmentSeed';
import { EQUIPMENT_EDITORS } from '../lib/access';
import { daysOverdue, isOverdue, isWebUrl, nextDue, nextToolId, sdsMissing, sdsReviewDue } from '../lib/equipment';
import { crewOptions } from '../lib/people';
import { formatLong, formatShort, fullDate, toKey, today } from '../lib/dates';
import './FabDashboard.css';
import './EquipmentPage.css';

const field = (set) => (k) => (e) => set((x) => ({ ...x, [k]: e.target.value }));

/* ---------- Equipment (EQP-1) ---------- */
function EquipmentModal({ onClose }) {
  const { equipment, locations, addEquipment, workers } = useDemo();
  const FAB_CREW = crewOptions(workers, 'fab');
  const [f, setF] = useState({ name: '', type: EQUIPMENT_TYPES[0], location: locations[0]?.name || '', status: 'In service', intervalDays: '30', responsible: FAB_CREW[0], offHireRequired: false });
  const [error, setError] = useState('');
  const set = field(setF);
  const submit = (e) => {
    e.preventDefault();
    const days = Number(f.intervalDays);
    if (!f.name.trim()) return setError('Equipment name is required.');
    if (!f.location) return setError('Add a workshop location first.');
    if (!Number.isInteger(days) || days < 1) return setError('Check interval must be a whole number of days, 1 or more.');
    addEquipment({ name: f.name.trim(), type: f.type, location: f.location, status: f.status, intervalDays: days, responsible: f.responsible, offHireRequired: f.offHireRequired });
    return onClose();
  };
  return (
    <Modal title="Add equipment" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Name<input autoFocus value={f.name} onChange={set('name')} placeholder="e.g. Band saw" /></label>
        <div className="form-row">
          <label>Type<select value={f.type} onChange={set('type')}>{EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Location<select value={f.location} onChange={set('location')}>{locations.map((l) => <option key={l.id}>{l.name}</option>)}</select></label>
        </div>
        <div className="form-row">
          <label>Check every (days)<input type="number" min="1" step="1" value={f.intervalDays} onChange={set('intervalDays')} /></label>
          <label>Responsible<select value={f.responsible} onChange={set('responsible')}>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
        </div>
        <label className="check"><input type="checkbox" checked={f.offHireRequired} onChange={(e) => setF((x) => ({ ...x, offHireRequired: e.target.checked }))} />Hired equipment: goes off hire when an install task using it finishes on site</label>
        <small>The tool code is assigned automatically: {nextToolId(equipment)}.</small>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Add equipment</button>
        </div>
      </form>
    </Modal>
  );
}

function EquipmentDetail({ item, canEdit, onClose }) {
  const { locations, updateEquipment, workers } = useDemo();
  const FAB_CREW = crewOptions(workers, 'fab', [item.responsible]);
  const [f, setF] = useState({ location: item.location, intervalDays: String(item.intervalDays), responsible: item.responsible, offHireRequired: !!item.offHireRequired });
  const [error, setError] = useState('');
  const set = field(setF);
  const save = (e) => {
    e.preventDefault();
    const days = Number(f.intervalDays);
    if (!Number.isInteger(days) || days < 1) return setError('Check interval must be a whole number of days, 1 or more.');
    updateEquipment(item.id, { location: f.location, intervalDays: days, responsible: f.responsible, offHireRequired: f.offHireRequired }, 'Schedule or location changed');
    return onClose();
  };
  return (
    <Modal title={`${item.id} · ${item.name}`} onClose={onClose}>
      <dl className="eq-detail">
        <div><dt>Type</dt><dd>{item.type}</dd></div>
        <div><dt>Status</dt><dd>{item.status}</dd></div>
        <div><dt>Last checked</dt><dd>{formatLong(item.lastChecked)}</dd></div>
        <div><dt>Next check</dt><dd>{item.status === 'Off hire' ? 'Not while off hire' : formatLong(nextDue(item))}</dd></div>
      </dl>
      {canEdit && (
        <form className="form" onSubmit={save} noValidate>
          <div className="form-row">
            <label>Location<select value={f.location} onChange={set('location')}>{locations.map((l) => <option key={l.id}>{l.name}</option>)}</select></label>
            <label>Check every (days)<input type="number" min="1" step="1" value={f.intervalDays} onChange={set('intervalDays')} /></label>
          </div>
          <label>Responsible<select value={f.responsible} onChange={set('responsible')}>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="check"><input type="checkbox" checked={f.offHireRequired} onChange={(e) => setF((x) => ({ ...x, offHireRequired: e.target.checked }))} />Goes off hire when an install task using it finishes on site</label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions"><button type="submit" className="btn btn-primary">Save changes</button></div>
        </form>
      )}
      <h3>History</h3>
      {(item.history || []).length === 0
        ? <p className="muted">No changes recorded yet in this demo session.</p>
        : <ul className="hist">{item.history.map((h, i) => <li key={i}><span>{h.text} · {h.who}</span><small>{h.at}</small></li>)}</ul>}
    </Modal>
  );
}

function EquipmentTab({ canEdit }) {
  const { equipment, completeEquipmentCheck, setEquipmentStatus } = useDemo();
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);
  const key = toKey(today());

  const overdue = equipment.filter((e) => isOverdue(e, key));
  const rows = equipment.filter((e) => {
    const okStatus = status === 'All' || (status === 'Overdue' ? isOverdue(e, key) : e.status === status);
    return okStatus && (!type || e.type === type) && `${e.id} ${e.name} ${e.location}`.toLowerCase().includes(q.toLowerCase());
  });
  const shown = open ? equipment.find((e) => e.id === open) : null;

  const columns = [
    { key: 'id', label: 'Tool ID', primary: true, render: (e) => <strong>{e.id}</strong> },
    { key: 'name', label: 'Equipment', render: (e) => <div className="stack"><span>{e.name}</span><small>{e.type} · {e.location}</small></div> },
    { key: 'status', label: 'Status', render: (e) => <Chip value={e.status} tone={e.status === 'Off hire' ? 'amber' : 'green'} /> },
    { key: 'last', label: 'Last checked', render: (e) => formatShort(e.lastChecked) },
    { key: 'next', label: 'Next check', render: (e) => (e.status === 'Off hire' ? '-' : (
      <span className={isOverdue(e, key) ? 'over' : ''}>{formatShort(nextDue(e))}{isOverdue(e, key) ? ` · ${daysOverdue(e, key)} days late` : ''}</span>)) },
    { key: 'every', label: 'Every', render: (e) => `${e.intervalDays} days` },
    { key: 'who', label: 'Responsible', render: (e) => e.responsible },
    { key: 'action', label: 'Action', render: (e) => (
      <div className="row-actions">
        {e.status === 'In service' && <button type="button" className={`btn btn-sm ${isOverdue(e, key) ? 'btn-primary' : 'btn-ghost'}`} onClick={() => completeEquipmentCheck(e.id)}>Mark checked</button>}
        {canEdit && (e.status === 'In service'
          ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEquipmentStatus(e.id, 'Off hire')}>Off hire</button>
          : <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEquipmentStatus(e.id, 'In service')}>Back in service</button>)}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(e.id)}>Details</button>
      </div>) },
  ];

  return (
    <>
      <div className="kpis">
        <KpiCard icon={Boxes} label="Equipment" value={equipment.length} note="in the register" />
        <KpiLink icon={Wrench} label="In service" value={equipment.filter((e) => e.status === 'In service').length} note={`${equipment.filter((e) => e.status === 'Off hire').length} off hire`} onClick={() => setStatus('In service')} active={status === 'In service'} />
        <KpiLink icon={AlertTriangle} label="Overdue checks" value={overdue.length} tone={overdue.length ? 'danger' : 'brand'} note="in service and past their date" onClick={() => setStatus('Overdue')} active={status === 'Overdue'} />
      </div>
      <div className="eq-tools">
        <label className="search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tool ID, name or location" aria-label="Filter equipment" />
        </label>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Equipment type"><option value="">All types</option>{EQUIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        <div className="segmented" role="tablist" aria-label="Equipment status">
          {['All', 'In service', 'Off hire', 'Overdue'].map((s) => (
            <button key={s} type="button" role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => setStatus(s)}>{s}</button>))}
        </div>
        <span className="grow" />
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Add equipment</button>}
      </div>
      {status === 'Overdue' && rows.length > 1 && (
        <div className="bulk-note" role="region" aria-label="Bulk actions">
          <span><strong>{rows.length} overdue checks</strong> in this view.</span>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { rows.forEach((e) => completeEquipmentCheck(e.id)); setStatus('All'); }}>Mark all {rows.length} checked</button>
        </div>
      )}
      <Card title="Equipment register" flush><ResponsiveTable columns={columns} rows={rows} empty="No equipment matches" /></Card>
      {adding && <EquipmentModal onClose={() => setAdding(false)} />}
      {shown && <EquipmentDetail item={shown} canEdit={canEdit} onClose={() => setOpen(null)} />}
    </>
  );
}

/* ---------- Chemicals (EQP-3) ---------- */
function ChemicalModal({ item, onClose }) {
  const { locations, addChemical, updateChemical } = useDemo();
  const [f, setF] = useState(item
    ? { ...item, stock: String(item.stock) }
    : { name: '', supplier: '', hazardClass: '', location: locations[0]?.name || '', stock: '', unit: CHEMICAL_UNITS[0], sdsUrl: '', reviewDate: '' });
  const [error, setError] = useState('');
  const set = field(setF);
  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError('Chemical name is required.');
    if (!f.location) return setError('Choose a location.');
    const stock = f.stock === '' ? 0 : Number(f.stock);
    if (Number.isNaN(stock) || stock < 0) return setError('Stock must be a number, 0 or more.');
    if (f.sdsUrl.trim() && !isWebUrl(f.sdsUrl)) return setError('The SDS link must start with http:// or https://.');
    const data = { name: f.name.trim(), supplier: f.supplier.trim(), hazardClass: f.hazardClass.trim(), location: f.location, stock, unit: f.unit, sdsUrl: f.sdsUrl.trim(), reviewDate: f.reviewDate };
    if (item) updateChemical(item.id, data); else addChemical(data);
    return onClose();
  };
  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add chemical'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Name<input autoFocus value={f.name} onChange={set('name')} /></label>
        <div className="form-row">
          <label>Supplier<input value={f.supplier} onChange={set('supplier')} /></label>
          <label>Hazard class<input value={f.hazardClass} onChange={set('hazardClass')} placeholder="e.g. 3 Flammable liquid" /></label>
        </div>
        <div className="form-row">
          <label>Location<select value={f.location} onChange={set('location')}>{locations.map((l) => <option key={l.id}>{l.name}</option>)}</select></label>
          <label>SDS review due<input type="date" value={f.reviewDate} onChange={set('reviewDate')} /></label>
        </div>
        <div className="form-row">
          <label>Stock<input type="number" min="0" step="any" value={f.stock} onChange={set('stock')} /></label>
          <label>Unit<select value={f.unit} onChange={set('unit')}>{CHEMICAL_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        </div>
        <label>SDS link<input value={f.sdsUrl} onChange={set('sdsUrl')} placeholder="https://" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{item ? 'Save changes' : 'Add chemical'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ChemicalsTab({ canEdit }) {
  const { chemicals, locations } = useDemo();
  const [editing, setEditing] = useState(null); // null, 'new' or a chemical
  const [q, setQ] = useState('');
  const key = toKey(today());
  const list = chemicals.filter((c) => `${c.name} ${c.supplier} ${c.hazardClass}`.toLowerCase().includes(q.toLowerCase()));
  const names = [...new Set([...locations.map((l) => l.name), ...list.map((c) => c.location)])];

  const columns = [
    { key: 'name', label: 'Chemical', primary: true, render: (c) => <div className="stack"><strong>{c.name}</strong><small>{c.supplier || 'No supplier'}</small></div> },
    { key: 'hazard', label: 'Hazard class', render: (c) => c.hazardClass || '-' },
    { key: 'stock', label: 'Stock', render: (c) => `${c.stock} ${c.unit}` },
    { key: 'sds', label: 'SDS', render: (c) => (sdsMissing(c)
      ? <span className="sds-missing">Missing</span>
      : <a className="sds-link" href={c.sdsUrl} target="_blank" rel="noopener noreferrer">Open SDS</a>) },
    { key: 'review', label: 'SDS review', render: (c) => (c.reviewDate
      ? <span className={sdsReviewDue(c, key) ? 'over' : ''}>{formatShort(c.reviewDate)}{sdsReviewDue(c, key) ? ' · overdue' : ''}</span> : '-') },
    ...(canEdit ? [{ key: 'action', label: 'Action', render: (c) => <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(c)}>Edit</button> }] : []),
  ];

  return (
    <>
      <div className="kpis">
        <KpiCard icon={FlaskConical} label="Chemicals" value={chemicals.length} note={`${new Set(chemicals.map((c) => c.location)).size} locations`} />
        <KpiCard icon={AlertTriangle} label="SDS review overdue" value={chemicals.filter((c) => sdsReviewDue(c, key)).length} tone={chemicals.some((c) => sdsReviewDue(c, key)) ? 'danger' : 'brand'} note="past their review date" />
        <KpiCard icon={AlertTriangle} label="SDS missing" value={chemicals.filter(sdsMissing).length} tone={chemicals.some(sdsMissing) ? 'warn' : 'brand'} note="no link on file" />
      </div>
      <div className="eq-tools">
        <label className="search"><Search size={16} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, supplier or hazard class" aria-label="Filter chemicals" />
        </label>
        <span className="grow" />
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Add chemical</button>}
      </div>
      {names.map((n) => {
        const rows = list.filter((c) => c.location === n);
        if (!rows.length) return null;
        return <div key={n}><Card title={`${n} · ${rows.length} chemical${rows.length === 1 ? '' : 's'}`} flush><ResponsiveTable columns={columns} rows={rows} /></Card><div className="eq-gap" /></div>;
      })}
      {list.length === 0 && <Card><p className="muted">No chemicals match.</p></Card>}
      {editing && <ChemicalModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

/* ---------- Workshop locations (EQP-5) ---------- */
function LocationModal({ item, onClose }) {
  const { locations, addLocation, updateLocation, workers } = useDemo();
  const FAB_CREW = crewOptions(workers, 'fab', [item?.supervisor]);
  const [f, setF] = useState(item || { name: '', supervisor: FAB_CREW[0], notes: '' });
  const [error, setError] = useState('');
  const set = field(setF);
  const submit = (e) => {
    e.preventDefault();
    const name = f.name.trim();
    if (!name) return setError('Location name is required.');
    if (locations.some((l) => l.id !== item?.id && l.name.toLowerCase() === name.toLowerCase())) return setError('A location with this name already exists.');
    const data = { name, supervisor: f.supervisor, notes: f.notes.trim() };
    if (item) updateLocation(item.id, data); else addLocation(data);
    return onClose();
  };
  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add workshop location'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Name<input autoFocus value={f.name} onChange={set('name')} /></label>
        <label>Area supervisor<select value={f.supervisor} onChange={set('supervisor')}>{FAB_CREW.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>Notes<textarea rows="3" value={f.notes} onChange={set('notes')} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{item ? 'Save changes' : 'Add location'}</button>
        </div>
      </form>
    </Modal>
  );
}

function LocationsTab({ canEdit }) {
  const { locations, equipment, chemicals, deleteLocation } = useDemo();
  const [editing, setEditing] = useState(null);
  const columns = [
    { key: 'name', label: 'Location', primary: true, render: (l) => <strong>{l.name}</strong> },
    { key: 'sup', label: 'Area supervisor', render: (l) => l.supervisor },
    { key: 'eq', label: 'Equipment', render: (l) => equipment.filter((e) => e.location === l.name).length },
    { key: 'ch', label: 'Chemicals', render: (l) => chemicals.filter((c) => c.location === l.name).length },
    { key: 'notes', label: 'Notes', render: (l) => l.notes || '-' },
    ...(canEdit ? [{ key: 'action', label: 'Action', render: (l) => (
      <div className="row-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(l)}>Edit</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteLocation(l.id)}>Delete</button>
      </div>) }] : []),
  ];
  return (
    <>
      <div className="eq-tools">
        <span className="grow" />
        {canEdit && <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}><Plus size={16} aria-hidden="true" /> Add location</button>}
      </div>
      <Card title="Workshop locations" flush><ResponsiveTable columns={columns} rows={locations} empty="No locations yet" /></Card>
      {editing && <LocationModal item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export default function EquipmentPage() {
  const { roleId } = useDemo();
  const [tab, setTab] = useState('Equipment');
  const canEdit = EQUIPMENT_EDITORS.includes(roleId);
  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Equipment and Chemicals" subtitle={canEdit ? 'Registers, SDS links and workshop locations.' : 'View only. You can mark checks as done. A Fab Manager, PM or Workshop user edits the registers.'} />
      <div className="segmented eq-tabs" role="tablist" aria-label="Section">
        {['Equipment', 'Chemicals', 'Workshop locations'].map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>))}
      </div>
      {tab === 'Equipment' && <EquipmentTab canEdit={canEdit} />}
      {tab === 'Chemicals' && <ChemicalsTab canEdit={canEdit} />}
      {tab === 'Workshop locations' && <LocationsTab canEdit={canEdit} />}
    </div>
  );
}
