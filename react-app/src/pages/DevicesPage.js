import { useState } from 'react';
import { MapPin, Smartphone, UserX, WifiOff } from 'lucide-react';
import { Card, Chip, KpiCard, PageHeader, ResponsiveTable } from '../components/ui';
import KpiLink from '../components/KpiLink';
import { useDemo } from '../context/DemoContext';
import { hasLocation, isStale, osmLink, toMapPoints } from '../lib/devices';
import { fmtStamp, fullDate } from '../lib/dates';
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

  const columns = [
    { key: 'worker', label: 'Worker', primary: true, render: (e) => <div className="stack"><strong>{e.worker.name}</strong><small>{company(e.worker.companyId)}</small></div> },
    { key: 'device', label: 'Device', render: (e) => (e.device ? `${e.device.model} · ${e.device.os}` : <span className="muted">No device</span>) },
    { key: 'where', label: 'Last location', render: (e) => (!e.device ? '-' : hasLocation(e.device) ? e.device.address : <span className="muted">No location reported</span>) },
    { key: 'seen', label: 'Last seen', render: (e) => (!e.device || !e.device.seenAt ? '-' : (
      <span>{fmtStamp(e.device.seenAt)} {isStale(e.device) && <Chip value="Stale" tone="amber" />}</span>)) },
    { key: 'serial', label: 'Serial', render: (e) => (e.device ? <span className="dv-serial">{e.device.serial}</span> : '-') },
  ];

  const located = devices.filter(hasLocation).length;
  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title="Devices" subtitle="Device locations come from the MDM sync. Sample data in this demo." />
      <div className="kpis">
        <KpiLink icon={Smartphone} label="Devices" value={devices.length} note={`${withDevice.length} of ${active.length} active workers`} onClick={() => { setFilter('with'); setTab('List'); }} active={filter === 'with'} />
        <KpiLink icon={MapPin} label="Reporting a location" value={located} note="plotted on the map" onClick={() => setTab('Map')} active={tab === 'Map'} />
        <KpiCard icon={WifiOff} label="No location" value={devices.length - located} tone={devices.length - located ? 'warn' : 'brand'} note="skipped by the sync" />
        <KpiLink icon={UserX} label="Workers without a device" value={without.length} note="not in the MDM" onClick={() => { setFilter('without'); setTab('List'); }} active={filter === 'without'} />
      </div>

      <div className="eq-tools">
        <div className="segmented" role="tablist" aria-label="View">
          {['List', 'Map'].map((t) => <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
        <div className="segmented" role="tablist" aria-label="Workers filter">
          {[['all', 'All workers', entries.length], ['with', 'Workers with devices', withDevice.length], ['without', 'Workers without a device', without.length]].map(([id, label, n]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}<em>{n}</em></button>))}
        </div>
      </div>

      {tab === 'List'
        ? <Card title="Devices by worker" flush><ResponsiveTable columns={columns} rows={shown} empty="No workers in this view" /></Card>
        : <Card title="Device locations"><SchematicMap rows={withDevice.filter((e) => filter !== 'without').map((e) => ({ worker: e.worker, device: e.device }))} /></Card>}
    </div>
  );
}
