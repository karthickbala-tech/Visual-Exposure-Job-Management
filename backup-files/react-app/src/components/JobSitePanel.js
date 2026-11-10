import { useState } from 'react';
import { ExternalLink, MapPin, Pencil, Plus } from 'lucide-react';
import { Card, Chip, Modal, ResponsiveTable } from './ui';
import { seedSigns, seedSites } from '../data/jobSitesSeed';
import { STAGE_TONE, addressLine, locationsForJob, mapsUrl, signGroups, signSummary } from '../lib/jobSites';

export const SIGN_STAGES = {
  deal: ['Quoted', 'Won'],
  artwork: ['Not started', 'In design', 'Approved'],
  manufacturing: ['Not started', 'In fabrication', 'Complete'],
  install: ['Not started', 'Scheduled', 'Installed'],
};

// JOB-3: one sign. Saving updates the CRM Assets module in the Catalyst build.
export function SignModal({ sign, jobId, places, groups, onSave, onClose }) {
  const [f, setF] = useState({
    name: sign?.name || '', group: sign?.group || groups[0] || '', newGroup: '', siteId: sign?.siteId || places[0]?.site.id || '',
    rev: sign?.rev || 'A', qty: String(sign?.qty ?? 1), medium: sign?.medium || '', finishing: sign?.finishing || '',
    deal: sign?.deal || 'Won', artwork: sign?.artwork || 'Not started', manufacturing: sign?.manufacturing || 'Not started', install: sign?.install || 'Not started',
  });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    const group = f.group === '__new' ? f.newGroup.trim() : f.group;
    const qty = Number(f.qty);
    if (!f.name.trim() || !group || !f.siteId) return setError('Please fill the mandatory fields');
    if (!Number.isInteger(qty) || qty < 1) return setError('Quantity must be a whole number of 1 or more.');
    const { newGroup, ...rest } = f; // eslint-disable-line no-unused-vars
    onSave({ ...rest, name: f.name.trim(), group, qty, jobId });
    return onClose();
  };
  return (
    <Modal title={sign ? `Edit sign: ${sign.name}` : 'Add a sign'} onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <label>Sign name *<input autoFocus value={f.name} onChange={set('name')} /></label>
        <div className="form-row">
          <label>Sign group *<select value={f.group} onChange={set('group')}>{groups.map((g) => <option key={g}>{g}</option>)}<option value="__new">New group…</option></select></label>
          {f.group === '__new'
            ? <label>New group name *<input value={f.newGroup} onChange={set('newGroup')} /></label>
            : <label>Site *<select value={f.siteId} onChange={set('siteId')}>{places.map(({ site }) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
        </div>
        {f.group === '__new' && <label>Site *<select value={f.siteId} onChange={set('siteId')}>{places.map(({ site }) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>}
        <div className="form-row">
          <label>Revision<input value={f.rev} onChange={set('rev')} maxLength={4} /></label>
          <label>Quantity *<input type="number" min="1" step="1" value={f.qty} onChange={set('qty')} /></label>
        </div>
        <div className="form-row">
          <label>Medium<input value={f.medium} onChange={set('medium')} /></label>
          <label>Finishing<input value={f.finishing} onChange={set('finishing')} /></label>
        </div>
        <div className="form-row">
          {Object.entries(SIGN_STAGES).map(([k, opts]) => (
            <label key={k}>{{ deal: 'Deal', artwork: 'Artwork', manufacturing: 'Manufacturing', install: 'Install' }[k]}
              <select value={f[k]} onChange={set(k)}>{opts.map((o) => <option key={o}>{o}</option>)}</select>
            </label>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{sign ? 'Save sign' : 'Add sign'}</button>
        </div>
      </form>
    </Modal>
  );
}

// JOB-3: embedded location, sign groups and signs on Job Details. Managers can add and edit signs.
export default function JobSitePanel({ jobId, sites = seedSites, signs = seedSigns, canEdit = false, onAdd, onUpdate }) {
  const [editing, setEditing] = useState(null);
  const places = locationsForJob(jobId, sites, signs);
  const allSigns = places.flatMap((p) => p.signs);
  const sum = signSummary(allSigns);
  const groups = signGroups(allSigns);
  const siteName = (id) => sites.find((s) => s.id === id)?.name || '-';
  const stage = (v) => <Chip value={v} tone={STAGE_TONE[v] || 'gray'} />;
  const editable = canEdit && onAdd && onUpdate;

  const columns = [
    { key: 'name', label: 'Sign', primary: true, render: (g) => <div className="stack"><strong>{g.name}</strong><small>Rev {g.rev} · {g.group}</small></div> },
    ...(places.length > 1 ? [{ key: 'site', label: 'Site', render: (g) => siteName(g.siteId) }] : []),
    { key: 'qty', label: 'Qty', render: (g) => g.qty },
    { key: 'medium', label: 'Medium and finish', render: (g) => <div className="stack"><span>{g.medium || '-'}</span><small>{g.finishing}</small></div> },
    { key: 'deal', label: 'Deal', render: (g) => stage(g.deal) },
    { key: 'artwork', label: 'Artwork', render: (g) => stage(g.artwork) },
    { key: 'manufacturing', label: 'Manufacturing', render: (g) => stage(g.manufacturing) },
    { key: 'install', label: 'Install', render: (g) => stage(g.install) },
    ...(editable ? [{ key: 'edit', label: '', render: (g) => <button type="button" className="btn btn-ghost btn-sm" aria-label={`Edit ${g.name}`} onClick={() => setEditing(g)}><Pencil size={14} aria-hidden="true" /> Edit</button> }] : []),
  ];

  if (places.length === 0) {
    return (
      <section className="job-site" aria-label="Location and signs">
        <Card title="Location and signs"><p className="muted">No site is linked to this job yet. Sites come from the CRM deal; add one there and it appears here.</p></Card>
      </section>
    );
  }

  return (
    <section className="job-site" aria-label="Location and signs">
      <Card title={places.length > 1 ? `Locations (${places.length})` : 'Location'} className="job-site-loc">
        <ul className="site-list">
          {places.map(({ site }) => (
            <li key={site.id}>
              <MapPin size={16} aria-hidden="true" />
              <div>
                <strong>{site.name}</strong>
                <span>{addressLine(site)}</span>
                <a className="site-map" href={mapsUrl(site)} target="_blank" rel="noopener noreferrer">Open in maps <ExternalLink size={12} aria-hidden="true" /></a>
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={`Signs (${sum.signs})`} flush className="job-site-signs"
        action={(
          <span className="sign-head-actions">
            <span className="muted">{sum.pieces} pieces · {sum.installed} of {sum.signs} installed</span>
            {editable && <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}><Plus size={14} aria-hidden="true" /> Add sign</button>}
          </span>
        )}>
        {groups.length > 0 && (
          <ul className="sign-groups" aria-label="Sign groups">
            {groups.map((g) => <li key={g.name}><strong>{g.name}</strong> {g.signs} sign{g.signs === 1 ? '' : 's'}, {g.pieces} piece{g.pieces === 1 ? '' : 's'}</li>)}
          </ul>
        )}
        <ResponsiveTable columns={columns} rows={allSigns} empty="No signs on this job yet" />
      </Card>
      {editing && (
        <SignModal sign={editing === 'new' ? null : editing} jobId={jobId} places={places} groups={groups.map((g) => g.name)}
          onSave={(rec) => (editing === 'new' ? onAdd(rec) : onUpdate(editing.id, rec))} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
