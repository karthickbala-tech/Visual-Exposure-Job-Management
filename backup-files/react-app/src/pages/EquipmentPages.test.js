import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoProvider } from '../context/DemoContext';
import EquipmentPage from './EquipmentPage';
import DevicesPage from './DevicesPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
beforeEach(() => {
  localStorage.setItem('ve-role', 'fabManager');
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
});
afterEach(() => { act(() => root.unmount()); box.remove(); localStorage.clear(); });

const render = (ui) => act(() => root.render(<DemoProvider>{ui}</DemoProvider>));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const byText = (sel, text) => [...box.querySelectorAll(sel)].find((e) => e.textContent.trim() === text);
const rowOf = (text) => [...box.querySelectorAll('tbody tr')].find((r) => r.textContent.includes(text));
const type = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});

test('equipment: a Fab Manager sees the register and can mark a check done', () => {
  render(<EquipmentPage />);
  expect(box.textContent).toContain('VE - 101');
  const row = rowOf('VE - 101');
  expect(row.textContent).toContain('days late');
  click([...row.querySelectorAll('button')].find((b) => b.textContent === 'Mark checked'));
  expect(rowOf('VE - 101').textContent).not.toContain('days late');
});

test('equipment: off hire hides the check button and returns on service', () => {
  render(<EquipmentPage />);
  click([...rowOf('VE - 102').querySelectorAll('button')].find((b) => b.textContent === 'Off hire'));
  const row = rowOf('VE - 102');
  expect(row.textContent).toContain('Back in service');
  expect(row.textContent).not.toContain('Mark checked');
});

test('equipment: a new item gets the next tool code', () => {
  render(<EquipmentPage />);
  click(byText('button', 'Add equipment'));
  type(box.ownerDocument.querySelector('.modal input'), 'Band saw');
  click([...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Add equipment'));
  expect(document.body.textContent).toContain('VE - 111');
});

test('chemicals: a javascript: SDS link is rejected', () => {
  render(<EquipmentPage />);
  click(byText('button', 'Chemicals'));
  click(byText('button', 'Add chemical'));
  const inputs = document.querySelectorAll('.modal input');
  type(inputs[0], 'Test solvent');
  type(document.querySelector('.modal input[placeholder="https://"]'), 'javascript:alert(1)');
  click([...document.querySelectorAll('.modal button')].find((b) => b.textContent === 'Add chemical'));
  expect(document.querySelector('.modal .form-error').textContent).toContain('http');
  expect(document.body.textContent).not.toContain('Test solvent ·');
});

test('locations: a location that still holds items cannot be deleted', () => {
  render(<EquipmentPage />);
  click(byText('button', 'Workshop locations'));
  click([...rowOf('Main bay').querySelectorAll('button')].find((b) => b.textContent === 'Delete'));
  expect(rowOf('Main bay')).toBeTruthy();
});

test('equipment: a worker role without edit rights gets no add button', () => {
  localStorage.setItem('ve-role', 'ic2');
  render(<EquipmentPage />);
  expect(byText('button', 'Add equipment')).toBeUndefined();
  expect(box.textContent).toContain('View only');
});

test('devices: the workers filter splits workers with and without a device', () => {
  render(<DevicesPage />);
  click([...box.querySelectorAll('button')].find((b) => b.textContent.startsWith('Workers without a device')));
  expect(rowOf('Ravi Singh')).toBeTruthy();
  expect(rowOf('Rachel Barnes')).toBeUndefined();
  click([...box.querySelectorAll('button')].find((b) => b.textContent.startsWith('Workers with devices')));
  expect(rowOf('Rachel Barnes')).toBeTruthy();
  expect(rowOf('Ravi Singh')).toBeUndefined();
});

test('devices: the map plots only devices that reported a location', () => {
  render(<DevicesPage />);
  click(byText('button', 'Map'));
  expect(box.querySelectorAll('svg .pin').length).toBe(5);
});
