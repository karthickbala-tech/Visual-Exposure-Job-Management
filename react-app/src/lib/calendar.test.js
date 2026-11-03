import { calendarEvents, showOnInstallCalendar } from './calendar';

const tasks = [
  { id: 'I1', kind: 'install', type: 'VE Install', name: 'Fit', date: '2026-03-02', stage: 'Scheduled' },
  { id: 'I2', kind: 'install', type: 'External Install', name: 'Sparky', date: '2026-03-03', stage: 'Scheduled' },
  { id: 'I3', kind: 'install', type: 'Print Only', name: 'Wrap', date: '2026-03-04', stage: 'Scheduled' },
  { id: 'I4', kind: 'install', type: 'VE Install', name: 'Gone', date: '2026-03-05', stage: 'Cancelled' },
  { id: 'F1', kind: 'fab', type: 'Metal', name: 'Weld', date: '2026-03-02', stage: 'In Progress' },
  { id: 'F2', kind: 'fab', type: 'Paint', name: 'Spray', date: '2026-03-03', stage: 'Scheduled' },
  { id: 'D1', kind: 'design', type: 'Artwork', name: 'Art', date: '2026-03-03', stage: 'In Progress' },
];
const ids = (e) => e.map((x) => x.id).sort();

test('the install calendar leaves out External Install and Print Only, and cancelled tasks', () => {
  expect(ids(calendarEvents(tasks, { tab: 'install' }))).toEqual(['I1']);
  expect(ids(calendarEvents(tasks, { tab: 'install', includeAll: true }))).toEqual(['I1', 'I2', 'I3']);
  expect(showOnInstallCalendar({ type: 'Print Only' })).toBe(false);
});

test('the fab calendar can be filtered by type', () => {
  expect(ids(calendarEvents(tasks, { tab: 'fab' }))).toEqual(['F1', 'F2']);
  expect(ids(calendarEvents(tasks, { tab: 'fab', types: ['Paint'] }))).toEqual(['F2']);
});

test('the unified calendar shows install and fab tasks, labelled, and never design tasks', () => {
  const e = calendarEvents(tasks, { tab: 'unified' });
  expect(ids(e)).toEqual(['F1', 'F2', 'I1']);
  expect(e.find((x) => x.id === 'F1').title).toBe('Fab: Weld');
  expect(e.find((x) => x.id === 'I1').title).toBe('Install: Fit');
  expect(ids(calendarEvents(tasks, { tab: 'unified', types: ['Metal', 'VE Install'] }))).toEqual(['F1', 'I1']);
});
