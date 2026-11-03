import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Pencil, Plus, Upload, X } from 'lucide-react';
import { Card, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import { DEPARTMENTS, PEOPLE } from '../data/issuesSeed';
import { ROLES } from '../data/mockData';
import { NAV } from '../navConfig';
import { ACCESS } from '../lib/access';
import {
  addPrimaryRole, canRemovePrimaryRole, exportSettings, generalPatch, parseSettingsImport, placeholdersOf, toCsv, validateGeneral, validateTemplate,
} from '../lib/admin';
import { listUsers, setUserRole } from '../lib/authStore';
import { formatShort, toKey, today } from '../lib/dates';
import { thisPayPeriod } from '../lib/payPeriod';
import './AdminPage.css';

const TABS = [['general', 'General'], ['notify', 'Notifications'], ['templates', 'Mail templates'], ['roles', 'Roles and users'], ['data', 'Import and export']];
const ALL_PEOPLE = [...new Set([...PEOPLE, ...Object.values(ROLES).map((r) => r.name)])].sort();

const download = (name, text, type, notify) => {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  } catch { notify('Could not create the file in this browser'); }
};

function PeoplePicker({ legend, value, onChange, exclude = '' }) {
  const toggle = (p) => onChange(value.includes(p) ? value.filter((x) => x !== p) : [...value, p]);
  return (
    <fieldset className="ad-people">
      <legend>{legend}</legend>
      {ALL_PEOPLE.filter((p) => p !== exclude).map((p) => (
        <label key={p} className="check-inline"><input type="checkbox" checked={value.includes(p)} onChange={() => toggle(p)} />{p}</label>
      ))}
    </fieldset>
  );
}

// ---- General: pay period, cutoff, expiry window, workshop job, PCBU defaults ----
function GeneralTab() {
  const { settings, updateSettings, allJobs, notify } = useDemo();
  const [d, setD] = useState(() => ({
    anchor: settings.payPeriod.anchor, days: String(settings.payPeriod.days), cutoff: settings.hoursCutoff, expiryDays: String(settings.expiryDays),
    workshopJobId: settings.workshopJobId, pcbuName: settings.pcbu.name, pcbuContact: settings.pcbu.contact, pcbuPhone: settings.pcbu.phone,
  }));
  const [error, setError] = useState('');
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  const preview = !validateGeneral({ ...d, pcbuName: 'x' }) ? thisPayPeriod(toKey(today()), { anchor: d.anchor, days: Number(d.days) }) : null;

  const save = (e) => {
    e.preventDefault();
    const err = validateGeneral(d);
    setError(err);
    if (err) return;
    updateSettings(generalPatch(d));
    notify('Settings saved');
  };

  return (
    <form className="form ad-form" onSubmit={save} noValidate>
      <Card title="Pay period and hours">
        <div className="form-row">
          <label>Pay period start date<input type="date" value={d.anchor} onChange={set('anchor')} /></label>
          <label>Pay period length (days)<input inputMode="numeric" value={d.days} onChange={set('days')} /></label>
        </div>
        <small className="muted">{preview ? `The current pay period runs ${formatShort(preview.from)} to ${formatShort(preview.to)}.` : 'Enter a valid start date and length to see the current pay period.'} The client has not confirmed the start day and length yet (FSD question 11).</small>
        <label>Hours-not-filled cutoff date<input type="date" value={d.cutoff} onChange={set('cutoff')} /></label>
        <small className="muted">Checklists for tasks scheduled before this date are not counted as hours not filled (question 19).</small>
      </Card>
      <Card title="Compliance and workshop">
        <label>Expiry warning (days)<input inputMode="numeric" value={d.expiryDays} onChange={set('expiryDays')} /></label>
        <small className="muted">Tickets, inductions and documents expiring within this many days show as Expiring.</small>
        <label>Workshop job<select value={d.workshopJobId} onChange={set('workshopJobId')}>
          {allJobs.map((j) => <option key={j.id} value={j.id}>{j.id} · {j.name}</option>)}
        </select></label>
        <small className="muted">The Create workshop task button adds tasks to this job.</small>
      </Card>
      <Card title="SWMS defaults (PCBU)">
        <label>PCBU name<input value={d.pcbuName} onChange={set('pcbuName')} /></label>
        <div className="form-row">
          <label>Company contact<input value={d.pcbuContact} onChange={set('pcbuContact')} /></label>
          <label>Contact phone<input value={d.pcbuPhone} onChange={set('pcbuPhone')} /></label>
        </div>
        <small className="muted">New SWMS documents start with these details. The SWMS PDF will read them once the backend exists.</small>
      </Card>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary">Save settings</button></div>
    </form>
  );
}

// ---- Notifications: who gets each department's issues, who holds the manager roles, who gets the weekly hours report ----
const ROLE_LABELS = { fabManager: 'Fab Manager', installationManager: 'Installation manager', installCoordinator: 'Install Coordinator', director: 'Director' };

function NotifyTab() {
  const { settings, updateSettings, notify } = useDemo();
  const [routing, setRouting] = useState(settings.issueRouting);
  const [assign, setAssign] = useState(settings.roleAssignments);
  const [recipients, setRecipients] = useState(settings.hoursReportRecipients);
  const [error, setError] = useState('');

  const save = (e) => {
    e.preventDefault();
    const missing = DEPARTMENTS.find((dep) => !routing[dep]?.manager);
    if (missing) return setError(`Choose a manager for ${missing}.`);
    setError('');
    updateSettings({ issueRouting: routing, roleAssignments: assign, hoursReportRecipients: recipients });
    return notify('Notification settings saved');
  };

  return (
    <form className="form ad-form" onSubmit={save} noValidate>
      <Card title="Issue routing by department">
        {DEPARTMENTS.map((dep) => (
          <div key={dep} className="ad-dept">
            <label>{dep} manager
              <select value={routing[dep]?.manager || ''} onChange={(e) => setRouting((r) => ({ ...r, [dep]: { ...r[dep], manager: e.target.value, also: (r[dep]?.also || []).filter((p) => p !== e.target.value) } }))}>
                <option value="">Choose…</option>
                {ALL_PEOPLE.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <PeoplePicker legend={`Also informed for ${dep}`} exclude={routing[dep]?.manager} value={routing[dep]?.also || []}
              onChange={(also) => setRouting((r) => ({ ...r, [dep]: { ...r[dep], also } }))} />
          </div>
        ))}
        <small className="muted">New issues go to the department manager, and the inform-also people are copied.</small>
      </Card>
      <Card title="Role assignments">
        <div className="form-row">
          {Object.keys(ROLE_LABELS).map((k) => (
            <label key={k}>{ROLE_LABELS[k]}
              <select value={assign[k] || ''} onChange={(e) => setAssign((a) => ({ ...a, [k]: e.target.value }))}>
                <option value="">Not set</option>
                {ALL_PEOPLE.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
          ))}
        </div>
        <small className="muted">Emails go to people by these roles, never to fixed addresses.</small>
      </Card>
      <Card title="Weekly hours report">
        <PeoplePicker legend="Recipients" value={recipients} onChange={setRecipients} />
      </Card>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions"><button type="submit" className="btn btn-primary">Save notification settings</button></div>
    </form>
  );
}

// ---- Mail templates ----
function TemplateModal({ template, onClose }) {
  const { settings, updateSettings, notify } = useDemo();
  const [f, setF] = useState({ subject: template.subject, body: template.body });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const used = placeholdersOf(`${f.subject} ${f.body}`);

  const submit = (e) => {
    e.preventDefault();
    const err = validateTemplate(f);
    if (err) return setError(err);
    updateSettings({ templates: settings.templates.map((t) => (t.key === template.key ? { ...t, ...f } : t)) });
    notify(`Template saved: ${template.event}`);
    return onClose();
  };
  return (
    <Modal title={template.event} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <small className="muted">Sent to: {template.to}</small>
        <label>Subject<input autoFocus value={f.subject} onChange={set('subject')} /></label>
        <label>Message<textarea rows={6} value={f.body} onChange={set('body')} /></label>
        <div className="tags">{used.map((p) => <em key={p}>{`{${p}}`}</em>)}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Save template</button>
        </div>
      </form>
    </Modal>
  );
}

function TemplatesTab() {
  const { settings } = useDemo();
  const [editing, setEditing] = useState(null);
  const cols = [
    { key: 'event', label: 'Event', primary: true, render: (t) => <div className="stack"><strong>{t.event}</strong><small>{t.to}</small></div> },
    { key: 'subject', label: 'Subject', render: (t) => <span className="mono">{t.subject}</span> },
    { key: 'edit', label: '', render: (t) => <button type="button" className="btn btn-ghost btn-sm" aria-label={`Edit template: ${t.event}`} onClick={() => setEditing(t)}><Pencil size={14} aria-hidden="true" /> Edit</button> },
  ];
  return (
    <>
      <Card flush><ResponsiveTable columns={cols} rows={settings.templates.map((t) => ({ ...t, id: t.key }))} empty="No templates" /></Card>
      <small className="muted">Templates are filled in and sent by the server. Every send is written to the notification log.</small>
      {editing && <TemplateModal template={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---- Roles and users ----
function RolesTab() {
  const { settings, updateSettings, workers, notify } = useDemo();
  const { user } = useAuth() || {};
  const [users, setUsers] = useState([]);
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => listUsers().then(setUsers), []);
  useEffect(() => { let live = true; listUsers().then((u) => { if (live) setUsers(u); }); return () => { live = false; }; }, []);

  const add = (e) => {
    e.preventDefault();
    const r = addPrimaryRole(settings.primaryRoles, newRole);
    if (r.error) return setError(r.error);
    setError(''); setNewRole('');
    return updateSettings({ primaryRoles: r.list });
  };
  const remove = (role) => updateSettings({ primaryRoles: settings.primaryRoles.filter((x) => x !== role) });
  const change = async (u, roleId) => { await setUserRole(u.id, roleId); await refresh(); notify(`${u.name} is now ${ROLES[roleId].label}. It applies the next time they sign in.`); };

  const userCols = [
    { key: 'name', label: 'User', primary: true, render: (u) => <div className="stack"><strong>{u.name}</strong><small>{u.email}</small></div> },
    { key: 'role', label: 'Role', render: (u) => (
      <select aria-label={`Role for ${u.name}`} value={u.roleId} disabled={user?.id === u.id} title={user?.id === u.id ? 'You cannot change your own role' : ''} onChange={(e) => change(u, e.target.value)}>
        {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
      </select>) },
  ];
  const sections = NAV.map((n) => ({ path: n.path, label: n.path === '/' ? 'Dashboard' : n.label }));

  return (
    <>
      <Card title="Primary roles">
        <div className="tags tags-lg">
          {settings.primaryRoles.map((r) => {
            const can = canRemovePrimaryRole(r, workers);
            return (
              <span key={r} className="ad-role">{r}
                <button type="button" className="icon-btn" aria-label={`Remove ${r}`} disabled={!can.ok} title={can.reason} onClick={() => remove(r)}><X size={14} aria-hidden="true" /></button>
              </span>
            );
          })}
        </div>
        <form className="ad-add" onSubmit={add} noValidate>
          <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="New primary role" aria-label="New primary role" />
          <button type="submit" className="btn btn-ghost btn-sm"><Plus size={14} aria-hidden="true" /> Add</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
      </Card>
      <Card title="Users and roles" flush><ResponsiveTable columns={userCols} rows={users} empty="No accounts yet" /></Card>
      <Card title="What each role can open">
        <div className="ad-matrix">
          <table className="rtable">
            <thead><tr><th>Role</th>{sections.map((s) => <th key={s.path}>{s.label}</th>)}</tr></thead>
            <tbody>
              {Object.entries(ROLES).map(([id, r]) => (
                <tr key={id}><th scope="row">{r.label}</th>{sections.map((s) => <td key={s.path} aria-label={`${r.label}, ${s.label}`}>{(ACCESS[id] || []).includes(s.path) ? 'Yes' : '-'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <small className="muted">This table is a proposal. Confirm which screens each role sees with the client (FSD question 10).</small>
      </Card>
    </>
  );
}

// ---- Import and export (admin only) ----
const DATASETS = {
  jobs: { label: 'Jobs', pick: (s) => s.allJobs, cols: [['Job', 'id'], ['Name', 'name'], ['Client', 'client'], ['Stage', 'stage'], ['PM', 'pm'], ['Fab manager', 'fabManager'], ['Booked hours', 'booked'], ['Quoted hours', 'quoted'], ['Expected finish', 'finish']] },
  tasks: { label: 'Tasks', pick: (s) => s.tasks, cols: [['Task', 'id'], ['Kind', 'kind'], ['Name', 'name'], ['Job', 'jobId'], ['Stage', 'stage'], ['Date', 'date'], ['Team leader', 'leader'], ['Quoted hours', 'quoted'], ['Booked hours', 'booked']] },
  issues: { label: 'Issues', pick: (s) => s.issues, cols: [['Issue', 'id'], ['Subject', 'subject'], ['Department', 'department'], ['Priority', 'priority'], ['Status', 'status'], ['Reported by', 'reportedBy'], ['Assigned to', 'assignedTo'], ['Due', 'dueDate']] },
  workers: { label: 'Workers', pick: (s) => s.workers, cols: [['Worker', 'id'], ['Name', 'name'], ['Type', 'type'], ['Primary role', 'primaryRole'], ['Active', 'active']] },
};

function DataTab() {
  const ctx = useDemo();
  const { settings, updateSettings, notify } = ctx;
  const [set, setSet] = useState('jobs');
  const [msg, setMsg] = useState('');
  const file = useRef(null);

  const exportCsv = () => {
    const ds = DATASETS[set];
    const csv = toCsv(ds.cols.map(([label, key]) => ({ label, get: (r) => r[key] })), ds.pick(ctx));
    download(`${set}-${toKey(today())}.csv`, csv, 'text/csv', notify);
  };
  const onImport = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const res = parseSettingsImport(await f.text(), settings);
    if (res.error) return setMsg(res.error);
    updateSettings(res.patch);
    setMsg('');
    return notify(`Imported ${res.count} setting${res.count > 1 ? 's' : ''}`);
  };

  return (
    <>
      <Card title="Export data">
        <div className="ad-add">
          <select aria-label="Data to export" value={set} onChange={(e) => setSet(e.target.value)}>{Object.entries(DATASETS).map(([id, d]) => <option key={id} value={id}>{d.label}</option>)}</select>
          <button type="button" className="btn btn-ghost btn-sm" onClick={exportCsv}><Download size={14} aria-hidden="true" /> Download CSV</button>
        </div>
        <small className="muted">Only an Admin can export. Export, import and custom reports are separate permissions in the Catalyst build.</small>
      </Card>
      <Card title="Settings backup">
        <div className="ad-add">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => download(`ve-settings-${toKey(today())}.json`, exportSettings(settings), 'application/json', notify)}><Download size={14} aria-hidden="true" /> Export settings</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => file.current && file.current.click()}><Upload size={14} aria-hidden="true" /> Import settings</button>
          <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Import settings file" onChange={onImport} />
        </div>
        {msg && <p className="form-error" role="alert">{msg}</p>}
        <small className="muted">Importing replaces only the settings found in the file. Importing jobs, tasks and workers is part of the data migration and needs the backend.</small>
      </Card>
    </>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('general');
  const body = useMemo(() => ({ general: <GeneralTab />, notify: <NotifyTab />, templates: <TemplatesTab />, roles: <RolesTab />, data: <DataTab /> }[tab]), [tab]);
  return (
    <div className="dash">
      <PageHeader eyebrow="Admin" title="Administration" subtitle="Settings, notifications, mail templates, roles and data. Other screens read these settings." />
      <div className="tabs" role="tablist" aria-label="Admin sections">
        {TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {body}
    </div>
  );
}
