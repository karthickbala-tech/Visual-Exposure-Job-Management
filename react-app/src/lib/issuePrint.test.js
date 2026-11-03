import { PRINT_LAYOUTS, canCreateDeal, defaultLayout, layoutById, printRows } from './issuePrint';
import { DEPARTMENTS, seedIssues } from '../data/issuesSeed';

test('there are seven layouts with unique ids', () => {
  expect(PRINT_LAYOUTS).toHaveLength(7);
  expect(new Set(PRINT_LAYOUTS.map((l) => l.id)).size).toBe(7);
});

test('every department has its own default layout', () => {
  const ids = DEPARTMENTS.map((d) => defaultLayout({ department: d }));
  expect(new Set(ids).size).toBe(DEPARTMENTS.length);
  expect(defaultLayout({ department: 'Something else' })).toBe('full');
  expect(layoutById('nope').id).toBe('full');
});

test('print rows leave out empty fields and show the CRM deal once it exists', () => {
  const civic = seedIssues.find((i) => i.department === 'Civic Billboards');
  const rows = printRows(layoutById('civic'), civic);
  expect(rows.some((r) => r.label === 'Billboard')).toBe(true);
  expect(rows.some((r) => r.label === 'CRM deal')).toBe(false);
  expect(printRows(layoutById('civic'), { ...civic, crmDealId: 'DEAL-9' }).find((r) => r.label === 'CRM deal').value).toBe('DEAL-9');
  rows.forEach((r) => expect(r.value).toBeTruthy());
});

test('summary layout is shorter than the full report', () => {
  const i = seedIssues[0];
  expect(printRows(layoutById('summary'), i).length).toBeLessThan(printRows(layoutById('full'), i).length + 1);
  expect(layoutById('summary').history).toBe(false);
  expect(layoutById('full').history).toBe(true);
});

test('CRM deal button: managers on Management and Civic Billboards, the reporter on their own, never twice', () => {
  const mgmt = { department: 'Management', reportedBy: 'Anna' };
  expect(canCreateDeal(mgmt, { canManage: true, person: 'Rachel' })).toBe(true);
  expect(canCreateDeal(mgmt, { canManage: false, person: 'Rachel' })).toBe(false);
  expect(canCreateDeal({ department: 'Install', reportedBy: 'Rachel' }, { canManage: false, person: 'Rachel' })).toBe(true);
  expect(canCreateDeal({ department: 'Install', reportedBy: 'Dave' }, { canManage: true, person: 'Rachel' })).toBe(false);
  expect(canCreateDeal({ ...mgmt, crmDealId: 'DEAL-1' }, { canManage: true, person: 'Rachel' })).toBe(false);
});
