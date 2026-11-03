import { hoursNotFilled, isWorkshopTask, rollupCsv, splitNotFilled, weekDays, weeklyRollup } from './hours';

const log = [
  { date: '2026-03-02', worker: 'Mia T.', kind: 'fab', hours: 8, unbilled: 0 },
  { date: '2026-03-02', worker: 'Mia T.', kind: 'workshop', hours: 2, unbilled: 2 },
  { date: '2026-03-04', worker: 'Mia T.', kind: 'install', hours: 6, unbilled: 1 },
  { date: '2026-03-03', worker: 'Dave K.', kind: 'install', hours: 7.5, unbilled: 0 },
  { date: '2026-03-09', worker: 'Dave K.', kind: 'install', hours: 8, unbilled: 0 }, // next week
];

test('the week has seven days from Monday', () => {
  expect(weekDays('2026-03-02')).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08']);
});

test('weekly roll-up: total includes workshop hours, final is total minus unbilled', () => {
  const r = weeklyRollup(log, '2026-03-02');
  expect(r.rows.map((x) => x.name)).toEqual(['Dave K.', 'Mia T.']);
  const mia = r.rows.find((x) => x.name === 'Mia T.');
  expect(mia).toMatchObject({ fab: 8, install: 6, workshop: 2, total: 16, unbilled: 3, final: 13 });
  expect(mia.byDay['2026-03-02']).toBe(10);
  expect(r.totals).toMatchObject({ total: 23.5, unbilled: 3, final: 20.5 });
});

test('weekly roll-up ignores hours outside the week', () => {
  expect(weeklyRollup(log, '2026-03-09').rows).toHaveLength(1);
  expect(weeklyRollup(log, '2026-02-23').rows).toHaveLength(0);
});

test('csv has a header, one line per worker and a total line', () => {
  const lines = rollupCsv(weeklyRollup(log, '2026-03-02')).split('\n');
  expect(lines).toHaveLength(4);
  expect(lines[0].startsWith('Worker,2026-03-02')).toBe(true);
  expect(lines[0].endsWith('Fab,Install,Workshop,Total,Unbilled,Final')).toBe(true);
  expect(lines[3].startsWith('Total,')).toBe(true);
});

const task = (id, o = {}) => ({ id, kind: 'fab', type: 'Metal', date: '2026-10-20', ...o });
const rec = (taskId, person, hours) => ({ taskId, person, role: 'TL', steps: { post2: { hours } } });

test('hours not filled: zero-hour closed checklists for past fab tasks on or after the cutoff', () => {
  const tasks = [task('A'), task('B', { type: 'Workshop' }), task('C', { date: '2026-09-01' }), task('D', { date: '2026-11-10' }), task('E', { kind: 'install' }), task('F')];
  const checklists = [rec('A', 'Sam T.', 0), rec('B', 'Sam T.', 0), rec('C', 'Sam T.', 0), rec('D', 'Sam T.', 0), rec('E', 'Sam T.', 0), rec('F', 'Sam T.', 5), rec('A', 'Jo P.', 0),
    { taskId: 'A', person: 'Mia T.', steps: {} }];
  const list = hoursNotFilled({ tasks, checklists, person: 'Sam T.', cutoff: '2026-10-01', todayKey: '2026-11-03' });
  expect(list.map((x) => x.task.id)).toEqual(['A', 'B']); // C before cutoff, D in the future, E not fab, F has hours
  expect(splitNotFilled(list)).toEqual({ workshop: 1, other: 1 });
});

test('workshop tasks are the Workshop and Maintenance types', () => {
  expect(isWorkshopTask({ type: 'Workshop' })).toBe(true);
  expect(isWorkshopTask({ type: 'Maintenance' })).toBe(true);
  expect(isWorkshopTask({ type: 'Metal' })).toBe(false);
});
