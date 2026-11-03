import { addDays, toKey, today } from './dates';
import { setExpiryDays } from './compliance';
import { applyFilter, bucketOf, complianceSummary } from './complianceDashboard';

const day = (n) => (n === null ? '' : toKey(addDays(today(), n)));
afterEach(() => setExpiryDays(30));

test('buckets: past, today, soon, ok and missing', () => {
  expect(bucketOf(day(-1), 30)).toBe('past');
  expect(bucketOf(day(0), 30)).toBe('today');
  expect(bucketOf(day(30), 30)).toBe('soon');
  expect(bucketOf(day(31), 30)).toBe('ok');
  expect(bucketOf('', 30)).toBe('missing');
});

const data = {
  veName: 'VE',
  companies: [{ id: 'C1', name: 'VE', active: true }, { id: 'C2', name: 'Apex', active: true }, { id: 'C3', name: 'Old Co', active: false }],
  workers: [
    { id: 'W1', name: 'Ann', active: true, companyId: 'C1' },
    { id: 'W2', name: 'Bob', active: true, companyId: 'C2' },
    { id: 'W3', name: 'Cy', active: false, companyId: 'C2' },
  ],
  ticketTypes: [{ id: 'T1', name: 'Heights' }],
  inductionTypes: [{ id: 'I1', name: 'Crown' }],
  tickets: [
    { id: 'TK1', workerId: 'W1', typeId: 'T1', expiry: day(-5) },
    { id: 'TK2', workerId: 'W2', typeId: 'T1', expiry: day(10) },
    { id: 'TK3', workerId: 'W3', typeId: 'T1', expiry: day(-9) },
    { id: 'TK4', workerId: 'W1', typeId: 'T1', expiry: day(400) },
  ],
  inductions: [{ id: 'IN1', workerId: 'W2', typeId: 'I1', expiry: day(0) }, { id: 'IN2', workerId: 'W1', typeId: 'I1', expiry: '' }],
  companyDocs: [{ id: 'CD1', companyId: 'C2', name: 'Insurance', expiry: day(3) }, { id: 'CD2', companyId: 'C3', name: 'WorkCover', expiry: day(-1) }],
};

test('active only: counts workers and leaves out inactive workers and companies', () => {
  const s = complianceSummary(data, { activeOnly: true, days: 30 });
  expect(s.workers).toEqual({ ve: 1, nonVe: 1 });
  expect(s.counts).toEqual({ past: 1, today: 1, soon: 2, missing: 1 });
  expect(s.tickets.map((x) => x.id)).toEqual(['TK1', 'TK2']);
  expect(s.docs.map((x) => x.id)).toEqual(['CD1']);
});

test('all: includes inactive workers and companies', () => {
  const s = complianceSummary(data, { activeOnly: false, days: 30 });
  expect(s.workers).toEqual({ ve: 1, nonVe: 2 });
  expect(s.counts.past).toBe(3);
  expect(s.docs.map((x) => x.id)).toEqual(['CD2', 'CD1']);
});

test('the warning window changes what is soon, and filters narrow the list', () => {
  expect(complianceSummary(data, { activeOnly: true, days: 5 }).counts.soon).toBe(1);
  const s = complianceSummary(data, { activeOnly: true, days: 30 });
  expect(applyFilter(s.tickets, 'past').map((x) => x.id)).toEqual(['TK1']);
  expect(applyFilter(s.tickets, 'attention')).toHaveLength(2);
});
