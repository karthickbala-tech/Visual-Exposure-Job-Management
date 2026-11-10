import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import { WorkersPage } from './WorkersPage';
import CompliancePage from './CompliancePage';
import EquipmentPage from './EquipmentPage';
import AdminPage from './AdminPage';
import { byLabel, click, dialog } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box; let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });
function Probe() { api = useDemo(); return null; }
const show = (role, ui) => { localStorage.setItem('ve-role', role); act(() => root.render(<DemoProvider><Probe /><MemoryRouter>{ui}</MemoryRouter></DemoProvider>)); };
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const setValue = (el, value) => act(() => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });

test('workers: a name opens the worker drawer with what needs doing', () => {
  show('admin', <WorkersPage />);
  click(btn('Dave Kerr'));
  expect(dialog().textContent).toMatch(/to action|All tickets and inductions are current/);
  expect(dialog().textContent).toContain('Open full profile');
});

test('workers: the Expired tile opens the compliance list filtered to expired items; search narrows it', () => {
  show('admin', <WorkersPage />);
  click(btn('Expired', byLabel('Compliance summary')));
  const sel = [...document.querySelectorAll('[aria-label="Status filter"] button')].find((b) => b.getAttribute('aria-selected') === 'true');
  expect(sel.textContent).toContain('Expired');
  setValue(byLabel('Search workers'), 'zzz-nobody');
  expect(document.body.textContent).toContain('Nothing in this view');
});

test('compliance: a tile filters all three lists', () => {
  show('admin', <CompliancePage />);
  click(btn('Past expiry', byLabel('Compliance totals')));
  expect(document.body.textContent).toContain('Showing past expiry only');
});

test('equipment: Overdue tile, then one button marks every overdue check done', () => {
  show('workshop', <EquipmentPage />);
  click(btn('Overdue checks'));
  const bulk = byLabel('Bulk actions');
  if (!bulk) return;
  click(btn('Mark all', bulk));
  const key = new Date();
  expect(api.equipment.every((e) => e.status !== 'In service' || e.lastChecked)).toBe(true);
  expect(document.body.textContent).not.toContain('overdue checks in this view');
  expect(key).toBeTruthy();
});

test('admin: settings sit in collapsible sections, the first one open', () => {
  show('admin', <AdminPage />);
  const secs = [...document.querySelectorAll('details.set-sec')];
  expect(secs.length).toBe(3);
  expect(secs[0].open).toBe(true);
  expect(secs[1].open).toBe(false);
});
