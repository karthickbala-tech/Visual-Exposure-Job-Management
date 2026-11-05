import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import FabDashboard from './FabDashboard';
import InstallDashboard from './InstallDashboard';
import DesignPage from './DesignPage';
import { byLabel, click, dialog } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box; let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });
function Probe() { api = useDemo(); return null; }
const show = (role, ui) => { localStorage.setItem('ve-role', role); act(() => root.render(<DemoProvider><Probe /><MemoryRouter>{ui}</MemoryRouter></DemoProvider>)); };
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const view = (text) => [...byLabel('Task filter').querySelectorAll('button')].find((b) => b.textContent.startsWith(text));
const names = () => [...document.querySelectorAll('tbody tr td:nth-child(2) button')].map((b) => b.textContent);

test('fab: a KPI tile opens its saved view', () => {
  show('fabManager', <FabDashboard />);
  click(btn('Unscheduled', document.querySelector('.kpis')));
  expect(view('Unscheduled').getAttribute('data-state')).toBe('on');
  expect(names()).toContain('Pylon spray paint');
  expect([...document.querySelectorAll('tbody tr')].every((r) => r.textContent.includes('Awaiting Scheduling'))).toBe(true);
});

test('fab: clicking a task opens the task drawer, not a new page', () => {
  show('fabManager', <FabDashboard />);
  click(btn('Pylon panel CNC cut'));
  expect(dialog().textContent).toContain('Crew & checklists');
  expect(dialog().textContent).toContain('Submit for approval');
});

test('fab: the calendar is one click away instead of always on screen', () => {
  show('fabManager', <FabDashboard />);
  expect(document.body.textContent).not.toContain('Fabrication calendar');
  click(btn('Calendar', byLabel('Show')));
  expect(document.body.textContent).toContain('Fabrication calendar');
  expect(document.querySelector('tbody')).toBeNull();
});

test('install: the SWMS unsigned view lists tasks whose SWMS is not signed, with a SWMS column', () => {
  show('pm', <InstallDashboard />);
  click(view('SWMS unsigned'));
  expect(names()).toContain('Pylon crane lift');
  expect([...document.querySelectorAll('thead th')].map((t) => t.textContent)).toContain('SWMS');
});

test('install: bulk schedule needs a date and a team leader', () => {
  show('pm', <InstallDashboard />);
  const first = [...document.querySelectorAll('tbody tr')][0];
  click(first.querySelector('[role="checkbox"]'));
  click(btn('Schedule crew and date', byLabel('Bulk actions')));
  click([...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Schedule crew and date'));
  expect(dialog().textContent).toMatch(/A date and a team leader are required|cannot take this action/);
});

test('design: the list view uses the shared task list and opens the drawer', () => {
  show('pm', <DesignPage />);
  click(btn('List', byLabel('View')));
  click(btn('Pylon panel artwork rev C'));
  expect(dialog().textContent).toContain('Designer & checklists');
});
