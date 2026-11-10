import { ROLES } from '../data/mockData';
import { ACCESS, EQUIPMENT_EDITORS, canAccess } from './access';
import { MANAGER_ROLES } from './workflow';
import { canCloseJob } from './jobs';

test('all 11 FSD roles exist and each can open its own dashboard', () => {
  expect(Object.keys(ROLES)).toHaveLength(11);
  Object.keys(ROLES).forEach((id) => { expect(ACCESS[id]).toBeDefined(); expect(canAccess(id, '/')).toBe(true); });
});

test('only Admin opens Admin and Compliance', () => {
  Object.keys(ROLES).forEach((id) => {
    expect(canAccess(id, '/admin')).toBe(id === 'admin');
    expect(canAccess(id, '/compliance')).toBe(id === 'admin');
  });
});

test('Contractor and Viewer cannot open screens that hold worker PII', () => {
  ['contractor', 'viewer'].forEach((id) => { expect(canAccess(id, '/workers')).toBe(false); });
  expect(canAccess('viewer', '/hours')).toBe(false);
});

test('Viewer sees list screens but cannot approve, edit equipment or close a job', () => {
  expect(canAccess('viewer', '/jobs')).toBe(true);
  expect(MANAGER_ROLES).not.toContain('viewer');
  expect(EQUIPMENT_EDITORS).not.toContain('viewer');
  expect(canCloseJob({ stage: 'In Progress', job: 100 }, 'viewer').ok).toBe(false);
});

test('Admin can approve and close a job; Install Coordinator reaches installation and hours', () => {
  expect(MANAGER_ROLES).toContain('admin');
  expect(canCloseJob({ stage: 'In Progress', job: 100 }, 'admin').ok).toBe(true);
  expect(canAccess('installCoordinator', '/installation')).toBe(true);
  expect(canAccess('installCoordinator', '/hours')).toBe(true);
  expect(canAccess('designer', '/design')).toBe(true);
  expect(canAccess('designer', '/installation')).toBe(false);
});
