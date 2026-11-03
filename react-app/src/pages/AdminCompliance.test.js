import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider } from '../context/DemoContext';
import AdminPage from './AdminPage';
import CompliancePage from './CompliancePage';
import { IssueDetail } from './IssuesPage';
import RoleHome from './RoleHome';
import { setExpiryDays } from '../lib/compliance';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
beforeEach(() => {
  box = document.createElement('div');
  document.body.appendChild(box);
  root = createRoot(box);
  window.print = jest.fn();
});
afterEach(() => { act(() => root.unmount()); box.remove(); localStorage.clear(); setExpiryDays(30); });

const as = (roleId) => localStorage.setItem('ve-role', roleId);
const render = (ui, path = '/') => act(() => root.render(<DemoProvider key={localStorage.getItem('ve-role')}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></DemoProvider>));
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const byText = (sel, text) => [...box.querySelectorAll(sel)].find((e) => e.textContent.trim() === text);
const byLabel = (text) => [...box.querySelectorAll('label')].find((l) => l.textContent.trim().startsWith(text))?.querySelector('input,select,textarea');
const type = (el, value) => act(() => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});
const kpi = (label) => [...box.querySelectorAll('.kpi')].find((k) => k.querySelector('.kpi-label').textContent === label)?.querySelector('.kpi-value').textContent;

test('compliance dashboard: tile counts match the rows, and the Past expiry filter narrows them', () => {
  as('admin');
  render(<CompliancePage />);
  const past = Number(kpi('Past expiry'));
  expect(past).toBeGreaterThan(0);
  click(byText('[role=tab]', 'Past expiry'));
  const chips = [...box.querySelectorAll('tbody .chip')].map((c) => c.textContent);
  expect(chips.length).toBe(past);
  expect(new Set(chips)).toEqual(new Set(['Expired']));
});

test('compliance dashboard: the active-only toggle is on by default and switches to all', () => {
  as('admin');
  render(<CompliancePage />);
  expect(byText('button', 'Active only').getAttribute('aria-pressed')).toBe('true');
  click(byText('button', 'All'));
  expect(byText('button', 'All').getAttribute('aria-pressed')).toBe('true');
});

test('admin: the expiry warning saved in Admin changes the Compliance dashboard', () => {
  as('admin');
  render(<><AdminPage /><CompliancePage /></>);
  const before = kpi('Within 30 days');
  expect(before).toBeDefined();
  type(byLabel('Expiry warning'), '5');
  click(byText('button', 'Save settings'));
  expect(kpi('Within 5 days')).toBeDefined();
  expect(Number(kpi('Within 5 days'))).toBeLessThanOrEqual(Number(before));
});

test('admin: a bad value is refused and nothing is saved', () => {
  as('admin');
  render(<><AdminPage /><CompliancePage /></>);
  type(byLabel('Expiry warning'), '0');
  click(byText('button', 'Save settings'));
  expect(box.querySelector('[role=alert]').textContent).toMatch(/expiry warning/i);
  expect(kpi('Within 30 days')).toBeDefined();
});

test('admin: a mail template can be edited and saved', () => {
  as('admin');
  render(<AdminPage />);
  click(byText('[role=tab]', 'Mail templates'));
  click(box.querySelector('button[aria-label^="Edit template: New job created"]'));
  type(document.querySelector('input[autofocus], .modal input') || byLabel('Subject'), 'Brand new job: {job}');
  click([...document.querySelectorAll('button')].find((b) => b.textContent === 'Save template'));
  expect(box.textContent).toContain('Brand new job: {job}');
});

test('admin: primary roles can be added, and a role in use cannot be removed', () => {
  as('admin');
  render(<AdminPage />);
  click(byText('[role=tab]', 'Roles and users'));
  type(box.querySelector('input[aria-label="New primary role"]'), 'Estimator');
  click(byText('button', 'Add'));
  expect(box.textContent).toContain('Estimator');
  expect(box.querySelector('button[aria-label="Remove Workshop"]').disabled).toBe(true);
  expect(box.querySelector('button[aria-label="Remove Estimator"]').disabled).toBe(false);
});

test('role homes: Admin, Install Coordinator, Designer and Viewer each get a real screen', () => {
  const heading = (role) => { as(role); render(<RoleHome />); return box.querySelector('h1').textContent; };
  expect(heading('admin')).toContain("Karen Wells's home");
  expect(heading('installCoordinator')).not.toContain('next screen to build');
  expect(heading('designer')).not.toContain('next screen to build');
  expect(heading('viewer')).toBe('All jobs');
  expect(byText('button', 'New job')).toBeUndefined();
});

const issue = (id) => (
  <Routes><Route path="/issues/:issueId" element={<IssueDetail />} /></Routes>
);

test('issues: a manager can create a CRM deal once, on a Management issue', () => {
  as('admin');
  render(issue(), '/issues/IS-4');
  const btn = byText('button', 'Create CRM deal');
  expect(btn).toBeDefined();
  click(btn);
  expect(box.textContent).toMatch(/CRM deal DEAL-/);
  expect(byText('button', 'Create CRM deal')).toBeUndefined();
  expect(box.textContent).toContain('CRM deal created');
});

test('issues: no CRM deal button on an Install issue for a Viewer', () => {
  as('viewer');
  render(issue(), '/issues/IS-1');
  expect(byText('button', 'Create CRM deal')).toBeUndefined();
});

test('issues: the print layout follows the department, can be changed, and prints', () => {
  as('pm');
  render(issue(), '/issues/IS-2');
  const sheet = () => box.querySelector('.is-sheet').textContent;
  expect(sheet()).toContain('Civic Billboards issue report');
  expect(sheet()).toContain('Billboard');
  type(box.querySelector('select[aria-label="Print layout"]'), 'summary');
  expect(sheet()).toContain('Issue summary');
  expect(sheet()).not.toContain('Management history');
  click(byText('button', 'Print or save as PDF'));
  expect(window.print).toHaveBeenCalled();
});

test('guard and sidebar: Admin and Compliance show only for Admin, and others are turned away', () => {
  const Guard = require('../components/Guard').default;
  const Sidebar = require('../components/Sidebar').default;
  const tree = (
    <Routes>
      <Route element={<><Sidebar open={false} onClose={() => {}} /><Guard /></>}>
        <Route path="admin" element={<p>ADMIN SCREEN</p>} />
      </Route>
    </Routes>
  );
  as('pm');
  render(tree, '/admin');
  expect(box.textContent).toContain('This page is not part of your role');
  expect(box.textContent).not.toContain('ADMIN SCREEN');
  expect(byText('a', 'Admin')).toBeUndefined();
  as('admin');
  render(tree, '/admin');
  expect(box.textContent).toContain('ADMIN SCREEN');
  expect(byText('a', 'Admin')).toBeDefined();
  expect(byText('a', 'Compliance')).toBeDefined();
});
