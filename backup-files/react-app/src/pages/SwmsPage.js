import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FileSignature, Printer, ShieldCheck, Users } from 'lucide-react';
import SignSwmsDialog from '../components/SignSwmsDialog';
import { Card, Chip, Modal, PageHeader } from '../components/ui';
import KpiLink from '../components/KpiLink';
import { Button } from '../components/ui-kit/button';
import { Card as UiCard } from '../components/ui-kit/card';
import { EmptyState, SavedViews, SearchBox } from '../components/ListKit';
import { cn } from '../lib/utils';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { fmtStamp, formatShort } from '../lib/dates';
import { HAZARD_LABEL, HIGH_RISK, PPE_LIST, PPE_RULES, TASK_TEMPLATES, ppeFor } from '../lib/swmsRules';
import { shortName } from '../lib/people';
import { crewOf } from '../lib/checklists';
import './SwmsPage.css';

const SIGNED = ['TL Signed', 'Completed', 'Closed'];
// SW-4: all, my open and my completed, plus the signing queues. "Mine" means I am the job's PM or on the install crew.
const FILTERS = [
  ['all', 'All', () => true],
  ['myOpen', 'My open', (s, mine) => mine(s) && !SIGNED.includes(s.status) && s.status !== 'Not Required'],
  ['myDone', 'My completed', (s, mine) => mine(s) && SIGNED.includes(s.status)],
  ['pm', 'Awaiting PM', (s) => s.status === 'Created'],
  ['tl', 'Awaiting team leader', (s) => s.status === 'PM Signed'],
  ['signed', 'Fully signed', (s) => ['TL Signed', 'Completed', 'Closed'].includes(s.status)],
];

export function SwmsList() {
  const { swms, jobs, allJobs, tasks, role } = useDemo();
  const [filter, setFilter] = useState('all');
  const jobName = (id) => jobs.find((j) => j.id === id)?.name || id;
  const me = shortName(role.name);
  const mine = (s) => (allJobs || jobs).find((j) => j.id === s.jobId)?.pm === role.name
    || tasks.some((t) => t.kind === 'install' && t.jobId === s.jobId && (t.name === s.title || t.swmsId === s.id) && crewOf(t).includes(me));
  const pick = (id) => (x) => FILTERS.find((f) => f[0] === id)[2](x, mine);
  const rows = swms.filter(pick(filter));
  const count = (id) => swms.filter(pick(id)).length;

  const [q, setQ] = useState('');
  const [signing, setSigning] = useState(null);
  const { roleId, signSwms } = useDemo();
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((s) => !needle || `${s.title} ${s.id} ${s.jobId} ${jobName(s.jobId)}`.toLowerCase().includes(needle));
  // Signing runs PM -> team leader -> crew; the bar shows how far each SWMS has got.
  const stepsDone = (s) => (s.pmSignature ? 1 : 0) + (s.tlSignature ? 1 : 0) + ((s.crew || []).length ? 1 : 0);

  return (
    <div className="dash">
      <PageHeader eyebrow="Safety" title="SWMS" subtitle="Safe Work Method Statements. One per install task, signed by the PM and then the team leader before crews go on site." />
      <div className="kpis">
        <KpiLink icon={FileSignature} label="All SWMS" value={swms.length} note="across open jobs" onClick={() => setFilter('all')} active={filter === 'all'} />
        <KpiLink icon={ShieldCheck} label="Awaiting PM" value={count('pm')} tone="danger" note="created, not yet signed" onClick={() => setFilter('pm')} active={filter === 'pm'} />
        <KpiLink icon={Users} label="Awaiting team leader" value={count('tl')} tone="warn" note="sign at the job briefing" onClick={() => setFilter('tl')} active={filter === 'tl'} />
        <KpiLink icon={CheckCircle2} label="Fully signed" value={count('signed')} note="ready for the crew" onClick={() => setFilter('signed')} active={filter === 'signed'} />
      </div>
      <Card flush className="ui-scope overflow-hidden font-sans">
        <div className="flex flex-wrap items-center gap-2 border-b p-3 sm:p-4">
          <SavedViews label="SWMS filter" value={filter} onChange={setFilter} views={FILTERS.map(([id, label]) => ({ id, label, count: count(id) }))} />
          <SearchBox value={q} onChange={setQ} placeholder="Search SWMS, task or job" />
        </div>
        {shown.length === 0 && <EmptyState>No SWMS in this view</EmptyState>}
        <ul className="m-0 list-none p-0">
          {shown.map((s) => (
            <li key={s.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-2 border-b px-4 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_7rem_11rem_auto] sm:px-5">
              <div className="min-w-0">
                <Link className="font-semibold text-foreground no-underline hover:underline" to={`/swms/${s.id}`}>{s.title}</Link>
                <div className="text-xs text-muted-foreground">{s.id} · {s.jobId} · {jobName(s.jobId)}{s.hazards.length ? ` · ${s.hazards.slice(0, 3).join(', ')}${s.hazards.length > 3 ? ` +${s.hazards.length - 3}` : ''}` : ''}</div>
              </div>
              <span className="text-sm text-muted-foreground">On site {formatShort(s.onSite)}</span>
              <div aria-label={`Signed: PM ${s.pmSignature ? 'yes' : 'no'}, team leader ${s.tlSignature ? 'yes' : 'no'}, crew ${(s.crew || []).length}`}>
                <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < stepsDone(s) ? 'bg-brand' : 'bg-track')} />)}</div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground"><span>PM · Team leader · Crew</span><Chip value={s.status} /></div>
              </div>
              <div className="flex gap-2 sm:justify-end">
                {roleId === 'pm' && s.status === 'Created'
                  ? <Button size="sm" onClick={() => setSigning(s)}><FileSignature /> Sign as PM</Button>
                  : <Button asChild size="sm" variant="outline"><Link to={`/swms/${s.id}`} className="no-underline">Open</Link></Button>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {signing && <SignSwmsDialog record={signing} signer={role} onClose={() => setSigning(null)} onSigned={(sg) => { signSwms(signing.id, sg); setSigning(null); }} />}
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

// The three signatures as clear steps, with the one button the signed-in person can press.
function SigningSteps({ rec, task, actions }) {
  const steps = [
    { key: 'pm', title: 'PM signs', who: rec.pmSignature ? `${rec.pmSignature.name}, ${fmtStamp(rec.pmSignature.signedAt)}` : 'Project Manager', done: Boolean(rec.pmSignature), label: 'Sign as PM' },
    { key: 'tl', title: 'Team leader signs at the briefing', who: rec.tlSignature ? `${rec.tlSignature.name}, ${fmtStamp(rec.tlSignature.signedAt)}` : task?.leader || 'Team leader', done: Boolean(rec.tlSignature), label: 'Sign as team leader' },
    { key: 'crew', title: 'Crew sign the declaration', who: `${(rec.crew || []).length} signed`, done: (rec.crew || []).length > 0, label: 'Sign the declaration' },
  ];
  const current = steps.findIndex((x) => !x.done);
  return (
    <UiCard className="ui-scope swms-noprint overflow-hidden font-sans" role="region" aria-label="Signing steps">
      <ol className="m-0 grid list-none gap-0 p-0 sm:grid-cols-3">
        {steps.map((x, i) => (
          <li key={x.key} className={cn('flex items-start gap-3 border-b p-4 last:border-0 sm:border-b-0 sm:border-r sm:last:border-r-0', i === current && 'bg-accent/50')}>
            <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold', x.done ? 'border-primary bg-primary text-primary-foreground' : i === current ? 'border-primary text-primary' : 'border-input text-muted-foreground')}>{x.done ? '✓' : i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{x.title}</div>
              <div className="text-xs text-muted-foreground">{x.who}</div>
              {i === current && actions[x.key] && <Button size="sm" className="mt-2" onClick={actions[x.key]}>{x.label}</Button>}
              {i === current && !actions[x.key] && <div className="mt-1 text-xs font-semibold text-muted-foreground">Waiting for this step</div>}
            </div>
          </li>
        ))}
      </ol>
    </UiCard>
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

      <SigningSteps rec={rec} task={task} actions={{ pm: canSignPm && (() => setDialog('pm')), tl: canSignTl && (() => setDialog('tl')), crew: canCrewSign && (() => setDialog('crew')) }} />

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
