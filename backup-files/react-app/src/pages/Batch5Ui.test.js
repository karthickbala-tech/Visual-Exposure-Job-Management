import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import { IssuesBoard } from './IssuesPage';
import HoursPage from './HoursPage';
import { byLabel, click, dialog } from '../testUi';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root; let box; let api;
beforeEach(() => { box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });
function Probe() { api = useDemo(); return null; }
const show = (role, ui) => { localStorage.setItem('ve-role', role); act(() => root.render(<DemoProvider><Probe /><MemoryRouter>{ui}</MemoryRouter></DemoProvider>)); };
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));

test('issues: a board card opens the issue drawer, and managers can add an update there', () => {
  show('pm', <IssuesBoard />);
  click(document.querySelector('button.kcard'));
  const d = dialog();
  expect(d.textContent).toContain('Open the full issue');
  click(btn('Add an update', d));
  expect(d.textContent).toContain('Next step');
});

test('issues: the High priority tile shows only open high-priority issues', () => {
  show('pm', <IssuesBoard />);
  click(btn('High priority', document.querySelector('.kpis')));
  const cards = [...document.querySelectorAll('button.kcard')];
  expect(cards.length).toBe(api.issues.filter((i) => i.priority === 'High' && i.status !== 'Completed').length);
});

test('hours: for managers, the full entry list is folded away below the summary', () => {
  show('pm', <HoursPage />);
  expect(document.body.textContent).toContain('Hours by worker');
  expect(btn('Every entry in this period')).toBeTruthy();
});
