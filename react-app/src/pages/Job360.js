import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, FolderOpen, Lock, Pencil, Plus } from 'lucide-react';
import ApprovalPanel from '../components/ApprovalPanel';
import JobSitePanel from '../components/JobSitePanel';
import { Card, Chip, Modal, ResponsiveTable } from '../components/ui';
import PlaceholderPage from './PlaceholderPage';
import { useDemo } from '../context/DemoContext';
import { formatShort, toKey, today } from '../lib/dates';
import { KPI_GROUPS, canCloseJob, isClosedJob, jobStats } from '../lib/jobs';
import './Job360.css';

const TABS = [{ id: 'design', label: 'Design' }, { id: 'fab', label: 'Fab' }, { id: 'install', label: 'Install' }];

function Ring({ value }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 88 88" role="img" aria-label={`${value}% complete`}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 44 44)" />
      <text x="44" y="50" textAnchor="middle" className="ring-text">{value}%</text>
    </svg>
  );
}

export default function Job360() {
  const { jobId } = useParams();
  const { allJobs: jobs, tasks, notify, roleId, closeJob, updateJob, addTask, addInstallTask, addDesignTask, workers } = useDemo();
  const [tab, setTab] = useState('design');
  const [selectedId, setSelectedId] = useState(null);
  const [closing, setClosing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState('');

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return <PlaceholderPage title="Job not found" blurb="That job does not exist in the demo data." />;

  const jobTasks = tasks.filter((t) => t.jobId === job.id);
  const stats = jobStats(jobTasks, toKey(today()));
  const closeCheck = canCloseJob(job, roleId);
  const closed = isClosedJob(job);
  const inReview = jobTasks.filter((t) => t.stage === 'Manager Review').length;
  const tabTasks = jobTasks.filter((t) => t.kind === tab);
  const selected = tabTasks.find((t) => t.id === selectedId) || tabTasks[0];
  const canSeeProfit = roleId === 'admin';
  const canCreateTasks = ['admin','pm','fabManager'].includes(roleId);
  const people = (t) => t.owner || [t.leader, t.member].filter(Boolean).join(', ') || '-';

  const columns = [
    { key: 'name', label: 'Task', primary: true, render: (t) => (
      <button type="button" className={`task-pick ${selected && selected.id === t.id ? 'on' : ''}`} onClick={() => setSelectedId(t.id)}>
        <strong>{t.name}</strong><small>{t.type || t.kind}</small>
      </button>) },
    { key: 'date', label: tab === 'design' ? 'Due' : 'Date', render: (t) => formatShort(t.date) },
    { key: 'people', label: 'People', render: people },
    { key: 'stage', label: 'Stage', render: (t) => <Chip value={t.stage} /> },
    { key: 'hours', label: 'Quoted / proposed / booked', render: (t) => `${t.quoted || 0}h / ${t.proposed || 0}h / ${t.booked || 0}h` },
    { key: 'cost', label: 'Labour cost', render: (t) => { const person = workers.find(w => w.name === (t.owner || t.leader) || w.name.startsWith(String(t.owner || t.leader || '').split(' ')[0] + ' ')); const rate = Number(person?.hourlyRate || person?.hourly_rate || t.hourlyRate || 0); return rate ? `$${((t.booked || 0) * rate).toFixed(2)}` : 'Rate not set'; } },
    ...(roleId === 'admin' ? [{ key: 'rate', label: 'Hourly rate', render: (t) => { const person = workers.find(w => w.name === (t.owner || t.leader) || w.name.startsWith(String(t.owner || t.leader || '').split(' ')[0] + ' ')); const rate = person?.hourlyRate || person?.hourly_rate || t.hourlyRate; return rate ? `$${Number(rate).toFixed(2)}/h` : 'Not set'; } }] : []),
  ];

  return (
    <div className="dash">
      <Link to="/jobs" className="back-link"><ArrowLeft size={16} aria-hidden="true" /> All jobs</Link>

      <section className="job-head card">
        <Ring value={job.job} />
        <div className="job-head-main">
          <p className="eyebrow">{job.id} · {job.client}</p>
          <h1>{job.name}</h1>
          <div className="job-meta">
            <Chip value={job.stage} />
            <span>Expected finish <strong>{formatShort(job.finish)}</strong></span>
            <span className="mono"><FolderOpen size={14} aria-hidden="true" /> {`\\\\VE-SERVER\\Jobs\\${job.id}`}</span>
          </div>
          <div className="job-meta">
            <span>Fab finish required <strong>{job.fabRequired ? formatShort(job.fabRequired) : '-'}</strong></span>
            <span>Fab finish agreed <strong>{job.fabAgreed ? formatShort(job.fabAgreed) : 'not agreed yet'}</strong></span>
            {job.pm && <span>PM <strong>{job.pm}</strong></span>}
            {job.fabManager && <span>Fab manager <strong>{job.fabManager}</strong></span>}
          </div>
          {job.risk && <p className="risk">{job.risk}</p>}
        </div>
        <div className="job-head-actions">
          {(roleId === 'admin' || roleId === 'pm') && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit job</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the Zoho CRM deal (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to deal</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notify('Opens the WorkDrive folder (demo)')}><ExternalLink size={14} aria-hidden="true" /> Go to WorkDrive</button>
          {closed
            ? <span className="closed-note"><Lock size={14} aria-hidden="true" /> Closed {job.closedAt ? formatShort(job.closedAt) : ''}{job.closedBy ? ` by ${job.closedBy}` : ''}</span>
            : <button type="button" className="btn btn-primary btn-sm" disabled={!closeCheck.ok} title={closeCheck.ok ? '' : closeCheck.reason} onClick={() => setClosing(true)}>Close job</button>}
        </div>
      </section>

      <section className="job-kpis" aria-label="Job KPIs">
        {KPI_GROUPS.map((g) => {
          const k = stats[g.kind];
          return (
            <div key={g.kind} className="job-kpi card">
              <h2>{g.label}</h2>
              <dl>
                <div><dt>Total</dt><dd>{k.total}</dd></div>
                <div><dt>Open</dt><dd>{k.open}</dd></div>
                <div><dt>Overdue</dt><dd className={k.overdue > 0 ? 'over' : ''}>{k.overdue}</dd></div>
                <div><dt>Complete</dt><dd>{k.pct}%</dd></div>
              </dl>
            </div>
          );
        })}
      </section>

      {canSeeProfit && <section className="card"><div className="card-head"><h2>Profitability (Admin only)</h2></div><div className="card-body job-meta"><span>Revenue <strong>${Number(job.revenue || 0).toLocaleString()}</strong></span><span>Purchases <strong>${Number(job.purchases || 0).toLocaleString()}</strong></span><span>Profit <strong>${Number(job.profit || 0).toLocaleString()}</strong></span><span>Profit % <strong>{job.revenue ? Math.round((job.profit || 0) / job.revenue * 100) : 0}%</strong></span></div></section>}
      <JobSitePanel jobId={job.id} />

      {canCreateTasks && <div className="job-task-actions" aria-label="Create task in this job">{[['design','Add Design Task'],['fab','Add Fabrication Task'],['install','Add Install Task'],['minor','Add Minor Install Task']].map(([id,label]) => <button key={id} type="button" className="btn btn-primary btn-sm" disabled={closed} onClick={() => setCreating(id)}><Plus size={14}/> {label}</button>)}</div>}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''}
            onClick={() => { setTab(t.id); setSelectedId(null); }}>
            {t.label} <span>{jobTasks.filter((x) => x.kind === t.id).length}</span>
          </button>
        ))}
      </div>

      <div className="split">
        <Card flush><ResponsiveTable columns={columns} rows={tabTasks} empty={`No ${tab} tasks for this job yet`} /></Card>
        <Card title="Approval">{selected ? <><ApprovalPanel key={selected.id} task={selected} />{selected.kind==='fab' && selected.spec && <div className="task-spec"><h3>{selected.type} specification</h3><pre>{JSON.stringify(selected.spec, null, 2)}</pre></div>}</> : <p className="muted">Select a task to see its progress and actions.</p>}</Card>
      </div>
      {editing && <Modal title="Edit job details" onClose={() => setEditing(false)}><JobEditForm job={job} roleId={roleId} onSave={(patch) => { updateJob(job.id, patch); setEditing(false); }} onCancel={() => setEditing(false)} /></Modal>}
      {creating && <JobTaskForm kind={creating} job={job} onClose={() => setCreating('')} create={{ addTask, addInstallTask, addDesignTask }} />}
      {closing && (
        <Modal title="Close this job?" onClose={() => setClosing(false)}>
          <div className="form">
            <p>{job.name} is {job.job}% complete. Closing sets the stage to Completed - Closed, sends the closure report email once and updates the CRM deal (demo). No more tasks can be added after that.</p>
            {inReview > 0 && <p className="form-error">{inReview} task{inReview > 1 ? 's are' : ' is'} still in Manager Review. Closing now will not wait for approval.</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setClosing(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => { closeJob(job.id); setClosing(false); }}>Close job</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function JobEditForm({ job, roleId, onSave, onCancel }) {
 const [f,setF]=useState({name:job.name||'',finish:job.finish||'',stage:job.stage||'',serverPath:job.serverPath||`\\VE-SERVER\\Jobs\\${job.id}`,dealId:job.dealId||'',createdAt:job.createdAt||new Date().toISOString().slice(0,10)}); const set=k=>e=>setF(x=>({...x,[k]:e.target.value})); const [err,setErr]=useState('');
 return <form className="form" onSubmit={e=>{e.preventDefault();if(!f.name.trim()||!f.finish||!f.stage||!f.serverPath.trim())return setErr('Please fill the mandatory fields');onSave({...f,name:f.name.trim()});}}><label>Job subject *<input value={f.name} onChange={set('name')} disabled={roleId!=='admin'} /></label><div className="form-row"><label>Expected job finish *<input type="date" value={f.finish} onChange={set('finish')}/></label><label>Stage *<select value={f.stage} onChange={set('stage')}>{['Preparation','In Progress','On Hold','Completed','Completed - Closed','Cancelled'].map(x=><option key={x}>{x}</option>)}</select></label></div><label>File location on VE server *<input value={f.serverPath} onChange={set('serverPath')}/></label>{roleId==='admin'&&<div className="form-row"><label>CRM Deal link / ID<input value={f.dealId} onChange={set('dealId')}/></label><label>Job created date<input type="date" value={f.createdAt} onChange={set('createdAt')}/></label></div>}<small>Completion, hours and cost rollups are read-only.</small>{err&&<p className="form-error">{err}</p>}<div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button><button className="btn btn-primary">Save changes</button></div></form>
}
function JobTaskForm({kind,job,onClose,create}) { const [f,setF]=useState({name:'',date:'',type:kind==='fab'?'CCV':kind==='install'?'VE Install':kind==='minor'?'Minor Task':'Artwork Sign Off',quoted:'',proposed:'',width:'',height:'',qty:'',vinyl:'',material:'',thickness:'',returnHeight:'',description:''});const [err,setErr]=useState('');const set=k=>e=>setF(x=>({...x,[k]:e.target.value}));const title={design:'Design',fab:'Fabrication',install:'Install',minor:'Minor Install'}[kind];return <Modal title={`Add ${title} task to ${job.id}`} onClose={onClose}><form className="form" onSubmit={e=>{e.preventDefault();if(!f.name.trim()||!f.date)return setErr('Please fill the mandatory fields');const common={name:f.name.trim(),jobId:job.id,date:f.date,quoted:Number(f.quoted)||0,proposed:Number(f.proposed)||0};let ok;if(kind==='design')ok=create.addDesignTask({...common,type:f.type,due:f.date,description:f.description});else if(kind==='fab')ok=create.addTask({...common,type:f.type,spec:{ccv:{width:Number(f.width)||0,height:Number(f.height)||0,qty:Number(f.qty)||0,vinyl:f.vinyl},cnc:{material:f.material,thickness:Number(f.thickness)||0},clb:{material:f.material,return_height:Number(f.returnHeight)||0}}});else ok=create.addInstallTask({...common,type:kind==='minor'?'Minor Task':f.type});if(ok!==false)onClose();}}><label>Task name *<input autoFocus value={f.name} onChange={set('name')}/></label><div className="form-row"><label>Required / scheduled date *<input type="date" value={f.date} onChange={set('date')}/></label>{kind!=='minor'&&<label>{kind==='fab'?'Fab type':kind==='install'?'Install type':'Design type'}<select value={f.type} onChange={set('type')}>{(kind==='fab'?['CCV','CNC Laser','CNC Router','CLB','General','Metal','Paint','LED','Pack','Workshop','Maintenance']:kind==='install'?['VE Install','VE Subtask','Minor Task','External Install','Print Only']:['Artwork Sign Off','Install Plan','LED Design','Manufacturing Sign Off','Proof Of Posting','Project Management']).map(x=><option key={x}>{x}</option>)}</select></label>}</div><div className="form-row"><label>Quoted hours<input type="number" min="0" step="0.5" value={f.quoted} onChange={set('quoted')}/></label><label>Proposed hours<input type="number" min="0" step="0.5" value={f.proposed} onChange={set('proposed')}/></label></div>{kind==='fab'&&(['CCV'].includes(f.type)?<fieldset><legend>CCV specification</legend><div className="form-row"><label>Width<input type="number" value={f.width} onChange={set('width')}/></label><label>Height<input type="number" value={f.height} onChange={set('height')}/></label><label>Quantity<input type="number" value={f.qty} onChange={set('qty')}/></label></div><label>Vinyl brand / colour<input value={f.vinyl} onChange={set('vinyl')}/></label></fieldset>:['CNC Laser','CNC Router'].includes(f.type)?<fieldset><legend>CNC specification</legend><label>Material<input value={f.material} onChange={set('material')}/></label><label>Thickness<input type="number" value={f.thickness} onChange={set('thickness')}/></label></fieldset>:f.type==='CLB'?<fieldset><legend>CLB specification</legend><label>Material<input value={f.material} onChange={set('material')}/></label><label>Return height<input type="number" value={f.returnHeight} onChange={set('returnHeight')}/></label></fieldset>:null)}{kind==='design'&&<label>Description<textarea value={f.description} onChange={set('description')}/></label>}{err&&<p className="form-error">{err}</p>}<small>Tasks can only be created from their parent job. Closed jobs cannot accept new tasks.</small><div className="form-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary">Create task</button></div></form></Modal> }
