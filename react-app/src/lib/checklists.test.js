import { checklistPlan, closuresPending, nextStep, stepOrder, submitBlockReason, swmsReady, validateStep } from './checklists';
import { applyAction, availableActions, isCloseOnly, subtaskDraft } from './taskActions';

const install = (o = {}) => ({ id: 'I9', kind: 'install', type: 'VE Install', stage: 'In Progress', subStage: '', leader: 'Dave K.', member: 'Sam T.', jobId: 'J-1', name: 'Fit pylon', ...o });
const rec = (...keys) => ({ steps: Object.fromEntries(keys.map((k) => [k, { at: 'x' }])) });

describe('which checklists a task needs', () => {
  test('install types', () => {
    expect(checklistPlan(install())).toEqual({ pre: true, post: true });
    expect(checklistPlan(install({ type: 'VE Subtask' }))).toEqual({ pre: false, post: true });
    expect(checklistPlan(install({ type: 'Minor Task' }))).toEqual({ pre: false, post: true });
    expect(checklistPlan(install({ type: 'Print Only' }))).toEqual({ pre: false, post: false });
  });
  test('fab: workshop skips the pre-job checklist', () => {
    expect(checklistPlan({ kind: 'fab', type: 'Workshop' })).toEqual({ pre: false, post: true });
    expect(checklistPlan({ kind: 'fab', type: 'CNC Router' })).toEqual({ pre: true, post: true });
    expect(stepOrder({ kind: 'fab', type: 'Paint' })).toEqual(['pre1', 'post2']);
  });
});

describe('next step (WORKFLOWS 4.2, independent crew)', () => {
  test('install walks pre1, pre2 then waits for the team leader', () => {
    expect(nextStep(install(), undefined).step).toBe('pre1');
    expect(nextStep(install(), rec('pre1')).step).toBe('pre2');
    const waiting = nextStep(install(), rec('pre1', 'pre2'));
    expect(waiting.step).toBeNull();
    expect(waiting.message).toMatch(/team leader/);
  });
  test('after On Site the post-job steps open, and each person goes at their own pace', () => {
    expect(nextStep(install({ subStage: 'On Site' }), undefined).step).toBe('post1');
    expect(nextStep(install({ subStage: 'On Site' }), rec('post1')).step).toBe('post2');
    expect(nextStep(install({ subStage: 'Finished On Site' }), rec('post1', 'post2')).step).toBeNull();
  });
  test('post-job only types open once started', () => {
    expect(nextStep(install({ type: 'VE Subtask', stage: 'Scheduled' }), undefined).step).toBeNull();
    expect(nextStep(install({ type: 'VE Subtask' }), undefined).step).toBe('post1');
  });
  test('after a rejection the person redoes the closure step', () => {
    expect(nextStep(install({ stage: 'Rejected', subStage: 'On Site' }), rec('pre1', 'pre2', 'post1')).step).toBe('post2');
  });
  test('fab: pre-job then post-job', () => {
    const fab = { kind: 'fab', type: 'Paint', stage: 'Scheduled', leader: 'Mia T.', member: '' };
    expect(nextStep(fab, undefined).step).toBe('pre1');
    expect(nextStep({ ...fab, stage: 'In Progress' }, rec('pre1')).step).toBe('post2');
  });
});

describe('closing the task (INS-3)', () => {
  const lists = [{ taskId: 'I9', person: 'Dave K.', steps: { post2: {} } }];
  test('submit is blocked until every crew member has closed', () => {
    expect(closuresPending(install(), lists)).toEqual(['Sam T.']);
    expect(submitBlockReason(install(), lists)).toMatch(/Sam T\./);
    expect(submitBlockReason(install(), [...lists, { taskId: 'I9', person: 'Sam T.', steps: { post2: {} } }])).toBe('');
  });
  test('close-only and design tasks are never blocked', () => {
    expect(submitBlockReason(install({ type: 'External Install' }), [])).toBe('');
    expect(submitBlockReason({ id: 'D1', kind: 'design' }, [])).toBe('');
  });
});

describe('validation', () => {
  test('SWMS must be signed before the team leader finishes the briefing (INS-4)', () => {
    expect(swmsReady('Created')).toBe(false);
    expect(swmsReady('PM Signed')).toBe(false);
    expect(swmsReady('TL Signed')).toBe(true);
    expect(validateStep('pre1', 'TL', { briefed: true }, { kind: 'install', swmsStatus: 'PM Signed' })).toMatch(/SWMS/);
    expect(validateStep('pre1', 'TL', { briefed: true }, { kind: 'install', swmsStatus: 'TL Signed' })).toBe('');
  });
  test('team members only confirm the briefing', () => {
    expect(validateStep('pre1', 'TM', {}, { kind: 'install' })).not.toBe('');
    expect(validateStep('pre1', 'TM', { understood: true }, { kind: 'install' })).toBe('');
  });
  test('hours: warn above 14, stop above 16, unbilled 0 to 16 (CHK-6)', () => {
    const ok = { rating: 8 };
    const ctx = { kind: 'install' };
    expect(validateStep('post2', 'TM', { ...ok, hours: '8' }, ctx)).toBe('');
    expect(validateStep('post2', 'TM', { ...ok, hours: '15' }, ctx)).toMatch(/confirm/);
    expect(validateStep('post2', 'TM', { ...ok, hours: '15', hoursConfirmed: true }, ctx)).toBe('');
    expect(validateStep('post2', 'TM', { ...ok, hours: '16', hoursConfirmed: true }, ctx)).toBe('');
    expect(validateStep('post2', 'TM', { ...ok, hours: '16.5', hoursConfirmed: true }, ctx)).toMatch(/cannot be saved/);
    expect(validateStep('post2', 'TM', { ...ok, hours: '0' }, ctx)).toMatch(/Enter the hours/);
    expect(validateStep('post2', 'TM', { ...ok, hours: '8', unbilled: '17' }, ctx)).toMatch(/Unbilled/);
    expect(validateStep('post2', 'TM', { ...ok, hours: '8', unbilled: '-1' }, ctx)).toMatch(/Unbilled/);
  });
  test('briefing rating is 1 to 10 for install team members (CHK-7)', () => {
    const ctx = { kind: 'install' };
    expect(validateStep('post2', 'TM', { hours: '8', rating: '0' }, ctx)).toMatch(/1 to 10/);
    expect(validateStep('post2', 'TM', { hours: '8', rating: '11' }, ctx)).toMatch(/1 to 10/);
    expect(validateStep('post2', 'TM', { hours: '8', rating: '10' }, ctx)).toBe('');
    expect(validateStep('post2', 'TL', { hours: '8' }, ctx)).toBe('');
  });
  test('an OH&S concern needs a description so the issue can be raised (CHK-5)', () => {
    expect(validateStep('pre2', 'TL', { arrived: true, ohsConcern: 'Yes', ohsDetail: ' ' })).toMatch(/Describe/);
    expect(validateStep('pre2', 'TL', { arrived: true, ohsConcern: 'Yes', ohsDetail: 'Loose scaffold' })).toBe('');
  });
});

describe('task actions (TSK-2)', () => {
  test('hold and release', () => {
    expect(applyAction(install({ stage: 'Scheduled' }), 'hold').patch.stage).toBe('On Hold');
    expect(applyAction(install({ stage: 'On Hold' }), 'release').patch.stage).toBe('Scheduled');
  });
  test('cancel clears the crew and quoted hours; install cancels only before scheduling', () => {
    const r = applyAction({ kind: 'fab', type: 'Paint', stage: 'Scheduled', leader: 'Mia T.', member: 'Jo P.', quoted: 10 }, 'cancel');
    expect(r.patch).toMatchObject({ stage: 'Cancelled', leader: '', member: '', quoted: 0 });
    expect(applyAction(install({ stage: 'Scheduled' }), 'cancel')).toBeNull();
    expect(applyAction(install({ stage: 'Awaiting Scheduling', leader: '', member: '' }), 'cancel').patch.stage).toBe('Cancelled');
  });
  test('not used and reset drop the checklists; reset returns to Awaiting Scheduling', () => {
    expect(applyAction(install({ stage: 'Scheduled' }), 'notUsed').dropChecklists).toBe(true);
    const r = applyAction(install({ stage: 'Scheduled' }), 'reset');
    expect(r.patch).toMatchObject({ stage: 'Awaiting Scheduling', leader: '', member: '' });
    expect(r.dropChecklists).toBe(true);
  });
  test('external and print-only tasks are closed by the PM and skip checklists (INS-6)', () => {
    const t = install({ type: 'External Install', stage: 'Scheduled' });
    expect(isCloseOnly(t)).toBe(true);
    expect(applyAction(t, 'close').patch.stage).toBe('Completed');
    expect(availableActions(install()).some((a) => a.id === 'close')).toBe(false);
  });
  test('design tasks have no extra actions', () => {
    expect(availableActions({ kind: 'design', stage: 'In Progress' })).toEqual([]);
  });
  test('a subtask hangs off the root parent and starts unscheduled', () => {
    const root = install({ id: 'I1', name: 'Wayfinding', swms: 'Completed' });
    const sub = install({ id: 'I2', parentId: 'I1', name: 'Wayfinding - Subtask' });
    const { draft } = subtaskDraft(sub, [root, sub], { stage: 'In Progress' });
    expect(draft).toMatchObject({ name: 'Wayfinding - Subtask', parentId: 'I1', type: 'VE Subtask', stage: 'Awaiting Scheduling', quoted: 0, leader: '', member: '' });
    expect(subtaskDraft(root, [root], { stage: 'Completed - Closed' }).error).toMatch(/closed/);
    expect(subtaskDraft({ kind: 'design' }, [], null).error).toBeTruthy();
  });
});
