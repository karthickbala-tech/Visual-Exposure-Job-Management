import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DemoProvider, useDemo } from '../context/DemoContext';
import Job360 from './Job360';
import JobsPage from './JobsPage';
import ApprovalPanel from '../components/ApprovalPanel';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let box;
let api;
beforeEach(() => { localStorage.setItem('ve-role', 'pm'); box = document.createElement('div'); document.body.appendChild(box); root = createRoot(box); });
afterEach(() => { act(() => root.unmount()); box.remove(); document.body.innerHTML = ''; localStorage.clear(); });

function Probe() { api = useDemo(); return null; }
const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const btn = (text, scope = document) => [...scope.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(text));
const jobOf = (id) => api.allJobs.find((j) => j.id === id);
const taskOf = (id) => api.tasks.find((t) => t.id === id);

const renderJob = (id) => act(() => root.render(
  <DemoProvider><Probe /><MemoryRouter initialEntries={[`/jobs/${id}`]}><Routes><Route path="/jobs/:jobId" element={<Job360 />} /></Routes></MemoryRouter></DemoProvider>));
const renderJobs = () => act(() => root.render(<DemoProvider><Probe /><MemoryRouter><JobsPage /></MemoryRouter></DemoProvider>));

test('Job Details shows KPI blocks and the fab finish dates', () => {
  renderJob('J-1042');
  const kpis = document.querySelector('[aria-label="Job KPIs"]');
  expect(kpis.textContent).toContain('Management and design');
  expect(kpis.textContent).toContain('Fabrication');
  expect(kpis.textContent).toContain('Installation');
  expect(document.body.textContent).toContain('Fab finish required');
  expect(document.body.textContent).toContain('Fab finish agreed');
  const fab = [...kpis.querySelectorAll('.job-kpi')].find((n) => n.textContent.includes('Fabrication'));
  expect(fab.textContent).toContain('Total3'); // F1, F2, F3
});

test('Close job is disabled below 100% and works at 100% for a Project Manager', () => {
  renderJob('J-1042');
  expect(btn('Close job').disabled).toBe(true);
  act(() => root.unmount()); root = createRoot(box);

  renderJob('J-1039');
  const close = btn('Close job');
  expect(close.disabled).toBe(false);
  click(close);
  click([...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === 'Close job'));
  expect(jobOf('J-1039').stage).toBe('Completed - Closed');
  expect(jobOf('J-1039').closureEmailSent).toBe(true);
  expect(document.body.textContent).toContain('Closed');
  expect(btn('Close job')).toBeUndefined();
});

test('only a Project Manager can close a job', () => {
  localStorage.setItem('ve-role', 'fabManager');
  renderJob('J-1039');
  expect(btn('Close job').disabled).toBe(true);
  act(() => { api.closeJob('J-1039'); });
  expect(jobOf('J-1039').stage).toBe('Completed');
});

test('a closed job refuses new tasks', () => {
  renderJob('J-1039');
  act(() => { api.closeJob('J-1039'); });
  const before = api.tasks.length;
  act(() => { expect(api.addTask({ name: 'Late task', jobId: 'J-1039', type: 'Metal', date: '2030-01-01' })).toBe(false); });
  act(() => { expect(api.addInstallTask({ name: 'Late install', jobId: 'J-1039', type: 'VE Install', date: '2030-01-01' })).toBe(false); });
  act(() => { expect(api.addDesignTask({ name: 'Late design', jobId: 'J-1039', type: 'Artwork', owner: 'Anitha R.', due: '2030-01-01' })).toBe(false); });
  expect(api.tasks.length).toBe(before);
});

test('rollup: sample percentages stay until a task changes, then the job is recalculated', () => {
  renderJob('J-1058');
  expect(jobOf('J-1058').job).toBe(92); // seeded value, untouched
  act(() => { api.addTask({ name: 'Extra cut', jobId: 'J-1058', type: 'CNC Router', date: '2030-01-01', quoted: 10 }); });
  const j = jobOf('J-1058');
  expect(j.fab).toBe(Math.round((20 / 30) * 100)); // F5 done 20h of 30h
  expect(j.stage).toBe('In Progress');
});

test('end to end: finishing the last open tasks completes the job, then the PM closes it', () => {
  renderJob('J-1051');
  expect(jobOf('J-1051').stage).toBe('Preparation');
  act(() => { api.runTaskAction('I5', 'close'); }); // print-only task, closed by the PM
  expect(taskOf('I5').stage).toBe('Completed');
  expect(jobOf('J-1051').stage).toBe('In Progress'); // D2 is still in Manager Review
  // Manager Review counts as done, so the job already reads 100% and Close is available (FSD JOB-5). The dialog warns about D2.
  expect(jobOf('J-1051').job).toBe(100);
  expect(btn('Close job').disabled).toBe(false);
  click(btn('Close job'));
  expect(document.querySelector('.modal').textContent).toContain('1 task is still in Manager Review');
  click([...document.querySelectorAll('.modal button')].find((b) => b.textContent.trim() === 'Cancel'));
  act(() => { api.actOnTask('D2', 'Approve', ''); });
  expect(jobOf('J-1051')).toMatchObject({ stage: 'Completed', job: 100, install: 100 });
  act(() => { api.closeJob('J-1051'); });
  expect(jobOf('J-1051').stage).toBe('Completed - Closed');
});

test('reopening a task on a completed job puts the job back In Progress', () => {
  renderJob('J-1039');
  act(() => { api.actOnTask('F10', 'Reopen', 'needs rework'); });
  expect(taskOf('F10').stage).toBe('Reopen');
  expect(jobOf('J-1039').stage).toBe('In Progress');
});

test('the jobs list has the six tabs, and My Open follows the signed-in role', () => {
  renderJobs();
  const tabs = [...document.querySelectorAll('[aria-label="Job lists"] button')].map((b) => b.textContent.replace(/\d+$/, '').trim());
  expect(tabs).toEqual(['All', 'My Open', 'My Jobs', 'Preparation', 'Ongoing', 'Completed']);
  const rows = () => [...document.querySelectorAll('tbody tr')];
  const total = rows().length;
  click(btn('My Open'));
  expect(rows().length).toBeGreaterThan(0);
  expect(rows().length).toBeLessThan(total);
  expect(rows().every((r) => r.textContent.includes('Rachel Barnes') || r.textContent.includes('Tom Hendry'))).toBe(true);
  click(btn('Completed'));
  expect(rows().map((r) => r.textContent).join()).toContain('Westbrook Entry Signage');
});

test('the jobs list can be filtered by PM and fab manager', () => {
  renderJobs();
  const [, pm, fm] = [...document.querySelectorAll('.filter-select select')];
  const set = (el, v) => act(() => { Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); });
  set(pm, 'Helen Cho');
  const names = () => [...document.querySelectorAll('tbody tr')].map((r) => r.textContent);
  expect(names().length).toBeGreaterThan(0);
  expect(names().every((n) => n.includes('Helen Cho'))).toBe(true);
  set(fm, 'Tom Hendry');
  expect(names().every((n) => n.includes('Helen Cho') && n.includes('Tom Hendry'))).toBe(true);
});

test('attachments: add, list, and delete with the right permissions', () => {
  act(() => root.render(<DemoProvider><Probe /><ApprovalPanel task={{ id: 'I1', kind: 'install', name: 'Wayfinding L1-L2', jobId: 'J-1047', stage: 'In Progress', type: 'VE Install', history: [] }} /></DemoProvider>));
  const panel = () => document.querySelector('[aria-label="Attachments"]');
  expect(panel().textContent).toContain('Attachments (1)');
  expect(panel().textContent).toContain('Level 1-2 install drawing.pdf');
  act(() => { api.addAttachments('I1', [{ name: 'site photo.jpg', size: 2048 }, { name: 'permit.pdf', size: 1024 }]); });
  expect(panel().textContent).toContain('Attachments (3)');
  expect(panel().textContent).toContain('site photo.jpg');
  expect(taskOf('I1').history[0].text).toContain('Attached site photo.jpg, permit.pdf');
  click(panel().querySelector('[aria-label="Delete site photo.jpg"]'));
  expect(panel().textContent).toContain('Attachments (2)');
  expect(panel().textContent).not.toContain('site photo.jpg');
});

test('an installer can delete only their own attachments', () => {
  localStorage.setItem('ve-role', 'installer');
  act(() => root.render(<DemoProvider><Probe /></DemoProvider>));
  act(() => { api.addAttachments('I1', [{ name: 'mine.jpg', size: 1 }]); });
  const mine = api.attachments.find((a) => a.name === 'mine.jpg');
  act(() => { expect(api.deleteAttachment('A1')).toBe(false); }); // added by the PM
  act(() => { expect(api.deleteAttachment(mine.id)).toBe(true); });
  expect(api.attachments.some((a) => a.id === 'A1')).toBe(true);
});

test('Job Details shows the location and the signs with their four stages', () => {
  renderJob('J-1042');
  const panel = document.querySelector('[aria-label="Location and signs"]');
  expect(panel.textContent).toContain('Northgate Shopping Centre');
  expect(panel.textContent).toContain('Signs (3)');
  expect(panel.textContent).toContain('Main pylon, north entry');
  ['Deal', 'Artwork', 'Manufacturing', 'Install'].forEach((h) => expect(panel.textContent).toContain(h));
  expect(panel.querySelector('a.site-map').getAttribute('href')).toContain('google.com/maps');
});

test('a job with two sites lists both, and a job with none says so', () => {
  renderJob('J-1058');
  expect(document.querySelector('[aria-label="Location and signs"]').textContent).toContain('Locations (2)');
  act(() => root.unmount()); root = createRoot(box);
  renderJob('J-0000');
  expect(document.querySelector('[aria-label="Location and signs"]').textContent).toContain('No site or signs are linked');
});
