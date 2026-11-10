import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoProvider, useDemo } from '../context/DemoContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const mount = () => act(() => root.render(<DemoProvider><Probe /></DemoProvider>));
const task = (id) => api.tasks.find((t) => t.id === id);
const step = (id, person, key, d) => { let r; act(() => { r = api.completeChecklistStep(id, person, key, d); }); return r; };

test('install flow: briefing, arrival, finish on site, closures, submit, PM review', () => {
  mount();
  // I1 is a VE Install with Dave K. as leader and Sam T. as member. Its SWMS is already complete.
  expect(step('I1', 'Dave K.', 'pre1', {})).toMatch(/brief/);
  expect(step('I1', 'Dave K.', 'pre1', { briefed: true })).toBe('');
  expect(task('I1').subStage).toBe('Team Briefed');

  expect(step('I1', 'Dave K.', 'pre2', { arrived: true })).toBe('');
  expect(task('I1').subStage).toBe('On Site');

  // Finishing on site sends the flagged hired scissor lift off hire (EQP-2).
  expect(api.equipment.find((e) => e.id === 'VE - 106').status).toBe('In service');
  expect(step('I1', 'Dave K.', 'post1', { workComplete: true })).toBe('');
  expect(task('I1').subStage).toBe('Finished On Site');
  expect(api.equipment.find((e) => e.id === 'VE - 106').status).toBe('Off hire');

  // Submit is blocked until both crew members have closed.
  const before = task('I1').booked;
  expect(step('I1', 'Dave K.', 'post2', { hours: '8', unbilled: '1' })).toBe('');
  expect(task('I1').booked).toBe(before + 8);
  let ok;
  act(() => { ok = api.actOnTask('I1', 'Submit for approval'); });
  expect(ok).toBe(false);
  expect(task('I1').stage).toBe('In Progress');

  expect(step('I1', 'Sam T.', 'post2', { hours: '9', rating: '11' })).toMatch(/1 to 10/);
  expect(step('I1', 'Sam T.', 'post2', { hours: '9', rating: '8' })).toBe('');
  act(() => { ok = api.actOnTask('I1', 'Submit for approval'); });
  expect(ok).toBe(true);
  expect(task('I1').stage).toBe('Manager Review');

  // PM review is recorded with the approval, and the stage history logs each move.
  act(() => { api.actOnTask('I1', 'Approve', 'Looks good', { pmReview: { comment: 'Looks good', ohs: 'No', mgmtReview: true, tlRating: 9, by: 'Rachel Barnes' } }); });
  expect(task('I1').stage).toBe('Completed');
  expect(task('I1').pmReview).toMatchObject({ ohs: 'No', mgmtReview: true, tlRating: 9 });
  const moves = task('I1').history.filter((h) => h.to).map((h) => `${h.from}>${h.to}`);
  expect(moves).toEqual(expect.arrayContaining(['In Progress>Manager Review', 'Manager Review>Completed']));
});

test('a rejection resets the post-job checklists so the crew redo them', () => {
  mount();
  step('I1', 'Dave K.', 'pre1', { briefed: true });
  step('I1', 'Dave K.', 'pre2', { arrived: true });
  step('I1', 'Dave K.', 'post1', { workComplete: true });
  step('I1', 'Dave K.', 'post2', { hours: '8' });
  step('I1', 'Sam T.', 'post2', { hours: '8', rating: '7' });
  act(() => { api.actOnTask('I1', 'Submit for approval'); });
  act(() => { api.actOnTask('I1', 'Reject', 'Hours look wrong'); });
  expect(task('I1').stage).toBe('Rejected');
  const dave = api.checklists.find((c) => c.person === 'Dave K.');
  expect(dave.steps.post2).toBeUndefined();
  expect(dave.steps.pre1).toBeDefined();
});

test('an OH&S concern raises an issue', () => {
  mount();
  const n = api.issues.length;
  expect(step('I1', 'Dave K.', 'pre1', { briefed: true, ohsConcern: 'Yes', ohsDetail: '' })).toMatch(/Describe/);
  expect(step('I1', 'Dave K.', 'pre1', { briefed: true, ohsConcern: 'Yes', ohsDetail: 'Loose scaffold on level 2' })).toBe('');
  expect(api.issues.length).toBe(n + 1);
  expect(api.issues[0]).toMatchObject({ taskId: 'I1', department: 'Install', priority: 'High' });
});

test('the team leader cannot finish the briefing while the SWMS is unsigned', () => {
  mount();
  // I4 is a VE Install whose SWMS is still waiting for the PM.
  expect(step('I4', 'Luke M.', 'pre1', { briefed: true })).toMatch(/SWMS/);
  expect(task('I4').stage).toBe('Scheduled');
});

test('task actions: hold, release, cancel, not used, reset, close and subtask', () => {
  mount();
  act(() => { api.runTaskAction('I2', 'hold', 'Client delay'); });
  expect(task('I2').stage).toBe('On Hold');
  act(() => { api.runTaskAction('I2', 'release'); });
  expect(task('I2').stage).toBe('Scheduled');

  let ok;
  act(() => { ok = api.runTaskAction('I2', 'reset', ''); });
  expect(ok).toBe(false); // a reason is required
  act(() => { api.runTaskAction('I2', 'reset', 'Wrong crew'); });
  expect(task('I2')).toMatchObject({ stage: 'Awaiting Scheduling', leader: '', member: '' });

  act(() => { api.runTaskAction('I5', 'notUsed', 'Client cancelled the wrap'); });
  expect(task('I5').stage).toBe('Complete - Not Used');

  act(() => { api.runTaskAction('I7', 'close'); }); // External Install
  expect(task('I7').stage).toBe('Completed');

  const n = api.tasks.length;
  act(() => { api.createSubtask('I1'); });
  expect(api.tasks.length).toBe(n + 1);
  expect(api.tasks[0]).toMatchObject({ name: 'Wayfinding L1-L2 - Subtask', type: 'VE Subtask', stage: 'Awaiting Scheduling', parentId: 'I1', quoted: 0 });
});
