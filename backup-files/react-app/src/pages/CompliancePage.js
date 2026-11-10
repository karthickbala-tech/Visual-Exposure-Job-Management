import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, HardHat, Hourglass, Users } from 'lucide-react';
import { Card, Chip, KpiCard, PageHeader, ResponsiveTable } from '../components/ui';
import KpiLink from '../components/KpiLink';
import { useDemo } from '../context/DemoContext';
import { VE_NAME, inductionTypes, ticketTypes } from '../data/workersSeed';
import { expiryText } from '../lib/compliance';
import { FILTERS, applyFilter, complianceSummary } from '../lib/complianceDashboard';
import { formatShort } from '../lib/dates';

const BUCKET = { past: { label: 'Expired', tone: 'red' }, today: { label: 'Expires today', tone: 'amber' }, soon: { label: 'Expiring', tone: 'amber' } };

// CMP-2: Compliance dashboard (Admin). Active VE and non-VE workers, and what is past expiry, expiring today or expiring soon.
export default function CompliancePage() {
  const { workers, companies, tickets, inductions, companyDocs, settings } = useDemo();
  const [activeOnly, setActiveOnly] = useState(true);
  const [filter, setFilter] = useState('attention');
  const days = settings.expiryDays;

  const sum = useMemo(() => complianceSummary(
    { workers, companies, tickets, inductions, companyDocs, ticketTypes, inductionTypes, veName: VE_NAME },
    { activeOnly, days },
  ), [workers, companies, tickets, inductions, companyDocs, activeOnly, days]);

  const cols = (withEmployer) => [
    { key: 'owner', label: 'Owner', primary: true, render: (x) => (x.ownerId ? <Link className="job-link" to={`/workers/${x.ownerId}`}>{x.owner}</Link> : <strong>{x.owner}</strong>) },
    { key: 'name', label: 'Item', render: (x) => x.name },
    ...(withEmployer ? [{ key: 'employer', label: 'Employer', render: (x) => x.employer || '-' }] : []),
    { key: 'expiry', label: 'Expiry', render: (x) => <div className="stack"><span>{formatShort(x.expiry)}</span><small>{expiryText(x.expiry)}</small></div> },
    { key: 'status', label: 'Status', render: (x) => <Chip value={BUCKET[x.bucket].label} tone={BUCKET[x.bucket].tone} /> },
  ];
  const empty = 'Nothing in this view';
  const scope = activeOnly ? 'active' : 'all';

  return (
    <div className="dash">
      <PageHeader eyebrow="Workers and subcontractors" title="Compliance" subtitle={`Tickets, inductions and documents, with expiry dates and reminders. The warning window is ${days} days (change it in Admin, General).`}>
        <div className="segmented" role="group" aria-label="Which workers">
          <button type="button" className={activeOnly ? 'on' : ''} aria-pressed={activeOnly} onClick={() => setActiveOnly(true)}>Active only</button>
          <button type="button" className={!activeOnly ? 'on' : ''} aria-pressed={!activeOnly} onClick={() => setActiveOnly(false)}>All</button>
        </div>
      </PageHeader>

      <div className="kpis" aria-label="Compliance totals">
        <KpiCard icon={Users} label="VE workers" value={sum.workers.ve} note={`${scope} Visual Exposure workers`} />
        <KpiCard icon={HardHat} label="Non-VE workers" value={sum.workers.nonVe} note={`${scope} subcontractors`} />
        <KpiLink icon={AlertTriangle} label="Past expiry" value={sum.counts.past} tone="danger" note="tickets, inductions and documents" onClick={() => setFilter('past')} active={filter === 'past'} />
        <KpiLink icon={CalendarClock} label="Expires today" value={sum.counts.today} tone="warn" note="renew today" onClick={() => setFilter('today')} active={filter === 'today'} />
        <KpiLink icon={Hourglass} label={`Within ${days} days`} value={sum.counts.soon} tone="warn" note={`${sum.counts.missing} not filled in yet`} onClick={() => setFilter('soon')} active={filter === 'soon'} />
      </div>

      <div className="segmented" role="tablist" aria-label="Expiry filter">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>

      {filter !== 'attention' && <p className="muted">Showing {FILTERS.find((f) => f.id === filter).label.toLowerCase()} only. <button type="button" className="link-btn" onClick={() => setFilter('attention')}>Show everything that needs attention</button></p>}
      <Card title={`Tickets (${applyFilter(sum.tickets, filter).length})`} flush><ResponsiveTable columns={cols(true)} rows={applyFilter(sum.tickets, filter)} empty={empty} /></Card>
      <Card title={`Inductions (${applyFilter(sum.inductions, filter).length})`} flush><ResponsiveTable columns={cols(true)} rows={applyFilter(sum.inductions, filter)} empty={empty} /></Card>
      <Card title={`Company documents (${applyFilter(sum.docs, filter).length})`} flush><ResponsiveTable columns={cols(false)} rows={applyFilter(sum.docs, filter)} empty={empty} /></Card>
      <small className="muted">Expiry is measured from today. FSD question 16 (the intended reminder rule) is still open.</small>
    </div>
  );
}
