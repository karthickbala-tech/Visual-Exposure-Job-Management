import { addDays, toKey, today } from './dates';
import { bucketOf, complianceSummary } from './compliance';

const day = (n) => toKey(addDays(today(), n));

test('buckets are exclusive: past, today, 1 to 30 days, later, and not filled in', () => {
  expect(bucketOf(day(-1))).toBe('Expired');
  expect(bucketOf(day(0))).toBe('Today');
  expect(bucketOf(day(1))).toBe('Soon');
  expect(bucketOf(day(30))).toBe('Soon');
  expect(bucketOf(day(31))).toBe('Current');
  expect(bucketOf('')).toBe('Incomplete');
});

const companies = [{ id: 'C1', name: 'VE', active: true }, { id: 'C2', name: 'Sub', active: true }, { id: 'C3', name: 'Gone', active: false }];
const workers = [
  { id: 'W1', companyId: 'C1', active: true }, { id: 'W2', companyId: 'C2', active: true },
  { id: 'W3', companyId: 'C2', active: false }, { id: 'W4', companyId: 'C3', active: true },
];
const tickets = [
  { id: 'T1', workerId: 'W1', expiry: day(-5) }, { id: 'T2', workerId: 'W2', expiry: day(0) },
  { id: 'T3', workerId: 'W3', expiry: day(-2) }, { id: 'T4', workerId: 'W2', expiry: day(10) },
];
const inductions = [{ id: 'N1', workerId: 'W1', expiry: '' }, { id: 'N2', workerId: 'W3', expiry: day(-9) }];
const companyDocs = [{ id: 'D1', companyId: 'C2', expiry: day(-1) }, { id: 'D2', companyId: 'C3', expiry: day(-1) }];
const input = { workers, companies, tickets, inductions, companyDocs, veName: 'VE' };

test('active only counts active VE and non-VE workers and drops inactive owners\' items', () => {
  const s = complianceSummary({ ...input, activeOnly: true });
  expect(s.workers).toEqual({ ve: 1, nonVe: 2 }); // W1, then W2 and W4
  expect(s.buckets.Expired).toEqual({ tickets: 1, inductions: 0, docs: 1, total: 2 }); // T1, D1 (W3 and company C3 are inactive)
  expect(s.buckets.Today.total).toBe(1);
  expect(s.buckets.Soon.tickets).toBe(1);
  expect(s.buckets.Incomplete.inductions).toBe(1);
});

test('all includes inactive workers, their items and inactive company documents', () => {
  const s = complianceSummary({ ...input, activeOnly: false });
  expect(s.workers).toEqual({ ve: 1, nonVe: 3 });
  expect(s.buckets.Expired).toEqual({ tickets: 2, inductions: 1, docs: 2, total: 5 });
});
