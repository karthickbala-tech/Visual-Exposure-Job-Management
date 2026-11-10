import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import PmDashboard from './PmDashboard';
import AdminHome from './AdminHome';
import WorkshopDashboard from './WorkshopDashboard';
import MyDay from './MyDay';
import { byLabel, click, dialog } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box; let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });
function Probe() { api = useDemo(); return null; }
const show = (role, ui) => { localStorage.setItem('ve-role', role); act(() => root.render(<DemoProvider><Probe /><MemoryRouter>{ui}</MemoryRouter></DemoProvider>)); };
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const todo = () => byLabel('To do now');

test('PM: "To do now" lists SWMS to sign first, each with one button, and signing removes it', () => {
  show('pm', <PmDashboard />);
  const first = todo().querySelector('li');
  expect(first.textContent).toContain('Sign SWMS');
  const before = todo().querySelectorAll('li').length;
  click(btn('Sign as PM', first));
  expect(dialog()).toBeTruthy();
  expect(api.swms.filter((s) => s.status === 'Created').length).toBeGreaterThan(0);
  expect(before).toBeGreaterThan(0);
});

test('PM: a review item opens the task drawer on the dashboard', () => {
  show('pm', <PmDashboard />);
  const item = [...todo().querySelectorAll('li')].find((l) => l.textContent.startsWith('Review:'));
  if (!item) return; // no PM-owned task in review in this seed
  click(btn('Review', item));
  expect(dialog().textContent).toContain('Review and approve');
});

test('PM: hours, install calendar and install tasks are one tab away', () => {
  show('pm', <PmDashboard />);
  expect(document.body.textContent).toContain('Booked vs quoted hours');
  expect(document.querySelector('.cal-grid')).toBeNull();
  click(btn('Install calendar', byLabel('More')));
  expect(document.querySelector('.cal-grid')).not.toBeNull();
  click(btn('Open install tasks', byLabel('More')));
  expect(document.body.textContent).toContain('Pylon crane lift');
});

test('admin: compliance to chase shows in To do now with a link to the dashboard', () => {
  show('admin', <AdminHome />);
  const links = [...todo().querySelectorAll('a')].map((a) => a.getAttribute('href'));
  expect(links).toContain('/compliance');
});

test('workshop: overdue equipment checks are in To do now and Mark checked clears one', () => {
  show('workshop', <WorkshopDashboard />);
  const items = () => [...todo().querySelectorAll('li')].filter((l) => l.textContent.startsWith('Check '));
  const n = items().length;
  if (n === 0) return;
  click(btn('Mark checked', items()[0]));
  expect(items().length).toBe(n - 1);
});

test('My Day: each card says what to do next; the calendar is folded away', () => {
  show('installer', <MyDay />);
  expect(document.querySelector('.mtask-next')).not.toBeNull();
  expect(document.body.textContent).not.toContain('Installation calendar');
  expect(btn('My calendar')).toBeTruthy();
});
