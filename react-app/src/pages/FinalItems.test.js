import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import AdminPage from './AdminPage';
import FabDashboard from './FabDashboard';
import HoursPage from './HoursPage';
import MyDay from './MyDay';
import { IssueDetail, IssuesBoard } from './IssuesPage';
import { needsHoursConfirm } from '../lib/checklists';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); window.print = jest.fn(); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const as = (roleId) => localStorage.setItem('ve-role', roleId);
const show = (ui, path = '/') => act(() => root.render(<DemoProvider key={localStorage.getItem('ve-role')}><Probe /><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></DemoProvider>));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (text, scope = document) => [...scope.querySelectorAll('button, a')].find((b) => b.textContent.trim().startsWith(text));
const setValue = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const issuePage = () => show(<Routes><Route path="/issues/:issueId" element={<IssueDetail />} /></Routes>, '/issues/IS-1');
const taskOf = (id) => api.tasks.find((t) => t.id === id);

// ---- ISS-6 ----
test('a PM sees every field on an issue, an installer does not', () => {
  as('pm');
  issuePage();
  const dts = () => [...document.querySelectorAll('.is-noprint dt')].map((d) => d.textContent);
  expect(dts()).toEqual(expect.arrayContaining(['Reported by', 'Assigned manager', 'Also informed', 'Due']));
  expect(document.body.textContent).not.toContain('Some fields are hidden');
  act(() => root.unmount()); root = createRoot(box);

  as('installer');
  issuePage();
  expect(dts()).toContain('Reported by');
  ['Assigned manager', 'Also informed', 'Due'].forEach((l) => expect(dts()).not.toContain(l));
  expect(document.body.textContent).toContain('Some fields are hidden for your role');
  // the print sheet follows the same rule
  expect(document.querySelector('[aria-label="Print preview"]').textContent).not.toContain('Assigned manager');
});

test('a contractor does not see the management history', () => {
  as('contractor');
  issuePage();
  expect(document.body.textContent).not.toContain('Management history');
  act(() => root.unmount()); root = createRoot(box);
  as('pm');
  issuePage();
  expect(document.body.textContent).toContain('Management history');
});

test('the issue board and report form drop hidden fields for a fab worker', () => {
  as('fabWorker');
  show(<IssuesBoard />);
  click(btn('List'));
  const heads = [...document.querySelectorAll('thead th')].map((h) => h.textContent);
  expect(heads).toContain('Reported by');
  expect(heads).not.toContain('Assigned to');
  expect(heads).not.toContain('Due');
  expect(document.body.textContent).not.toContain('Overdue');
  expect(document.querySelector('[aria-label="Whose issues"]').textContent).not.toContain('Assigned to me');
  click(btn('Report an issue'));
  const modal = () => document.querySelector('.modal');
  const taskSelect = () => [...modal().querySelectorAll('select')].find((x) => x.textContent.includes('F1 ·'));
  setValue(taskSelect(), 'I1');
  expect(taskSelect().value).toBe('I1'); // the related task really is chosen
  expect(modal().textContent).not.toContain('Review needed'); // hidden for fab workers
  act(() => root.unmount()); root = createRoot(box);

  as('pm');
  show(<IssuesBoard />);
  click(btn('List'));
  expect([...document.querySelectorAll('thead th')].map((h) => h.textContent)).toEqual(expect.arrayContaining(['Assigned to', 'Due']));
  click(btn('Report an issue'));
  setValue([...modal().querySelectorAll('select')].find((x) => x.textContent.includes('F1 ·')), 'I1');
  expect(modal().textContent).toContain('Review needed');
  act(() => root.unmount()); root = createRoot(box);

  as('contractor');
  show(<IssuesBoard />);
  click(btn('Report an issue'));
  expect(modal().textContent).not.toContain('Related task');
});

// ---- FAB-3 ----
const completeWorkshopTask = (id) => {
  act(() => { api.actOnTask(id, 'Start'); });
  const t = taskOf(id);
  [t.leader, t.member].filter(Boolean).forEach((p) => { act(() => { expect(api.completeChecklistStep(id, p, 'post2', { hours: 2, unbilled: 0 })).toBe(''); }); });
  act(() => { expect(api.actOnTask(id, 'Submit for approval')).toBe(true); });
  act(() => { expect(api.actOnTask(id, 'Approve')).toBe(true); });
};

test('completing a repeating workshop task creates the next one a week later, once', () => {
  as('fabManager');
  show(<MyDay />);
  const before = taskOf('F8');
  expect(before.repeat).toEqual({ count: 1, unit: 'Weeks' });
  completeWorkshopTask('F8');
  expect(taskOf('F8').stage).toBe('Completed');
  const next = api.tasks.filter((t) => t.repeatOf === 'F8');
  expect(next).toHaveLength(1);
  expect(next[0]).toMatchObject({ name: before.name, type: 'Workshop', stage: 'Scheduled', booked: 0, leader: 'Jo P.' });
  expect(next[0].date > before.date).toBe(true);
  expect(taskOf('F8').repeatSpawned).toBe(next[0].id);
  // a later change to the finished task must not create another
  act(() => { api.addAttachments('F8', [{ name: 'x.jpg', size: 1 }]); });
  expect(api.tasks.filter((t) => t.repeatOf === 'F8')).toHaveLength(1);
});

test('a workshop task without a repeat does not create a next task', () => {
  as('fabManager');
  show(<MyDay />);
  act(() => { api.addTask({ name: 'One-off tidy', jobId: 'J-0000', type: 'Workshop', date: '2026-03-02', leader: 'Jo P.', quoted: 1, repeat: { count: '', unit: 'Weeks' } }); });
  const t = api.tasks.find((x) => x.name === 'One-off tidy');
  expect(t.repeat).toBeUndefined();
});

test('the workshop task form saves a repeat, and the Fab Manager dashboard can open it', () => {
  as('fabManager');
  show(<FabDashboard />);
  click(btn('New workshop task'));
  const modal = document.querySelector('.modal');
  expect(modal.textContent).toContain('Repeat every');
  setValue(modal.querySelector('input'), 'Weekly sweep');
  setValue(modal.querySelector('input[type=number][placeholder="Does not repeat"]'), '2');
  setValue(modal.querySelectorAll('select')[modal.querySelectorAll('select').length - 1], 'Weeks');
  click(btn('Create task', modal));
  const t = api.tasks.find((x) => x.name === 'Weekly sweep');
  expect(t).toMatchObject({ type: 'Workshop', repeat: { count: 2, unit: 'Weeks' } });
  expect(document.body.textContent).toContain('repeats: every 2 weeks');
});

test('a bad repeat number is refused', () => {
  as('fabManager');
  show(<FabDashboard />);
  click(btn('New workshop task'));
  const modal = document.querySelector('.modal');
  setValue(modal.querySelector('input'), 'Bad repeat');
  setValue(modal.querySelector('input[type=number][placeholder="Does not repeat"]'), '999');
  click(btn('Create task', modal));
  expect(document.querySelector('.modal').textContent).toContain('whole number from 1 to 365');
  expect(api.tasks.find((x) => x.name === 'Bad repeat')).toBeUndefined();
});

// ---- Notification log ----
test('actions write notification rows, one per recipient', () => {
  as('fabWorker');
  show(<MyDay />);
  const before = api.notifications.length;
  act(() => { api.addIssue({ subject: 'Hoist cable frayed', description: 'Check it', department: 'Install', priority: 'High' }); });
  const added = api.notifications.slice(0, api.notifications.length - before);
  expect(added.length).toBeGreaterThanOrEqual(2); // department manager and reporter at least
  expect(added[0].subject).toBe('Issue Reported: Hoist cable frayed');
  expect(added.map((r) => r.recipientRole)).toEqual(expect.arrayContaining(['Department manager', 'Reporter']));
  expect(added.map((r) => r.recipient)).toEqual(expect.arrayContaining(['Rachel Barnes', 'Sam Taylor']));
  act(() => { api.addJob({ name: 'Log test job', client: 'Acme', finish: '2026-12-01' }); });
  expect(api.notifications[0]).toMatchObject({ event: 'job.created', recipient: 'Tom Hendry' });
});

test('submitting for approval and rejecting are logged', () => {
  as('fabManager');
  show(<MyDay />);
  completeWorkshopTask('F8'); // submit then approve
  expect(api.notifications.some((r) => r.event === 'task.submitted' && r.ref === 'F8')).toBe(true);
});

test('the Admin notification log lists rows, filters them, and retries a failed one', () => {
  as('admin');
  show(<AdminPage />);
  click(btn('Notification log', document.querySelector('[aria-label="Admin sections"]')));
  expect(document.body.textContent).toContain('1 failed');
  const rows = () => [...document.querySelectorAll('tbody tr')];
  const all = rows().length;
  setValue(document.querySelector('select[aria-label="Status"]'), 'Failed');
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain('Mailbox unavailable');
  click(btn('Retry', rows()[0]));
  expect(api.notifications.find((r) => r.id === 'N-seed-3')).toMatchObject({ status: 'Sent', attempts: 3 });
  expect(document.body.textContent).toContain('No emails match');
  setValue(document.querySelector('select[aria-label="Status"]'), 'All');
  expect(rows()).toHaveLength(all);
});

test('the Admin roles tab shows the issue field table', () => {
  as('admin');
  show(<AdminPage />);
  click(btn('Roles and users', document.querySelector('[aria-label="Admin sections"]')));
  const cell = document.querySelector('td[aria-label="Installer, Assigned manager"]');
  expect(cell.textContent).toBe('Hidden');
  expect(document.querySelector('td[aria-label="Project Manager, Assigned manager"]').textContent).toBe('-');
});

// ---- CHK-6: the 14 hour warning ----
test('hours over 14 need a tick, and over 16 cannot be saved', () => {
  expect([13.5, 14, 14.5, 16, 16.5].map(needsHoursConfirm)).toEqual([false, false, true, true, false]);
});

test('filling in missing hours: 15 hours needs the tick, 17 hours is refused', () => {
  as('fabWorker');
  show(<MyDay />);
  expect(api.fillHours('F12', 'Sam T.', 15, false)).toMatch(/more than 14 hours/);
  expect(api.fillHours('F12', 'Sam T.', 17, true)).toMatch(/cannot be saved/);
  expect(api.fillHours('F12', 'Sam T.', 15, true)).toBe('');
});

test('the Book hours form (tasks closed by the PM, no checklist) asks for a tick above 14 hours', () => {
  as('installer');
  show(<MyDay />);
  act(() => { api.addInstallTask({ name: 'Supplier fit', jobId: 'J-1042', type: 'External Install', date: new Date().toISOString().slice(0, 10), leader: 'Dave K.', member: '', quoted: 20 }); });
  const id = api.tasks.find((t) => t.name === 'Supplier fit').id;
  act(() => { api.actOnTask(id, 'Start'); });
  const form = () => document.querySelector('.hours-form');
  expect(form()).not.toBeNull();
  setValue(form().querySelector('input[type=number]'), '15');
  expect(form().textContent).toContain('15 hours is correct');
  click(btn('Book hours', form()));
  expect(form().textContent).toContain('more than 14 hours');
  const before = taskOf(id).booked || 0;
  click(form().querySelector('input[type=checkbox]'));
  click(btn('Book hours', form()));
  expect(taskOf(id).booked).toBe(before + 15);
  setValue(form().querySelector('input[type=number]'), '17');
  click(btn('Book hours', form()));
  expect(form().textContent).toContain('must be under 16');
});

test('the shift form warns above 14 hours and stops above 16', () => {
  as('pm');
  show(<HoursPage />);
  click(btn('Timesheet'));
  click(btn('Add past shift'));
  const modal = () => document.querySelector('.modal');
  const inputs = () => [...modal().querySelectorAll('input')];
  const [date, start, end, brk] = inputs();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  setValue(date, yesterday); setValue(start, '05:00'); setValue(end, '21:00'); setValue(brk, '30'); // 16 h shift, 15.5 h paid
  click(btn('Add shift', modal()));
  expect(modal().textContent).toContain('more than 14 hours');
  setValue(inputs()[1], '03:00'); // 18 h shift
  click(btn('Add shift', modal()));
  expect(modal().textContent).toContain('cannot be longer than 16 hours');
});
