import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, Briefcase, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { Card, PageHeader } from '../components/ui';
import KpiLink from '../components/KpiLink';
import ToDoList from '../components/ToDoList';
import TaskDrawer from '../components/TaskDrawer';
import { AssignDesignerModal, DeleteTaskModal, ScheduleModal, TaskEditModal } from '../components/TaskForms';
import { useDemo } from '../context/DemoContext';
import { VE_NAME, inductionTypes, ticketTypes } from '../data/workersSeed';
import { complianceSummary } from '../lib/complianceDashboard';
import { formatShort, fullDate } from '../lib/dates';
import { JOB_CLOSED } from '../lib/jobs';

// Admin home: totals that open the matching screen, a short "to do" list, and shortcuts.
export default function AdminHome() {
  const { role, jobs, tasks, issues, workers, companies, tickets, inductions, companyDocs, settings, outbox = [] } = useDemo();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [req, setReq] = useState(null);
  const openJobs = jobs.filter((j) => !['Completed', JOB_CLOSED, 'Cancelled'].includes(j.stage)).length;
  const review = tasks.filter((t) => t.stage === 'Manager Review');
  const openIssues = issues.filter((i) => i.status !== 'Completed');
  const urgent = openIssues.filter((i) => ['High', 'Urgent'].includes(i.priority));
  const { counts } = complianceSummary({ workers, companies, tickets, inductions, companyDocs, ticketTypes, inductionTypes, veName: VE_NAME }, { activeOnly: true, days: settings.expiryDays });
  const attention = counts.past + counts.today + counts.soon;
  const failed = (outbox || []).filter((o) => o.status === 'failed').length;

  const todo = [
    ...(counts.past ? [{ id: 'cmp-past', tone: 'danger', title: `${counts.past} compliance item${counts.past > 1 ? 's' : ''} already expired`, detail: 'Tickets, inductions or company documents', action: { label: 'Open compliance', to: '/compliance' } }] : []),
    ...(counts.today + counts.soon ? [{ id: 'cmp-soon', tone: 'warn', title: `${counts.today + counts.soon} compliance item${counts.today + counts.soon > 1 ? 's' : ''} expiring within ${settings.expiryDays} days`, action: { label: 'Open compliance', to: '/compliance' } }] : []),
    ...urgent.map((i) => ({ id: `is-${i.id}`, tone: 'danger', title: `${i.priority} issue: ${i.subject}`, detail: `${i.department} · ${i.status}`, action: { label: 'Open issues', to: '/issues' } })),
    ...review.map((t) => ({ id: `rv-${t.id}`, tone: 'warn', title: `Waiting for approval: ${t.name}`, detail: `${t.jobId} · since ${t.date ? formatShort(t.date) : '-'}`, action: { label: 'Review', onClick: () => setOpenId(t.id) } })),
    ...(failed ? [{ id: 'outbox', tone: 'danger', title: `${failed} integration message${failed > 1 ? 's' : ''} failed`, action: { label: 'Open admin', to: '/admin' } }] : []),
  ];
  const fresh = (t) => tasks.find((x) => x.id === t.id) || t;

  return (
    <div className="dash">
      <PageHeader eyebrow={fullDate()} title={`${role.name}'s home`} subtitle="Totals across the whole business." />
      <div className="kpis">
        <KpiLink icon={Briefcase} label="Open jobs" value={openJobs} note="not completed or cancelled" onClick={() => navigate('/jobs')} />
        <KpiLink icon={ShieldCheck} label="Tasks in Manager Review" value={review.length} tone={review.length ? 'warn' : 'brand'} note="waiting for approval" onClick={() => review[0] && setOpenId(review[0].id)} />
        <KpiLink icon={AlertTriangle} label="Open issues" value={openIssues.length} note="across all departments" onClick={() => navigate('/issues')} />
        <KpiLink icon={ClipboardCheck} label="Compliance items to chase" value={attention} tone={counts.past ? 'danger' : attention ? 'warn' : 'brand'} note={`${counts.past} already expired`} onClick={() => navigate('/compliance')} />
      </div>
      <ToDoList items={todo} />
      <Card title="Go to">
        <div className="tags tags-lg">
          <Link className="btn btn-ghost" to="/admin">Admin settings</Link>
          <Link className="btn btn-ghost" to="/compliance">Compliance dashboard</Link>
          <Link className="btn btn-ghost" to="/hours">Employee hours</Link>
          <Link className="btn btn-ghost" to="/jobs">Jobs</Link>
        </div>
      </Card>
      <TaskDrawer task={tasks.find((t) => t.id === openId) || null} onClose={() => setOpenId(null)} onRequest={(kind, task) => { setOpenId(null); setReq({ kind, task }); }} />
      {req?.kind === 'edit' && <TaskEditModal task={fresh(req.task)} onClose={() => setReq(null)} />}
      {req?.kind === 'delete' && <DeleteTaskModal task={req.task} onClose={() => setReq(null)} />}
      {req?.kind === 'schedule' && <ScheduleModal task={fresh(req.task)} onClose={() => setReq(null)} />}
      {req?.kind === 'assign' && <AssignDesignerModal task={fresh(req.task)} onClose={() => setReq(null)} />}
    </div>
  );
}
