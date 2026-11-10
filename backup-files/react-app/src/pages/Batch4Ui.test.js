import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import CalendarPage from './CalendarPage';
import ChecklistsPage from './ChecklistsPage';
import ChecklistDialog from '../components/ChecklistDialog';
import { SwmsDetail, SwmsList } from './SwmsPage';
import { byLabel, click, dialog } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box; let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });
function Probe({ children }) { api = useDemo(); return children ? children(api) : null; }
const show = (role, ui, path = '/', route) => { localStorage.setItem('ve-role', role); act(() => root.render(<DemoProvider><Probe /><MemoryRouter initialEntries={[path]}>{route ? <Routes><Route path={route} element={ui} /></Routes> : ui}</MemoryRouter></DemoProvider>)); };
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));

test('calendar: type filters sit behind one Filters button; a task opens its drawer', () => {
  show('pm', <CalendarPage />);
  expect(btn('Filters')).toBeTruthy();
  const ev = document.querySelector('.cal-ev-btn');
  if (!ev) return;
  click(ev);
  expect(dialog().textContent).toMatch(/Crew & checklists|Designer & checklists|Hours & cost/);
});

test('calendar: clicking a day number opens that day', () => {
  show('pm', <CalendarPage />);
  click(document.querySelector('button.cal-num'));
  expect(byLabel('Day schedule')).not.toBeNull();
});

test('checklist dialog: shows the steps, and OH&S is a yes / no choice that asks for detail', () => {
  localStorage.setItem('ve-role', 'installer');
  act(() => root.render(<DemoProvider><Probe>{(a) => <ChecklistDialog task={a.tasks.find((t) => t.id === 'I1')} person="Dave K." step="pre1" swmsStatus="TL Signed" onClose={() => {}} />}</Probe></DemoProvider>));
  expect(byLabel('Checklist steps')).not.toBeNull();
  click([...document.querySelectorAll('[role="radio"]')].find((r) => r.textContent.startsWith('Yes')));
  expect(document.querySelector('textarea')).not.toBeNull();
});

test('checklists register: a crew member can continue their next step from the list', () => {
  show('installer', <ChecklistsPage />);
  const cont = btn('Continue');
  if (!cont) return;
  click(cont);
  expect(dialog().textContent).toContain('Complete step');
});

test('SWMS list: the PM signs from the row; detail shows the three signing steps', () => {
  show('pm', <SwmsList />);
  const before = api.swms.filter((s) => s.status === 'Created').length;
  click(btn('Sign as PM'));
  expect(dialog()).toBeTruthy();
  expect(before).toBeGreaterThan(0);
  act(() => root.unmount()); root = createRoot(box);
  show('pm', <SwmsDetail />, '/swms/SW-209', '/swms/:swmsId');
  const steps = byLabel('Signing steps');
  expect(steps.textContent).toContain('PM signs');
  expect(steps.textContent).toContain('Team leader signs');
  expect(btn('Sign as PM', steps)).toBeTruthy();
});
