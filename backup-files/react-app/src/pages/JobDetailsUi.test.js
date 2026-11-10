import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import Job360 from './Job360';
import { byLabel, click, dialog, menuItem, openMenu, pickTab, tab } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const renderJob = (id) => act(() => root.render(
  <DemoProvider key={localStorage.getItem('ve-role')}><Probe /><MemoryRouter initialEntries={[`/jobs/${id}`]}><Routes><Route path="/jobs/:jobId" element={<Job360 />} /></Routes></MemoryRouter></DemoProvider>));
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const view = (text) => [...byLabel('Saved views').querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const rowNames = () => [...document.querySelectorAll('tbody tr td:nth-child(2) button')].map((b) => b.textContent);
const taskOf = (id) => api.tasks.find((t) => t.id === id);
const setValue = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const field = (label, scope = dialog()) => [...scope.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(label))?.querySelector('input, select, textarea');

test('one main button: "Add task" opens a menu with the four task kinds; Close job waits in More', () => {
  renderJob('J-1042');
  const primary = [...document.querySelectorAll('button')].filter((b) => b.className.includes('bg-primary text-primary-foreground shadow'));
  expect(primary.map((b) => b.textContent.trim())).toEqual(['Add task']);
  openMenu(btn('Add task'));
  ['Design task', 'Fabrication task', 'Install task', 'Minor install'].forEach((k) => expect(menuItem(k)).toBeTruthy());
});

test('saved views filter the task list, and the overdue link in the strip opens the Overdue view', () => {
  renderJob('J-1042');
  expect(rowNames()).toHaveLength(5);
  click(view('Overdue'));
  expect(rowNames()).toEqual(['Pylon panel artwork rev C', 'Pylon panel CNC cut']);
  click(view('All'));
  click([...byLabel('Progress by discipline').querySelectorAll('button')].find((b) => b.textContent === '1 overdue'));
  expect(view('Overdue').getAttribute('data-state')).toBe('on');
  click(view('Needs my action'));
  expect(rowNames()).toEqual(['Pylon spray paint']); // the PM's only action: schedule it
});

test('each row shows only its next action: Schedule for an unscheduled task', () => {
  renderJob('J-1042');
  const row = [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Pylon spray paint'));
  click(btn('Schedule', row));
  expect(document.querySelector('.modal').textContent).toContain('Schedule: Pylon spray paint');
});

test('bulk: two ticked tasks put on hold with one reason; a task that cannot be held is skipped', () => {
  renderJob('J-1042');
  click(byLabel('Select Pylon frame welding'));
  click(byLabel('Select Pylon spray paint'));
  click(byLabel('Select Pylon panel CNC cut')); // In Progress: no hold action
  expect(byLabel('Bulk actions').textContent).toContain('3 selected');
  click(btn('Put on hold', byLabel('Bulk actions')));
  expect(dialog().textContent).toContain('2 of 3 ticked tasks are affected; 1 cannot take this action');
  click([...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Put on hold'));
  expect(dialog().textContent).toContain('A comment is required.');
  setValue(dialog().querySelector('textarea'), 'Client paused the pylon');
  click([...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Put on hold'));
  expect(taskOf('F2').stage).toBe('On Hold');
  expect(taskOf('F3').stage).toBe('On Hold');
  expect(taskOf('F1').stage).toBe('In Progress');
  expect(byLabel('Bulk actions')).toBeNull();
});

test('the drawer shows one main action; approving opens the PM review form', () => {
  renderJob('J-1051');
  const d2 = api.tasks.find((t) => t.id === 'D2');
  click(btn(d2.name));
  const sheet = dialog();
  expect(sheet.textContent).toContain('Next: review the work');
  click(btn('Review and approve', sheet));
  const form = dialog();
  expect(form.textContent).toContain('Was there an OH&S incident or concern?');
  click([...form.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Approve'));
  expect(taskOf('D2').stage).toBe('Approved & Completed');
  expect(taskOf('D2').pmReview).toMatchObject({ ohs: 'No', by: 'Rachel Barnes' });
});

test('the drawer blocks Submit until the crew has closed out, and says why', () => {
  renderJob('J-1042');
  click(btn('Pylon panel CNC cut'));
  const submit = btn('Submit for approval', dialog());
  expect(submit.disabled).toBe(true);
  expect(dialog().textContent).toContain('Submit unlocks when this is done: closure for Mia T. and Sam T.');
});

test('drawer More actions: Edit task closes the drawer and opens the edit form', () => {
  renderJob('J-1042');
  click(btn('Pylon frame welding'));
  openMenu(btn('More actions', dialog()));
  click(menuItem('Edit task'));
  expect(document.querySelector('.modal').textContent).toContain('Edit task: Pylon frame welding');
});

test('wizard: a fabrication task with a crew starts Scheduled; the spec shown follows the fab type', () => {
  renderJob('J-1042');
  openMenu(btn('Add task'));
  click(menuItem('Fabrication task'));
  setValue(field('Fab type'), 'CLB');
  click(btn('Next: details', dialog()));
  expect(dialog().textContent).toContain('CLB specification');
  expect(dialog().textContent).not.toContain('CCV specification');
  click(btn('Next: people', dialog()));
  expect(dialog().textContent).toContain('Please fill the mandatory fields');
  setValue(field('Task name'), 'Pylon return edge folding');
  setValue(field('Scheduled date'), '2030-11-12');
  setValue(field('Return height'), '80');
  click(btn('Next: people', dialog()));
  setValue(field('Team leader'), 'Mia T.');
  click([...dialog().querySelectorAll('.crew-pick label')].find((l) => l.textContent === 'Sam T.').querySelector('input'));
  click(btn('Next: review', dialog()));
  expect(dialog().textContent).toContain('Mia T., Sam T.');
  click(btn('Create task', dialog()));
  const t = api.tasks.find((x) => x.name === 'Pylon return edge folding');
  expect(t).toMatchObject({ kind: 'fab', type: 'CLB', stage: 'Scheduled', leader: 'Mia T.', members: ['Sam T.'] });
  expect(t.spec.clb.return_height).toBe(80);
});

test('Quotes from CRM sit in their own tab; Profit is for admins only', () => {
  renderJob('J-1042');
  expect(tab('Profit')).toBeUndefined();
  pickTab(tab('Quotes'));
  const panel = document.querySelector('[role="tabpanel"][data-state="active"]');
  expect(panel.textContent).toContain('Main pylon');
  expect(panel.textContent).toContain('Sync from CRM');
  act(() => root.unmount()); root = createRoot(box);
  localStorage.setItem('ve-role', 'admin');
  renderJob('J-1042');
  pickTab(tab('Profit'));
  expect(document.querySelector('[role="tabpanel"][data-state="active"]').textContent).toContain('Labour cost');
});

test('the attention line appears only when something needs doing', () => {
  renderJob('J-1051');
  expect(document.body.textContent).toContain('1 task waiting for your approval');
  act(() => { api.actOnTask('D2', 'Approve', ''); });
  expect(document.body.textContent).not.toContain('waiting for your approval');
});
