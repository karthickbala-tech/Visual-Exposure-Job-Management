import { HIDDEN_FIELDS, ISSUE_FIELDS, canSeeField, hiddenCount, hiddenFor } from './issueFields';
import { ROLES } from '../data/mockData';
import { PRINT_LAYOUTS, layoutById, printRows } from './issuePrint';

test('an issue has 18 fields', () => {
  expect(ISSUE_FIELDS).toHaveLength(18);
  expect(new Set(ISSUE_FIELDS.map(([id]) => id)).size).toBe(18);
});

test('every hidden field is a real issue field, and every role has an entry', () => {
  const ids = ISSUE_FIELDS.map(([id]) => id);
  Object.values(HIDDEN_FIELDS).flat().forEach((f) => expect(ids).toContain(f));
  Object.keys(ROLES).forEach((r) => expect(HIDDEN_FIELDS[r]).toBeDefined());
});

test('managers see every field, field staff see fewer', () => {
  ['admin', 'pm', 'fabManager'].forEach((r) => expect(hiddenCount(r)).toBe(0));
  expect(canSeeField('pm', 'review')).toBe(true);
  expect(canSeeField('installer', 'review')).toBe(false);
  expect(canSeeField('installer', 'assignedTo')).toBe(false);
  expect(canSeeField('installer', 'subject')).toBe(true);
  expect(hiddenFor('contractor')).toContain('history');
  expect(hiddenCount('contractor')).toBeGreaterThan(hiddenCount('installer'));
});

test('the fields every role needs to report and follow an issue are never hidden', () => {
  ['subject', 'description', 'department', 'priority', 'status', 'reportedBy', 'date'].forEach((f) => {
    Object.keys(HIDDEN_FIELDS).forEach((r) => expect(canSeeField(r, f)).toBe(true));
  });
});

test('print rows leave out hidden fields for a role, and print everything for a manager', () => {
  const issue = { id: 'IS-1', department: 'Install', priority: 'High', status: 'In Progress', reportedBy: 'Dave Kerr', date: '2026-03-02', assignedTo: 'Rachel Barnes', notify: ['Dave Kerr'], dueDate: '2026-03-09', review: 'WHS Reported', history: [] };
  const labels = (roleId) => printRows(layoutById('install'), issue, { roleId, taskName: '' }).map((r) => r.label);
  expect(labels('pm')).toEqual(expect.arrayContaining(['Assigned manager', 'Also informed', 'Due', 'Review']));
  const worker = labels('installer');
  ['Assigned manager', 'Also informed', 'Due', 'Review'].forEach((l) => expect(worker).not.toContain(l));
  expect(worker).toContain('Priority');
  // without a role every row is printed, so existing callers are unchanged
  expect(printRows(layoutById('install'), issue, {}).map((r) => r.label)).toContain('Assigned manager');
  expect(PRINT_LAYOUTS).toHaveLength(7);
});
