import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import HoursPage from './HoursPage';
import CalendarPage from './CalendarPage';
import InstallDashboard from './InstallDashboard';
import MyDay from './MyDay';
import FabDashboard from './FabDashboard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (text, scope = document) => [...scope.querySelectorAll('button, a')].find((b) => b.textContent.trim().startsWith(text));
const setValue = (el, value) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const show = (ui, path = '/') => act(() => root.render(<DemoProvider><Probe /><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></DemoProvider>));

test('Booked hours has pay-period buttons and opens on the period named in the link', () => {
  show(<HoursPage />, '/hours?period=lastPay');
  const periods = [...document.querySelectorAll('[aria-label="Period"] button')];
  expect(periods.map((b) => b.textContent.trim())).toEqual(['This week', 'Last week', 'Last 8 days', 'This pay period', 'Last pay period']);
  expect(periods.find((b) => b.getAttribute('aria-selected') === 'true').textContent).toBe('Last pay period');
});

test('the weekly roll-up shows daily hours, workshop in the total, and a total row', () => {
  show(<HoursPage />);
  click(btn('Weekly roll-up'));
  const head = [...document.querySelectorAll('thead th')].map((th) => th.textContent);
  expect(head).toEqual(expect.arrayContaining(['Worker', 'Fab', 'Install', 'Workshop', 'Total', 'Unbilled', 'Final']));
  expect(head.length).toBe(14);
  expect(document.body.textContent).toContain('Download CSV');
  const label = () => document.querySelector('.cal-label').textContent;
  const before = label();
  click(document.querySelector('[aria-label="Previous week"]'));
  expect(label()).not.toBe(before);
  expect(label()).toContain('Week of');
});

test('the calendar page has three tabs, a type filter, and hides External and Print Only by default', () => {
  show(<CalendarPage />);
  const tabs = [...document.querySelectorAll('[aria-label="Calendar"] button')].map((b) => b.textContent.trim());
  expect(tabs).toEqual(['Unified', 'Fabrication', 'Installation']);
  click(btn('Fabrication'));
  const chips = [...document.querySelectorAll('.type-chip')].map((b) => b.textContent.trim());
  expect(chips).toContain('Metal');
  click(btn('Metal'));
  expect(document.querySelector('.type-chip.on').textContent).toContain('Metal');
  expect(document.querySelector('.cal-label').textContent.length).toBeGreaterThan(3);
  click(btn('Installation'));
  expect(document.body.textContent).toContain('Include External and Print Only');
  expect(document.querySelector('.type-chip.on')).toBeNull(); // filter resets on tab change
});

test('the calendar has a day view', () => {
  show(<CalendarPage />);
  click([...document.querySelectorAll('[aria-label="Calendar view"] button')].find((b) => b.textContent === 'Day'));
  expect(document.querySelector('[aria-label="Day schedule"]')).not.toBeNull();
});

test('the install dashboard shows pay-period buttons that link to the hours page', () => {
  show(<InstallDashboard />);
  const last = btn('Booked hours last pay period');
  const cur = btn('Booked hours this pay period');
  expect(last.getAttribute('href')).toContain('/hours?period=lastPay');
  expect(cur.getAttribute('href')).toContain('/hours?period=thisPay');
});

test('fab worker: hours-not-filled tiles count workshop and other, and entering hours clears one', () => {
  localStorage.setItem('ve-role', 'fabWorker');
  show(<MyDay />);
  const tiles = document.querySelector('[aria-label="Hours not filled"]');
  expect(tiles.textContent).toContain('Hours not filled: workshop');
  const values = [...tiles.querySelectorAll('.kpi-value')].map((n) => n.textContent);
  expect(values).toEqual(['1', '1']);
  expect(document.body.textContent).toContain('My calendar');
  expect(document.body.textContent).toContain('My post-job checklists');

  const row = [...tiles.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Tidy chemical store')); // the workshop task
  click(btn('Enter hours', row));
  const modal = document.querySelector('.modal');
  click(btn('Save hours', modal)); // empty
  expect(modal.textContent).toContain('Enter the hours you worked');
  setValue(modal.querySelector('input'), '17');
  click(btn('Save hours', modal));
  expect(document.querySelector('.modal').textContent).toContain('cannot be saved');
  setValue(document.querySelector('.modal input'), '3');
  click(btn('Save hours', document.querySelector('.modal')));
  expect(document.querySelector('.modal')).toBeNull();
  expect([...document.querySelectorAll('[aria-label="Hours not filled"] .kpi-value')].map((n) => n.textContent)).toEqual(['0', '1']); // workshop cleared, one other fab task left
  expect(api.tasks.find((t) => t.id === 'F11').booked).toBe(3);
});

test('the cutoff is a setting: moving it later drops older tasks from the tiles', () => {
  localStorage.setItem('ve-role', 'fabWorker');
  show(<MyDay />);
  act(() => { api.updateSettings({ hoursCutoff: '2099-01-01' }); });
  expect([...document.querySelectorAll('[aria-label="Hours not filled"] .kpi-value')].map((n) => n.textContent)).toEqual(['0', '0']);
});

test('the 2IC dashboard shows hours last week', () => {
  localStorage.setItem('ve-role', 'ic2');
  show(<FabDashboard variant="ic2" />);
  expect(document.body.textContent).toContain('My hours last week');
});

test('the calendar is open to PM, fab manager and 2IC only', () => {
  const { canAccess } = require('../lib/access');
  expect(['pm', 'fabManager', 'ic2'].every((r) => canAccess(r, '/calendar'))).toBe(true);
  expect(['fabWorker', 'installer', 'workshop'].some((r) => canAccess(r, '/calendar'))).toBe(false);
});
