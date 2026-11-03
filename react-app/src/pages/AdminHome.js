import { Link } from 'react-router-dom';
import { AlertTriangle, Briefcase, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Card, KpiCard, PageHeader } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { VE_NAME, inductionTypes, ticketTypes } from '../data/workersSeed';
import { complianceSummary } from '../lib/complianceDashboard';
import { fullDate } from '../lib/dates';
import { JOB_CLOSED } from '../lib/jobs';

// Admin home: a few totals and shortcuts. The detail lives on the other screens.
export default function AdminHome() {
  const { role, jobs, tasks, issues, workers, companies, tickets, inductions, companyDocs, settings } = useDemo();
  const openJobs = jobs.filter((j) => !['Completed', JOB_CLOSED, 'Cancelled'].includes(j.stage)).length;
  const inReview = tasks.filter((t) => t.stage === 'Manager Review').length;
  const openIssues = issues.filter((i) => i.status !== 'Completed').length;
  const { counts } = complianceSummary({ workers, companies, tickets, inductions, companyDocs, ticketTypes, inductionTypes, veName: VE_NAME }, { activeOnly: true, days: settings.expiryDays });
  const attention = counts.past + counts.today + counts.soon;

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title={`${role.name}'s home`} subtitle="Totals across the whole business." />
      <div className="kpis">
        <KpiCard icon={Briefcase} label="Open jobs" value={openJobs} note="not completed or cancelled" />
        <KpiCard icon={ShieldCheck} label="Tasks in Manager Review" value={inReview} tone={inReview ? 'warn' : 'brand'} note="waiting for approval" />
        <KpiCard icon={AlertTriangle} label="Open issues" value={openIssues} note="across all departments" />
        <KpiCard icon={ClipboardCheck} label="Compliance items to chase" value={attention} tone={counts.past ? 'danger' : attention ? 'warn' : 'brand'} note={`${counts.past} already expired`} />
      </div>
      <Card title="Go to">
        <div className="tags tags-lg">
          <Link className="btn btn-ghost" to="/admin">Admin settings</Link>
          <Link className="btn btn-ghost" to="/compliance">Compliance dashboard</Link>
          <Link className="btn btn-ghost" to="/hours">Employee hours</Link>
          <Link className="btn btn-ghost" to="/jobs">Jobs</Link>
        </div>
      </Card>
    </div>
  );
}
