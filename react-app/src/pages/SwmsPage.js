import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSignature, Printer, ShieldCheck, Users } from 'lucide-react';
import SignSwmsDialog from '../components/SignSwmsDialog';
import { Card, Chip, KpiCard, Modal, PageHeader, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { fmtStamp, formatShort } from '../lib/dates';
import { HAZARD_LABEL, HIGH_RISK, PPE_LIST, PPE_RULES, TASK_TEMPLATES, ppeFor } from '../lib/swmsRules';
import './SwmsPage.css';

const FILTERS = [
  ['all', 'All', () => true],
  ['pm', 'Awaiting PM', (s) => s.status === 'Created'],
  ['tl', 'Awaiting team leader', (s) => s.status === 'PM Signed'],
  ['signed', 'Fully signed', (s) => ['TL Signed', 'Completed', 'Closed'].includes(s.status)],
];

export function SwmsList() {
  const { swms, jobs } = useDemo();
  const [filter, setFilter] = useState('all');
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const rows = swms.filter(FILTERS.find((f) => f[0] === filter)[2]);
  const count = (id) => swms.filter(FILTERS.find((f) => f[0] === id)[2]).length;

  const columns = [
    { key: 'title', label: 'SWMS', primary: true, render: (s) => (
      <div className="stack"><Link className="job-link" to={`/swms/${s.id}`}>{s.title}</Link><small>{s.id} · {s.jobId} · {jobName(s.jobId)}</small></div>) },
    { key: 'onSite', label: 'On site', render: (s) => formatShort(s.onSite) },
    { key: 'hazards', label: 'High-risk work', render: (s) => (s.hazards.length
      ? <span className="tags">{s.hazards.slice(0, 3).map((h) => <em key={h}>{h}</em>)}{s.hazards.length > 3 && <em>+{s.hazards.length - 3}</em>}</span> : '-') },
    { key: 'status', label: 'Status', render: (s) => <Chip value={s.status} /> },
    { key: 'pm', label: 'PM signed', render: (s) => (s.pmSignature ? `${s.pmSignature.name}, ${formatShort(s.pmSignature.signedAt.slice(0, 10))}` : '-') },
    { key: 'tl', label: 'Team leader', render: (s) => (s.tlSignature ? s.tlSignature.name : '-') },
    { key: 'open', label: '', render: (s) => <Link className="btn btn-ghost btn-sm" to={`/swms/${s.id}`}>Open</Link> },
  ];

  return (
    <div className="dash">
      <PageHeader eyebrow="Safety" title="SWMS" subtitle="Safe Work Method Statements. One per install task, signed by the PM and then the team leader before crews go on site." />
      <div className="kpis">
        <KpiCard icon={FileSignature} label="All SWMS" value={swms.length} note="across open jobs" />
        <KpiCard icon={ShieldCheck} label="Awaiting PM" value={count('pm')} tone="danger" note="created, not yet signed" />
        <KpiCard icon={Users} label="Awaiting team leader" value={count('tl')} tone="warn" note="sign at the job briefing" />
        <KpiCard icon={CheckCircle2} label="Fully signed" value={count('signed')} note="ready for the crew" />
      </div>
      <div className="filters">
        <div className="segmented" role="tablist" aria-label="SWMS filter">
          {FILTERS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label} ({count(id)})</button>)}
        </div>
      </div>
      <Card flush><ResponsiveTable columns={columns} rows={rows} empty="No SWMS in this view" /></Card>
    </div>
  );
}

function TeamLeaderDialog({ record, leaderName, onClose, onSigned }) {
  const [name, setName] = useState(leaderName);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !agree) return setError('Type your full name and tick the acceptance to sign.');
    return onSigned({ name: name.trim(), role: 'Team Leader' });
  };
  return (
    <Modal title={`Sign ${record.id} as team leader`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I have briefed the crew on this SWMS and accept responsibility for compliance on site.</span></label>
        <label>Type your full name to sign<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Sign as team leader</button>
        </div>
      </form>
    </Modal>
  );
}

function CrewDialog({ record, defaultName, onClose, onSigned }) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError('Type your full name to sign.');
    return onSigned(name.trim());
  };
  return (
    <Modal title={`Crew declaration for ${record.id}`} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <p className="muted">I have read this SWMS, understand it and will follow it on site.</p>
        <label>Type your full name to sign<input autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">Sign</button>
        </div>
      </form>
    </Modal>
  );
}

export function SwmsDetail() {
  const { swmsId } = useParams();
  const { swms, jobs, tasks, role, roleId, signSwms, signSwmsTL, updateSwms, addCrewSignature } = useDemo();
  const rec = swms.find((s) => s.id === swmsId);
  const [dialog, setDialog] = useState(null);
  const [draft, setDraft] = useState(null);

  if (!rec) return <PlaceholderPage title="SWMS not found" blurb="That SWMS does not exist in the demo data." />;

  const job = jobs.find((j) => j.id === rec.jobId);
  const task = tasks.find((t) => t.kind === 'install' && t.jobId === rec.jobId && t.name === rec.title)
    || tasks.find((t) => t.kind === 'install' && t.jobId === rec.jobId);
  const hazards = rec.hazards;
  const ppe = rec.ppe || ppeFor(hazards);
  const controls = rec.controls || [];
  const crew = rec.crew || [];
  const isPm = roleId === 'pm';
  const canEdit = isPm && rec.status === 'Created';
  const canSignPm = isPm && rec.status === 'Created';
  const canSignTl = roleId === 'installer' && rec.status === 'PM Signed';
  const canCrewSign = rec.status === 'TL Signed' && roleId !== 'pm';

  const startEdit = () => setDraft({ hazards: [...hazards], ppe: [...ppe], controls: controls.map((c) => ({ ...c })) });
  const toggleHazard = (h) => setDraft((d) => {
    const on = d.hazards.includes(h);
    // Same as Creator: ticking a hazard ticks its PPE. Unticking leaves PPE as it is.
    const addPpe = on ? [] : (PPE_RULES[h] || []);
    return { ...d, hazards: on ? d.hazards.filter((x) => x !== h) : [...d.hazards, h], ppe: [...new Set([...d.ppe, ...addPpe])] };
  });
  const togglePpe = (p) => setDraft((d) => ({ ...d, ppe: d.ppe.includes(p) ? d.ppe.filter((x) => x !== p) : [...d.ppe, p] }));
  const setControl = (i, k, v) => setDraft((d) => ({ ...d, controls: d.controls.map((c, n) => (n === i ? { ...c, [k]: v } : c)) }));
  const addTemplate = (e) => {
    const t = TASK_TEMPLATES.find((x) => x.task === e.target.value);
    if (t) setDraft((d) => ({ ...d, controls: [...d.controls, { ...t, person: task?.leader || '' }] }));
  };
  const save = () => { updateSwms(rec.id, draft); setDraft(null); };
  const view = draft || { hazards, ppe, controls };

  return (
    <div className="dash">
      <Link to="/swms" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All SWMS</Link>
      <PageHeader eyebrow={`${rec.id} · ${rec.jobId}`} title={rec.title} subtitle={`${job?.name || rec.jobId} · on site ${formatShort(rec.onSite)} · Install task SWMS`}>
        <Chip value={rec.status} />
        <button type="button" className="btn btn-ghost swms-noprint" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Print or save as PDF</button>
      </PageHeader>

      <div className="swms-sheet">
        <section className="sw-sec"><h2>Prepared by (Project Manager)</h2>
          {rec.pmSignature
            ? <div className="sign-box done"><div className="stack"><strong>{rec.pmSignature.name}</strong><small>{rec.pmSignature.role} · signed {fmtStamp(rec.pmSignature.signedAt)}</small></div><Chip value="Signed" tone="green" /></div>
            : <div className="sign-box"><div className="stack"><strong>Not signed yet</strong><small>The PM signs first, then the team leader.</small></div>
              {canSignPm && <button type="button" className="btn btn-primary swms-noprint" onClick={() => setDialog('pm')}>Sign as PM</button>}</div>}
        </section>

        <section className="sw-sec"><h2>Works supervisor (team leader)</h2>
          {rec.tlSignature
            ? <div className="sign-box done"><div className="stack"><strong>{rec.tlSignature.name}</strong><small>Accepted at job briefing · signed {fmtStamp(rec.tlSignature.signedAt)}</small></div><Chip value="Signed" tone="green" /></div>
            : <div className="sign-box"><div className="stack"><strong>{task?.leader || 'Team leader not assigned'}</strong><small>{rec.status === 'Created' ? 'Waiting for the PM to sign.' : 'Signs at the job briefing.'}</small></div>
              {canSignTl && <button type="button" className="btn btn-primary swms-noprint" onClick={() => setDialog('tl')}>Sign as team leader</button>}</div>}
        </section>

        <section className="sw-sec"><h2>High-risk construction work</h2>
          {draft ? (
            <div className="hz-list">{HIGH_RISK.map((h) => (
              <label key={h}><input type="checkbox" checked={view.hazards.includes(h)} onChange={() => toggleHazard(h)} />{HAZARD_LABEL[h]}</label>))}</div>
          ) : (view.hazards.length ? <div className="tags">{view.hazards.map((h) => <em key={h} title={HAZARD_LABEL[h]}>{HAZARD_LABEL[h] || h}</em>)}</div> : <p className="muted">None selected.</p>)}
        </section>

        <section className="sw-sec"><h2>PPE required</h2>
          {draft ? (
            <div className="hz-list">{PPE_LIST.map((p) => <label key={p}><input type="checkbox" checked={view.ppe.includes(p)} onChange={() => togglePpe(p)} />{p}</label>)}</div>
          ) : (view.ppe.length ? <div className="tags">{view.ppe.map((p) => <em key={p}>{p}</em>)}</div> : <p className="muted">None required.</p>)}
          <small>Ticking Falls, Hot Works, Mobile Plant, Roadways, Dust or Demolition ticks the matching PPE automatically.</small>
        </section>

        <section className="sw-sec"><h2>Job tasks and control measures</h2>
          {view.controls.length === 0 && <p className="muted">No tasks added yet.</p>}
          {view.controls.length > 0 && (
            <table className="tasks-table">
              <thead><tr><th>Task</th><th>Hazards and risks</th><th>Control measures</th><th>Person responsible</th></tr></thead>
              <tbody>{view.controls.map((c, i) => (
                <tr key={i}>
                  {draft ? ['task', 'risk', 'control', 'person'].map((k) => <td key={k}><textarea rows={k === 'control' ? 3 : 2} value={c[k]} onChange={(e) => setControl(i, k, e.target.value)} aria-label={k} /></td>)
                    : <><td>{c.task}</td><td>{c.risk}</td><td>{c.control}</td><td>{c.person || '-'}</td></>}
                </tr>))}</tbody>
            </table>
          )}
          {draft && (
            <label className="form" style={{ padding: '12px 0 0' }}>Add from a task template (sample wording)
              <select value="" onChange={addTemplate}><option value="">Choose a template…</option>{TASK_TEMPLATES.map((t) => <option key={t.task}>{t.task}</option>)}</select></label>)}
        </section>

        {rec.tlSignature && (
          <section className="sw-sec"><h2>Crew declaration</h2>
            <ul className="crew-list">{crew.length === 0 && <li className="muted">No crew have signed yet.</li>}
              {crew.map((c, i) => <li key={i}><strong>{c.name}</strong><small>{fmtStamp(c.signedAt)}</small></li>)}</ul>
            {canCrewSign && <button type="button" className="btn btn-primary swms-noprint" onClick={() => setDialog('crew')}>Sign the declaration</button>}
          </section>)}

        {canEdit && (
          <div className="sw-actions swms-noprint">
            {!draft && <button type="button" className="btn btn-ghost" onClick={startEdit}>Edit hazards, PPE and tasks</button>}
            {draft && <><button type="button" className="btn btn-primary" onClick={save}>Save changes</button><button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Cancel</button></>}
          </div>)}
      </div>

      {dialog === 'pm' && <SignSwmsDialog record={rec} signer={role} onClose={() => setDialog(null)} onSigned={(s) => { signSwms(rec.id, s); setDialog(null); }} />}
      {dialog === 'tl' && <TeamLeaderDialog record={rec} leaderName={role.name} onClose={() => setDialog(null)} onSigned={(s) => { signSwmsTL(rec.id, s); setDialog(null); }} />}
      {dialog === 'crew' && <CrewDialog record={rec} defaultName={role.name} onClose={() => setDialog(null)} onSigned={(n) => { addCrewSignature(rec.id, n); setDialog(null); }} />}
    </div>
  );
}
