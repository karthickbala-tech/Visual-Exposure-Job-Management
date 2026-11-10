import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider } from '../context/DemoContext';
import { WorkersPage } from './WorkersPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const tab = (label) => [...document.querySelectorAll('[role="tab"]')].find((b) => b.textContent.trim().startsWith(label));
const tile = (label) => [...document.querySelectorAll('[aria-label="Compliance summary"] .kpi')].find((k) => k.textContent.includes(label));
const value = (label) => tile(label).querySelector('.kpi-value').textContent;

test('the compliance summary shows VE and non-VE counts, expired, expires today and within 30 days', () => {
  act(() => root.render(<DemoProvider><MemoryRouter><WorkersPage /></MemoryRouter></DemoProvider>));
  ['Active VE workers', 'Active non-VE workers', 'Expired', 'Expires today', 'Within 30 days', 'Not filled in'].forEach((l) => expect(tile(l)).toBeTruthy());
  expect(value('Active VE workers')).toBe('8'); // includes the designer, Anitha Rao
  expect(value('Active non-VE workers')).toBe('3'); // Pat Nguyen is inactive
});

test('the All toggle brings back the inactive worker', () => {
  act(() => root.render(<DemoProvider><MemoryRouter><WorkersPage /></MemoryRouter></DemoProvider>));
  click(tab('All'));
  expect(value('Non-VE workers')).toBe('4');
  click(tab('Active only'));
  expect(value('Active non-VE workers')).toBe('3');
});
