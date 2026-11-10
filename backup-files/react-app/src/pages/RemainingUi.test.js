import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import Job360 from './Job360';
import DesignPage from './DesignPage';
import FabDashboard from './FabDashboard';
import { SwmsList } from './SwmsPage';
import { WorkerDetail } from './WorkersPage';
import { crewOf, nextStep } from '../lib/checklists';
import { crewFields, crewOptions, membersOf } from '../lib/people';
import { signGroups } from '../lib/jobSites';
import { seedWorkers } from '../data/workersSeed';
import { byLabel, dialog, menuItem, openMenu, pickTab, tab } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const as = (roleId) => localStorage.setItem('ve-role', roleId);
const show = (ui, path = '/', route = null) => act(() => root.render(
  <DemoProvider key={localStorage.getItem('ve-role')}><Probe /><MemoryRouter initialEntries={[path]}>{route ? <Routes><Route path={route} element={ui} /></Routes> : ui}</MemoryRouter></DemoProvider>));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const modal = () => document.querySelector('.modal');
const setValue = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const labelled = (text, scope = modal()) => [...scope.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(text))?.querySelector('input, select, textarea');
const taskOf = (id) => api.tasks.find((t) => t.id === id);
const byName = (name) => api.tasks.find((t) => t.name === name);

// ---------- pure helpers ----------
test('crews: one leader plus any number of members, old single-member records still read', () => {
  expect(membersOf({ member: 'Sam T.' })).toEqual(['Sam T.']);
  expect(membersOf({ members: ['Jo P.', 'Sam T.'], member: 'Jo P.' })).toEqual(['Jo P.', 'Sam T.']);
  expect(crewFields('Dave K.', ['Dave K.', 'Sam T.', 'Sam T.', 'Jo P.'])).toEqual({ leader: 'Dave K.', members: ['Sam T.', 'Jo P.'], member: 'Sam T.' });
  expect(crewOf({ kind: 'install', leader: 'Dave K.', members: ['Sam T.', 'Jo P.'] })).toEqual(['Dave K.', 'Sam T.', 'Jo P.']);
  expect(crewOf({ kind: 'design', owner: 'Anitha R.', leader: 'ignored' })).toEqual(['Anitha R.']);
});

test('crew pickers come from active workers in the register', () => {
  const install = crewOptions(seedWorkers, 'install');
  expect(install).toEqual(expect.arrayContaining(['Dave K.', 'Luke M.', 'Ravi S.']));
  expect(install).not.toContain('Pat N.'); // inactive
  expect(install).not.toContain('Rachel B.'); // project manager
  const fab = crewOptions(seedWorkers, 'fab', ['Old N.']);
  expect(fab).toEqual(expect.arrayContaining(['Mia T.', 'Tom H.', 'Sam T.', 'Jo P.', 'Kim H.', 'Old N.']));
});

test('sign groups count signs and pieces in first-seen order', () => {
  expect(signGroups([{ group: 'Pylons', qty: 1 }, { group: 'Directional', qty: 6 }, { group: 'Pylons', qty: 2 }]))
    .toEqual([{ name: 'Pylons', signs: 2, pieces: 3 }, { name: 'Directional', signs: 1, pieces: 6 }]);
});

test('design checklists: brief check while In Progress, hand-off once Open', () => {
  const t = { kind: 'design', owner: 'Anitha R.', stage: 'In Progress' };
  expect(nextStep(t, null).step).toBe('pre1');
  expect(nextStep({ ...t, stage: 'Open' }, { steps: { pre1: {} } }).step).toBe('post2');
  expect(nextStep({ ...t, stage: 'Assigned' }, null).message).toMatch(/Start the task/);
  expect(nextStep({ ...t, stage: 'Reopen' }, { steps: { pre1: {} } }).step).toBe('post2');
});

// ---------- design flow, end to end ----------
test('a PM creates an unassigned design task, assigns it, and the designer takes it to approval', () => {
  as('pm');
  show(<Job360 />, '/jobs/J-1042', '/jobs/:jobId');
  openMenu(btn('Add task'));
  click(menuItem('Design task'));
  click(btn('Next: details', dialog()));
  setValue(labelled('Task name', dialog()), 'Pylon proof rev D');
  setValue(labelled('Required finish', dialog()), '2030-05-01');
  click(btn('Next: people', dialog()));
  expect(labelled('Designer', dialog()).value).toBe(''); // "Assign later"
  click(btn('Next: review', dialog()));
  expect(dialog().textContent).toContain('To be Assigned');
  click(btn('Create task', dialog()));
  const created = byName('Pylon proof rev D');
  expect(created).toMatchObject({ stage: 'To be Assigned', owner: '' });
  expect(document.body.textContent).not.toContain('undefined');

  act(() => { expect(api.assignDesign(created.id, 'Anitha R.')).toBe(true); });
  expect(taskOf(created.id)).toMatchObject({ stage: 'Assigned', owner: 'Anitha R.' });
  act(() => { expect(api.actOnTask(created.id, 'Start')).toBe(true); });
  expect(taskOf(created.id).stage).toBe('In Progress');

  // Submit is not offered before the checklists are done
  act(() => { expect(api.actOnTask(created.id, 'Submit for approval')).toBe(false); });
  act(() => { expect(api.completeChecklistStep(created.id, 'Anitha R.', 'pre1', { briefRead: true })).toMatch(/source files/); });
  act(() => { expect(api.completeChecklistStep(created.id, 'Anitha R.', 'pre1', { briefRead: true, filesChecked: true })).toBe(''); });
  expect(taskOf(created.id).stage).toBe('Open');
  act(() => { expect(api.completeChecklistStep(created.id, 'Anitha R.', 'post2', { hours: 3, filesSaved: true, proofSent: true })).toBe(''); });
  expect(taskOf(created.id)).toMatchObject({ stage: 'Awaiting Submission', booked: 3 });
  act(() => { expect(api.actOnTask(created.id, 'Submit for approval')).toBe(true); });
  act(() => { expect(api.actOnTask(created.id, 'Reject')).toBe(false); }); // a comment is required
  act(() => { expect(api.actOnTask(created.id, 'Reject', 'Wrong colour')).toBe(true); });
  expect(taskOf(created.id).stage).toBe('Reopen');
  act(() => { expect(api.completeChecklistStep(created.id, 'Anitha R.', 'post2', { hours: 1, filesSaved: true, proofSent: true })).toBe(''); });
  expect(taskOf(created.id).stage).toBe('Awaiting Submission');
  act(() => { api.actOnTask(created.id, 'Submit for approval'); });
  act(() => { expect(api.actOnTask(created.id, 'Approve')).toBe(true); });
  expect(taskOf(created.id).stage).toBe('Approved & Completed');
});

test('the Design board shows the new stages and the Assign button', () => {
  as('pm');
  show(<DesignPage />);
  act(() => { api.addDesignTask({ name: 'Wayfinding concept', jobId: 'J-1047', type: 'Install Plan', due: '2030-01-10' }); });
  const col = document.querySelector('section[aria-label="To be Assigned"]');
  expect(col.textContent).toContain('Wayfinding concept');
  click(btn('Assign', col));
  setValue(modal().querySelector('select'), 'Anitha R.');
  click(btn('Assign', modal()));
  expect(byName('Wayfinding concept')).toMatchObject({ stage: 'Assigned', owner: 'Anitha R.' });
  expect(document.querySelector('section[aria-label="Assigned"]').textContent).toContain('Wayfinding concept');
});

test('a designer starts an assigned task and opens the brief check from the board', () => {
  as('designer');
  show(<DesignPage />);
  act(() => { api.addDesignTask({ name: 'Letter proofs', jobId: 'J-1058', type: 'Artwork Sign Off', due: '2030-02-01', owner: 'Anitha R.' }); });
  const card = () => [...document.querySelectorAll('.dcard')].find((c) => c.textContent.includes('Letter proofs'));
  click(btn('Start', card()));
  expect(byName('Letter proofs').stage).toBe('In Progress');
  click(btn('Design brief check', card()));
  expect(modal().textContent).toContain('I read the brief');
});

test('design hold returns to the stage it was held from', () => {
  as('pm');
  show(<DesignPage />);
  act(() => { api.addDesignTask({ name: 'Hold me', jobId: 'J-1042', type: 'LED Design', due: '2030-01-01', owner: 'Anitha R.' }); });
  const id = byName('Hold me').id;
  act(() => { expect(api.runTaskAction(id, 'hold', 'Client paused')).toBe(true); });
  expect(taskOf(id)).toMatchObject({ stage: 'On Hold', heldFrom: 'Assigned' });
  act(() => { expect(api.runTaskAction(id, 'release')).toBe(true); });
  expect(taskOf(id).stage).toBe('Assigned');
});

// ---------- crews and scheduling ----------
test('scheduling a fab task with two members gives three crew; dropping one removes only their checklist', () => {
  as('fabManager');
  show(<FabDashboard />);
  act(() => { api.scheduleTask('F3', { date: '2030-03-03', leader: 'Mia T.', members: ['Sam T.', 'Jo P.'] }); });
  expect(taskOf('F3')).toMatchObject({ stage: 'Scheduled', leader: 'Mia T.', members: ['Sam T.', 'Jo P.'], member: 'Sam T.' });
  expect(crewOf(taskOf('F3'))).toHaveLength(3);
  ['Mia T.', 'Sam T.', 'Jo P.'].forEach((p) => act(() => { expect(api.completeChecklistStep('F3', p, 'pre1', { areaSafe: true, ppeChecked: true })).toBe(''); }));
  act(() => { api.updateTask('F3', { leader: 'Mia T.', members: ['Sam T.'] }); });
  const people = api.checklists.filter((c) => c.taskId === 'F3').map((c) => c.person).sort();
  expect(people).toEqual(['Mia T.', 'Sam T.']);
  // running the same schedule twice changes nothing
  act(() => { api.scheduleTask('F3', { date: '2030-03-03', leader: 'Mia T.', members: ['Sam T.'] }); });
  expect(api.checklists.filter((c) => c.taskId === 'F3')).toHaveLength(2);
});

test('the schedule form lists workers from the register and lets you tick several members', () => {
  as('fabManager');
  show(<FabDashboard />);
  click(btn('Unscheduled'));
  const row = [...document.querySelectorAll('tr')].find((r) => r.textContent.includes('Pylon spray paint'));
  click(btn('Schedule', row));
  expect(modal().querySelector('select').textContent).toContain('Kim H.'); // a subby fabricator from Workers
  setValue(modal().querySelector('input[type=date]'), '2030-04-04');
  setValue(modal().querySelector('select'), 'Mia T.');
  const tick = (name) => [...modal().querySelectorAll('.crew-pick label')].find((l) => l.textContent === name).querySelector('input');
  click(tick('Sam T.'));
  click(tick('Jo P.'));
  expect(modal().textContent).toContain('2 chosen');
  click(btn('Schedule', modal()));
  expect(taskOf('F3')).toMatchObject({ leader: 'Mia T.', members: ['Sam T.', 'Jo P.'], stage: 'Scheduled' });
});

test('fab tasks can be grouped by job and by sign group', () => {
  as('fabManager');
  show(<FabDashboard />);
  act(() => { api.updateTask('F1', { signGroup: 'Pylons' }); });
  click(btn('By job'));
  expect([...document.querySelectorAll('tr[data-group]')].map((h) => h.textContent).some((t) => t.startsWith('J-1042'))).toBe(true);
  click(btn('By sign group'));
  const heads = [...document.querySelectorAll('tr[data-group]')].map((h) => h.textContent);
  expect(heads.some((t) => t.includes('Pylons'))).toBe(true);
  expect(heads[heads.length - 1]).toMatch(/^No sign group/);
});

// ---------- edit and delete ----------
test('a task edit changes details but not booked hours, and needs the mandatory fields', () => {
  as('pm');
  show(<Job360 />, '/jobs/J-1042', '/jobs/:jobId');
  openMenu(byLabel('More for Pylon panel CNC cut'));
  click(menuItem('Edit task'));
  setValue(labelled('Task name'), '');
  click(btn('Save changes', modal()));
  expect(modal().textContent).toContain('Please fill the mandatory fields');
  setValue(labelled('Task name'), 'Pylon panel CNC cut (rev C)');
  setValue(labelled('Quoted hours'), '20');
  click(btn('Save changes', modal()));
  const t = byName('Pylon panel CNC cut (rev C)');
  expect(t).toMatchObject({ quoted: 20 });
  expect(t.history[0].text).toMatch(/Updated name, quoted/);
});

test('only an admin can delete a task with booked hours; deletes are soft', () => {
  as('pm');
  show(<FabDashboard />);
  const booked = api.tasks.find((t) => t.booked > 0);
  act(() => { expect(api.deleteTask(booked.id)).toBe(false); });
  act(() => { expect(api.deleteTask('F3', 'Not needed')).toBe(true); }); // no hours booked
  expect(taskOf('F3')).toBeUndefined();
  act(() => root.unmount()); root = createRoot(box);
  as('admin');
  show(<FabDashboard />);
  act(() => { expect(api.deleteTask(booked.id)).toBe(true); });
  expect(taskOf(booked.id)).toBeUndefined();
});

// ---------- signs ----------
test('a PM adds a sign in a new sign group and edits it', () => {
  as('pm');
  show(<Job360 />, '/jobs/J-1042', '/jobs/:jobId');
  const before = api.signs.length;
  pickTab(tab('Signs & site'));
  click(btn('Add sign'));
  setValue(labelled('Sign name'), 'Car park entry blade');
  setValue(labelled('Sign group'), '__new');
  setValue(labelled('New group name'), 'Car park');
  setValue(labelled('Quantity'), '2');
  click(btn('Add sign', modal()));
  expect(api.signs).toHaveLength(before + 1);
  expect(byLabel('Sign groups').textContent).toContain('Car park');
  click([...document.querySelectorAll('[role="tabpanel"] button')].find((b) => b.textContent.includes('Car park entry blade')));
  click(document.querySelector('button[aria-label="Edit Car park entry blade"]'));
  setValue(labelled('Install'), 'Installed');
  click(btn('Save sign', modal()));
  expect(api.signs.find((g) => g.name === 'Car park entry blade')).toMatchObject({ group: 'Car park', qty: 2, install: 'Installed' });
});

test('a viewer cannot add signs', () => {
  as('viewer');
  show(<Job360 />, '/jobs/J-1042', '/jobs/:jobId');
  pickTab(tab('Signs & site'));
  expect(btn('Add sign')).toBeUndefined();
  expect(btn('Add task')).toBeUndefined();
});

// ---------- workers ----------
test('a manager edits a worker; only an admin can change the hourly rate', () => {
  as('pm');
  show(<WorkerDetail />, '/workers/W-5', '/workers/:workerId');
  click(btn('Edit worker'));
  expect(labelled('Hourly rate')).toBeUndefined();
  setValue(labelled('Skills'), 'Install team leader, EWP, crane');
  click(btn('Save worker', modal()));
  expect(api.workers.find((w) => w.id === 'W-5').skills).toBe('Install team leader, EWP, crane');
  act(() => { api.updateWorker('W-5', { hourlyRate: 99 }); });
  expect(api.workers.find((w) => w.id === 'W-5').hourlyRate).toBe(41);
});

test('a ticket can be added for a worker who did not get it automatically', () => {
  as('admin');
  show(<WorkerDetail />, '/workers/W-8', '/workers/:workerId'); // a subby: no EWP ticket by default
  const before = api.tickets.filter((t) => t.workerId === 'W-8').length;
  click(btn('Add ticket'));
  const type = modal().querySelector('select');
  expect(type.textContent).toContain('EWP Licence');
  expect(type.textContent).not.toContain('Working at Heights'); // already has it
  setValue(type, 'TT-2');
  click(btn('Add', modal()));
  expect(api.tickets.filter((t) => t.workerId === 'W-8')).toHaveLength(before + 1);
});

// ---------- SWMS ----------
test('SWMS list has My open and My completed for the PM', () => {
  as('pm');
  show(<SwmsList />);
  const tab = (t) => [...byLabel('SWMS filter').querySelectorAll('button')].find((b) => b.textContent.startsWith(t));
  expect(tab('My open')).toBeTruthy();
  expect(tab('My completed')).toBeTruthy();
  click(tab('My open'));
  const rows = [...document.querySelectorAll('li')].filter((l) => l.querySelector('a[href^="/swms/"]')).length;
  expect(rows).toBeGreaterThan(0);
});
