import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider } from '../context/DemoContext';
import { ThemeProvider } from '../context/ThemeContext';
import { PrefsProvider } from '../context/PrefsContext';
import Sidebar from '../components/Sidebar';
import SettingsPage from './SettingsPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); localStorage.clear(); document.documentElement.removeAttribute('data-density'); });
const show = (role, path = '/') => { localStorage.setItem('ve-role', role); act(() => root.render(
  <ThemeProvider><PrefsProvider><DemoProvider><MemoryRouter initialEntries={[path]}><Sidebar open={false} onClose={() => {}} /><SettingsPage /></MemoryRouter></DemoProvider></PrefsProvider></ThemeProvider>)); };
const btn = (t) => [...box.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent).trim().startsWith(t));
const links = () => [...box.querySelectorAll('.side-nav a')].map((a) => a.textContent.trim());
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

test('admin menu is grouped into sections; the current page opens its section', () => {
  show('admin', '/equipment');
  const groups = [...box.querySelectorAll('.side-group-btn')].map((b) => b.textContent.trim());
  expect(groups).toEqual(['Work', 'Field and safety', 'People', 'Assets']);
  expect(links()).toContain('Equipment'); // Assets is open because Equipment is the current page
  expect(links()).not.toContain('Jobs');
  click(btn('Work'));
  expect(links()).toContain('Jobs');
});

test('an installer has short sections; single pages are not wrapped in a section', () => {
  show('installer');
  expect(box.querySelectorAll('.side-group-btn').length).toBeLessThan(3);
});

test('collapse makes the menu icons only, and it is remembered', () => {
  show('admin');
  click(btn('Collapse menu'));
  expect(box.querySelector('.sidebar').classList.contains('collapsed')).toBe(true);
  expect(JSON.parse(localStorage.getItem('ve-prefs')).sidebarCollapsed).toBe(true);
});

test('settings: density, hiding a page from the menu, and reset', () => {
  show('admin', '/jobs');
  click([...box.querySelectorAll('[aria-label="Density"] button')].find((b) => b.textContent === 'Compact'));
  expect(document.documentElement.getAttribute('data-density')).toBe('compact');
  const jobs = [...box.querySelectorAll('label')].find((l) => l.textContent.startsWith('Jobs')).querySelector('input');
  click(jobs);
  expect(links()).not.toContain('Jobs');
  click(btn('Reset to defaults'));
  expect(document.documentElement.getAttribute('data-density')).toBe('default');
});
