import { daysOverdue, isOverdue, isWebUrl, nextDue, nextToolId, offHireOnFinish, sdsMissing, sdsReviewDue } from './equipment';

const item = { status: 'In service', intervalDays: 30, lastChecked: '2026-10-01' };

test('next check is last check plus the interval', () => {
  expect(nextDue(item)).toBe('2026-10-31');
});

test('overdue only after the due date has passed', () => {
  expect(isOverdue(item, '2026-10-31')).toBe(false);
  expect(isOverdue(item, '2026-11-01')).toBe(true);
  expect(daysOverdue(item, '2026-11-05')).toBe(5);
});

test('equipment that is off hire is never overdue', () => {
  expect(isOverdue({ ...item, status: 'Off hire' }, '2027-01-01')).toBe(false);
});

test('the next tool code is the highest number plus one', () => {
  expect(nextToolId([{ id: 'VE - 101' }, { id: 'VE - 110' }, { id: 'VE - 104' }])).toBe('VE - 111');
  expect(nextToolId([])).toBe('VE - 101');
});

test('SDS missing and review due', () => {
  expect(sdsMissing({ sdsUrl: '' })).toBe(true);
  expect(sdsMissing({ sdsUrl: 'https://x.example/a.pdf' })).toBe(false);
  expect(sdsReviewDue({ reviewDate: '2026-10-01' }, '2026-10-02')).toBe(true);
  expect(sdsReviewDue({ reviewDate: '2026-10-02' }, '2026-10-02')).toBe(false);
});

test('only http and https links are accepted for an SDS', () => {
  expect(isWebUrl('https://example.com/sds.pdf')).toBe(true);
  expect(isWebUrl('javascript:alert(1)')).toBe(false);
  expect(isWebUrl('example.com')).toBe(false);
});

describe('off hire when an install finishes on site (EQP-2)', () => {
  const eq = [
    { id: 'VE - 1', status: 'In service', offHireRequired: true },
    { id: 'VE - 2', status: 'In service', offHireRequired: false },
    { id: 'VE - 3', status: 'Off hire', offHireRequired: true },
  ];
  const task = { id: 'I1', kind: 'install', hiredEquipment: ['VE - 1', 'VE - 2', 'VE - 3'] };

  test('only linked equipment that is flagged and still in service goes off hire', () => {
    expect(offHireOnFinish(task, eq).map((e) => e.id)).toEqual(['VE - 1']);
  });
  test('it fires once per task', () => {
    expect(offHireOnFinish({ ...task, offHireSent: true }, eq)).toEqual([]);
  });
  test('fab tasks and tasks with no equipment are ignored', () => {
    expect(offHireOnFinish({ ...task, kind: 'fab' }, eq)).toEqual([]);
    expect(offHireOnFinish({ id: 'I2', kind: 'install' }, eq)).toEqual([]);
  });
});
