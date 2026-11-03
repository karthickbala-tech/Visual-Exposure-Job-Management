import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoProvider, useDemo } from '../context/DemoContext';
import ApprovalPanel from '../components/ApprovalPanel';
import ChecklistDialog from '../components/ChecklistDialog';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe({ children }) { api = useDemo(); return children(api); }
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const setValue = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});

test('PM review: approving records the OH&S answer, the flag and the rating', () => {
  act(() => root.render(<DemoProvider><Probe>{(a) => <ApprovalPanel task={a.tasks.find((t) => t.id === 'I8')} />}</Probe></DemoProvider>));
  click(btn('Review and approve'));
  const modal = document.querySelector('.modal') || document.body;
  expect(modal.textContent).toContain('Was there an OH&S incident or concern?');
  expect(modal.querySelector('select').value).toBe('No'); // default No (INS-5)
  setValue(modal.querySelector('select'), 'Yes');
  click(modal.querySelector('input[type=checkbox]'));
  setValue(modal.querySelector('input[type=number]'), '9');
  click(btn('Approve', modal));
  const t = api.tasks.find((x) => x.id === 'I8');
  expect(t.stage).toBe('Completed');
  expect(t.pmReview).toMatchObject({ ohs: 'Yes', mgmtReview: true, tlRating: 9 });
  expect(box.textContent).toContain('Stage history');
});

test('manager actions: hold needs a reason, then the task goes on hold', () => {
  act(() => root.render(<DemoProvider><Probe>{(a) => <ApprovalPanel task={a.tasks.find((t) => t.id === 'I2')} />}</Probe></DemoProvider>));
  click(btn('Put on hold'));
  click(btn('Put on hold', document.querySelector('.modal') || document.body));
  expect(document.body.textContent).toContain('A comment is required.');
  setValue(document.querySelector('textarea'), 'Client delay');
  click([...document.querySelectorAll('button')].filter((b) => b.textContent.trim() === 'Put on hold').pop());
  expect(api.tasks.find((t) => t.id === 'I2').stage).toBe('On Hold');
});

test('checklist dialog: shows the SWMS block and saves the step when met', () => {
  localStorage.setItem('ve-role', 'installer');
  act(() => root.render(<DemoProvider><Probe>{(a) => <ChecklistDialog task={a.tasks.find((t) => t.id === 'I1')} person="Dave K." step="pre1" swmsStatus="PM Signed" onClose={() => {}} />}</Probe></DemoProvider>));
  expect(document.body.textContent).toContain('must be signed by the PM and then the team leader');
  click(document.querySelector('input[type=checkbox]'));
  click(btn('Complete step'));
  expect(document.body.textContent).toContain('SWMS must be signed');
  expect(api.checklists.length).toBe(0);
});
