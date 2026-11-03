import { ExternalLink, MapPin } from 'lucide-react';
import { Card, Chip, ResponsiveTable } from './ui';
import { seedSigns, seedSites } from '../data/jobSitesSeed';
import { STAGE_TONE, addressLine, locationsForJob, mapsUrl, signSummary } from '../lib/jobSites';

// JOB-3: embedded location and signs on Job Details. Read-only in the demo; sites and signs come from the CRM in the Catalyst build.
export default function JobSitePanel({ jobId, sites = seedSites, signs = seedSigns }) {
  const places = locationsForJob(jobId, sites, signs);
  const allSigns = places.flatMap((p) => p.signs);
  const sum = signSummary(allSigns);
  const siteName = (id) => sites.find((s) => s.id === id)?.name || '-';
  const stage = (v) => <Chip value={v} tone={STAGE_TONE[v] || 'gray'} />;

  const columns = [
    { key: 'name', label: 'Sign', primary: true, render: (g) => <div className="stack"><strong>{g.name}</strong><small>Rev {g.rev} · {g.group}</small></div> },
    ...(places.length > 1 ? [{ key: 'site', label: 'Site', render: (g) => siteName(g.siteId) }] : []),
    { key: 'qty', label: 'Qty', render: (g) => g.qty },
    { key: 'medium', label: 'Medium and finish', render: (g) => <div className="stack"><span>{g.medium}</span><small>{g.finishing}</small></div> },
    { key: 'deal', label: 'Deal', render: (g) => stage(g.deal) },
    { key: 'artwork', label: 'Artwork', render: (g) => stage(g.artwork) },
    { key: 'manufacturing', label: 'Manufacturing', render: (g) => stage(g.manufacturing) },
    { key: 'install', label: 'Install', render: (g) => stage(g.install) },
  ];

  if (places.length === 0) {
    return (
      <section className="job-site" aria-label="Location and signs">
        <Card title="Location and signs"><p className="muted">No site or signs are linked to this job.</p></Card>
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
        action={<span className="muted">{sum.pieces} pieces · {sum.installed} of {sum.signs} installed</span>}>
        <ResponsiveTable columns={columns} rows={allSigns} empty="No signs on this job yet" />
      </Card>
    </section>
  );
}
