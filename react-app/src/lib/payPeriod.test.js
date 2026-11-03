import { lastPayPeriod, payPeriodFor, thisPayPeriod } from './payPeriod';

const cfg = { anchor: '2026-01-05', days: 14 }; // a Monday, fortnightly

test('a date inside a pay period gets that period', () => {
  expect(payPeriodFor('2026-01-05', cfg)).toEqual({ from: '2026-01-05', to: '2026-01-18' });
  expect(payPeriodFor('2026-01-18', cfg)).toEqual({ from: '2026-01-05', to: '2026-01-18' });
  expect(payPeriodFor('2026-01-19', cfg)).toEqual({ from: '2026-01-19', to: '2026-02-01' });
});

test('periods also work for dates before the anchor', () => {
  expect(payPeriodFor('2026-01-04', cfg)).toEqual({ from: '2025-12-22', to: '2026-01-04' });
});

test('this and last pay period come from the one setting', () => {
  expect(thisPayPeriod('2026-01-20', cfg).from).toBe('2026-01-19');
  expect(lastPayPeriod('2026-01-20', cfg)).toEqual({ from: '2026-01-05', to: '2026-01-18' });
  const weekly = { anchor: '2026-01-05', days: 7 };
  expect(thisPayPeriod('2026-01-14', weekly)).toEqual({ from: '2026-01-12', to: '2026-01-18' });
  expect(lastPayPeriod('2026-01-14', weekly)).toEqual({ from: '2026-01-05', to: '2026-01-11' });
});
