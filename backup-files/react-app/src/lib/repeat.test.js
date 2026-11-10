import { cleanRepeat, nextRepeatDate, nextRepeatTask, repeatDays, repeatLabel, shouldRepeat, validateRepeat } from './repeat';

test('days = count, weeks x 7, months x 30', () => {
  expect(repeatDays({ count: 3, unit: 'Days' })).toBe(3);
  expect(repeatDays({ count: 2, unit: 'Weeks' })).toBe(14);
  expect(repeatDays({ count: 1, unit: 'Months' })).toBe(30);
});

test('next date is the previous date plus the interval, across month ends', () => {
  expect(nextRepeatDate('2026-03-02', { count: 1, unit: 'Weeks' })).toBe('2026-03-09');
  expect(nextRepeatDate('2026-01-31', { count: 1, unit: 'Months' })).toBe('2026-03-02');
  expect(nextRepeatDate('2026-12-30', { count: 5, unit: 'Days' })).toBe('2027-01-04');
});

test('validation: empty means no repeat, otherwise a whole number 1 to 365 and a unit', () => {
  expect(validateRepeat({ count: '', unit: 'Weeks' })).toBe('');
  expect(validateRepeat({ count: '2', unit: 'Weeks' })).toBe('');
  expect(validateRepeat({ count: '0', unit: 'Weeks' })).toMatch(/whole number/);
  expect(validateRepeat({ count: '1.5', unit: 'Weeks' })).toMatch(/whole number/);
  expect(validateRepeat({ count: '400', unit: 'Days' })).toMatch(/365/);
  expect(validateRepeat({ count: '2', unit: 'Years' })).toMatch(/days, weeks or months/);
});

test('cleanRepeat stores a number, or null', () => {
  expect(cleanRepeat({ count: '2', unit: 'Weeks' })).toEqual({ count: 2, unit: 'Weeks' });
  expect(cleanRepeat({ count: '', unit: 'Weeks' })).toBeNull();
  expect(cleanRepeat({ count: 'x', unit: 'Weeks' })).toBeNull();
  expect(cleanRepeat(undefined)).toBeNull();
});

test('labels read naturally', () => {
  expect(repeatLabel({ count: 1, unit: 'Weeks' })).toBe('Every week');
  expect(repeatLabel({ count: 2, unit: 'Weeks' })).toBe('Every 2 weeks');
  expect(repeatLabel({ count: 30, unit: 'Days' })).toBe('Every 30 days');
});

const t = (o = {}) => ({ id: 'F8', type: 'Workshop', stage: 'Completed', repeat: { count: 1, unit: 'Weeks' }, ...o });

test('only completed Workshop tasks with a repeat spawn the next one, and only once', () => {
  expect(shouldRepeat(t())).toBe(true);
  expect(shouldRepeat(t({ stage: 'Complete - Not Used' }))).toBe(false);
  expect(shouldRepeat(t({ stage: 'In Progress' }))).toBe(false);
  expect(shouldRepeat(t({ type: 'Maintenance' }))).toBe(false);
  expect(shouldRepeat(t({ repeat: undefined }))).toBe(false);
  expect(shouldRepeat(t({ repeatSpawned: 'F20' }))).toBe(false);
});

test('the next task copies the details, resets hours, and starts Scheduled only with a leader', () => {
  const base = { ...t(), name: 'Restock', jobId: 'J-0000', date: '2026-03-02', leader: 'Jo P.', member: 'Sam T.', quoted: 2, booked: 2 };
  const next = nextRepeatTask(base, 'F20', 'now');
  expect(next).toMatchObject({ id: 'F20', name: 'Restock', date: '2026-03-09', stage: 'Scheduled', booked: 0, quoted: 2, repeatOf: 'F8', leader: 'Jo P.' });
  expect(next.repeat).toEqual({ count: 1, unit: 'Weeks' });
  expect(nextRepeatTask({ ...base, leader: '' }, 'F21', 'now').stage).toBe('Awaiting Scheduling');
});
