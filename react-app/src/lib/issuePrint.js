// ISS-5: the seven issue print layouts. Pure functions.
// The FSD gives only the count (7), not the names of the Creator layouts, so these are PLACEHOLDERS to confirm against
// the Creator export: two general layouts and one per department. Each layout is a title plus the fields it prints.
import { formatShort } from './dates';
import { canSeeField } from './issueFields';

// Which issue field (ISS-6) each printed line comes from. Lines not listed here are always printed.
const SOURCE = { manager: ['assignedTo'], also: ['notify'], due: ['dueDate'], location: ['location'], billboard: ['site', 'direction'], task: ['taskId'], review: ['review'], completed: ['dateCompleted', 'completionNotes'] };

const FIELDS = {
  id: ['Issue number', (i) => i.id],
  department: ['Department', (i) => i.department],
  priority: ['Priority', (i) => i.priority],
  status: ['Status', (i) => i.status],
  reported: ['Reported by', (i) => `${i.reportedBy}${i.date ? `, ${formatShort(i.date)}` : ''}`],
  manager: ['Assigned manager', (i) => i.assignedTo],
  also: ['Also informed', (i) => (i.notify || []).join(', ')],
  due: ['Due', (i) => (i.dueDate ? formatShort(i.dueDate) : '')],
  location: ['Location', (i) => i.location],
  billboard: ['Billboard', (i) => [i.site, i.direction].filter(Boolean).join(', ')],
  task: ['Related task', (_i, ctx) => ctx.taskName || ''],
  review: ['Review', (i) => i.review],
  deal: ['CRM deal', (i) => i.crmDealId || ''],
  completed: ['Completed', (i) => (i.status === 'Completed' && i.dateCompleted ? `${formatShort(i.dateCompleted)}. ${i.completionNotes || ''}`.trim() : '')],
};

export const PRINT_LAYOUTS = [
  { id: 'summary', label: 'Summary (one page)', title: 'Issue summary', fields: ['id', 'department', 'priority', 'status', 'reported', 'manager', 'due'], description: true, history: false },
  { id: 'full', label: 'Full report with history', title: 'Issue report', fields: ['id', 'department', 'priority', 'status', 'reported', 'manager', 'also', 'due', 'location', 'billboard', 'task', 'review', 'deal', 'completed'], description: true, history: true },
  { id: 'install', label: 'Install issue', title: 'Install issue report', fields: ['id', 'priority', 'status', 'reported', 'manager', 'also', 'due', 'task', 'review', 'completed'], description: true, history: true },
  { id: 'workshop', label: 'Workshop issue', title: 'Workshop issue report', fields: ['id', 'priority', 'status', 'reported', 'manager', 'also', 'due', 'location', 'task', 'review', 'completed'], description: true, history: true },
  { id: 'civic', label: 'Civic Billboards issue', title: 'Civic Billboards issue report', fields: ['id', 'priority', 'status', 'reported', 'manager', 'billboard', 'due', 'deal', 'completed'], description: true, history: true },
  { id: 'management', label: 'Management issue', title: 'Management issue report', fields: ['id', 'priority', 'status', 'reported', 'manager', 'also', 'due', 'review', 'deal', 'completed'], description: true, history: true },
  { id: 'vt', label: 'VT / Digital Screens issue', title: 'VT / Digital Screens issue report', fields: ['id', 'priority', 'status', 'reported', 'manager', 'billboard', 'location', 'due', 'completed'], description: true, history: true },
];

const BY_DEPARTMENT = { Install: 'install', Workshop: 'workshop', 'Civic Billboards': 'civic', Management: 'management', 'VT/Digital Screens': 'vt' };
export const defaultLayout = (issue) => BY_DEPARTMENT[issue.department] || 'full';
export const layoutById = (id) => PRINT_LAYOUTS.find((l) => l.id === id) || PRINT_LAYOUTS[1];

// The label and value rows a layout prints. Rows with no value are left out, and so are fields hidden from the role (ISS-6).
export function printRows(layout, issue, ctx = {}) {
  const hidden = (k) => ctx.roleId && SOURCE[k] && SOURCE[k].every((f) => !canSeeField(ctx.roleId, f));
  return layout.fields.filter((k) => !hidden(k)).map((k) => ({ label: FIELDS[k][0], value: FIELDS[k][1](issue, ctx) })).filter((r) => r.value);
}

// ISS-4: the CRM deal button. Shown on Management and Civic Billboards issues to managers, and on the person's own reported issues.
export const CRM_DEPARTMENTS = ['Management', 'Civic Billboards'];
export const canCreateDeal = (issue, { canManage, person }) => (
  !issue.crmDealId && ((canManage && CRM_DEPARTMENTS.includes(issue.department)) || issue.reportedBy === person)
);
