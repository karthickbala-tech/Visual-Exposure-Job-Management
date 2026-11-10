import { useState } from 'react';
import { PageHeader } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { hasLocation, isStale, osmLink, toMapPoints } from '../lib/devices';
import { fmtStamp } from '../lib/dates';
import './FabDashboard.css';
import './EquipmentPage.css';
import './DevicesPage.css';

const W = 640;
const H = 340;
const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

// Schematic map: pins are scaled from latitude and longitude, with no map tiles, so it works offline.
// Each pin has an OpenStreetMap link in the list below for the real map.
function SchematicMap({ rows }) {
  const pts = toMapPoints(rows.map((r) => r.device), W, H);
  const byId = Object.fromEntries(pts.map((p) => [p.id, p]));
  return (
    <>
      <svg className="dv-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic map of ${pts.length} device locations`}>
        <g className="grid">{[1, 2, 3].map((i) => <line key={`v${i}`} x1={(W / 4) * i} y1="0" x2={(W / 4) * i} y2={H} />)}{[1, 2].map((i) => <line key={`h${i}`} x1="0" y1={(H / 3) * i} x2={W} y2={(H / 3) * i} />)}</g>
        <text className="north" x={W - 14} y="18" textAnchor="end">N ↑</text>
        {rows.filter((r) => byId[r.device.id]).map((r) => {
          const p = byId[r.device.id];
          return (
            <g key={r.device.id} className={`pin ${isStale(r.device) ? 'stale' : ''}`} transform={`translate(${p.x} ${p.y})`}>
              <title>{r.worker.name}: {r.device.address || 'location'}</title>
              <circle r="15" />
              <text>{initials(r.worker.name)}</text>
            </g>
          );
        })}
      </svg>
      <p className="dv-note">Pins are placed relative to each other, not on a street map. Grey pins have not reported in over 24 hours. Use the links below to open the real map.</p>
      <ul className="dv-legend">
        {rows.filter((r) => hasLocation(r.device)).map((r) => (
          <li key={r.device.id} className={isStale(r.device) ? 'stale' : ''}>
            <span className="dot" aria-hidden="true">{initials(r.worker.name)}</span>
            <span><strong>{r.worker.name}</strong><br /><small>{r.device.address} · <a href={osmLink(r.device)} target="_blank" rel="noopener noreferrer">Open in OpenStreetMap</a></small></span>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function DevicesPage() {
  const { workers, companies, devices } = useDemo();
  const [tab, setTab] = useState('List');
  const [filter, setFilter] = useState('all');

  const active = workers.filter((w) => w.active);
  const entries = active.map((w) => ({ id: w.id, worker: w, device: devices.find((d) => d.workerId === w.id) || null }));
  const withDevice = entries.filter((e) => e.device);
  const without = entries.filter((e) => !e.device);
  const shown = filter === 'with' ? withDevice : filter === 'without' ? without : entries;
  const company = (id) => companies.find((c) => c.id === id)?.name || '-';

  const located = devices.filter(hasLocation).length;
  const FILTERS = [['all', 'All workers', entries.length], ['with', 'Workers with devices', withDevice.length], ['without', 'Workers without a device', without.length]];

  // Same layout as web/src/pages/Devices.tsx: one card, a table of Person, Device, Last seen and Location.
  // The react extras stay: who has or has no device, and the schematic map.
  return (
    <div className="dash wdevices">
      <PageHeader eyebrow="Workers" title="Devices" subtitle="Last known location of each worker device." />
      <section className="wd-card">
        <div className="wd-tools">
          <div className="segmented" role="tablist" aria-label="Workers filter">
            {FILTERS.map(([id, label, n]) => (
              <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}<em>{n}</em></button>))}
          </div>
          <span className="wd-count">{devices.length} devices · {located} reporting a location</span>
          <div className="segmented" role="tablist" aria-label="View">
            {['List', 'Map'].map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          </div>
        </div>
        {tab === 'List' ? (
          shown.length === 0 ? <p className="wd-empty">No workers in this view.</p> : (
            <div className="wd-wrap">
              <table className="wd-table">
                <caption className="sr-only">Devices</caption>
                <thead><tr><th scope="col">Person</th><th scope="col">Device</th><th scope="col">Last seen</th><th scope="col">Location</th></tr></thead>
                <tbody>
                  {shown.map((e) => (
                    <tr key={e.id}>
                      <td data-label="Person" className="cell-primary"><strong>{e.worker.name}</strong><small>{company(e.worker.companyId)}</small></td>
                      <td data-label="Device">{e.device ? <>{[e.device.model, e.device.os].filter(Boolean).join(' / ')}<small className="dv-serial">{e.device.serial}</small></> : <span className="muted">No device</span>}</td>
                      <td data-label="Last seen">
                        {!e.device ? '-' : e.device.seenAt ? fmtStamp(e.device.seenAt) : 'Never'}
                        {e.device && isStale(e.device) && <span className="chip chip-amber wd-stale">Not seen for 24 h</span>}
                      </td>
                      <td data-label="Location">
                        {!e.device ? '-' : hasLocation(e.device)
                          ? <a href={osmLink(e.device)} target="_blank" rel="noopener noreferrer">{e.device.address || `${e.device.lat?.toFixed(4)}, ${e.device.lng?.toFixed(4)}`}</a>
                          : <span className="muted">No location reported</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="wd-map"><SchematicMap rows={withDevice.filter(() => filter !== 'without').map((e) => ({ worker: e.worker, device: e.device }))} /></div>
        )}
      </section>
    </div>
  );
}
