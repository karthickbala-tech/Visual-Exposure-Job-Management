import { canCloseJob, completionPct, filterJobs, groupStats, isMine, jobStats, matchesTab, rollup } from './jobs';

const t = (id, kind, stage, quoted, date = '2030-01-01') => ({ id, kind, stage, quoted, date });
const job = (o = {}) => ({ id: 'J-1', stage: 'In Progress', job: 50, pm: 'Rachel Barnes', fabManager: 'Tom Hendry', name: 'Pylon', client: 'Acme', ...o });

test('completion is weighted by quoted hours over the done set', () => {
  const tasks = [t('a', 'fab', 'Completed', 30), t('b', 'fab', 'Manager Review', 10), t('c', 'fab', 'In Progress', 60)];
  expect(completionPct(tasks)).toBe(40); // Manager Review counts as done
  expect(completionPct([t('a', 'fab', 'Cancelled', 0), t('b', 'fab', 'Complete - Not Used', 5)])).toBe(100);
});

test('completion with zero hours is 100 only when every task is done, and 0 with no tasks', () => {
  expect(completionPct([t('a', 'design', 'Completed', 0), t('b', 'design', 'Completed', 0)])).toBe(100);
  expect(completionPct([t('a', 'design', 'Completed', 0), t('b', 'design', 'In Progress', 0)])).toBe(0);
  expect(completionPct([])).toBe(0);
});

test('KPI blocks count total, open and overdue, and ignore closed tasks for open', () => {
  const tasks = [t('a', 'install', 'In Progress', 10, '2026-01-01'), t('b', 'install', 'Completed', 10, '2026-01-01'), t('c', 'install', 'Scheduled', 10, '2099-01-01')];
  expect(groupStats(tasks, '2026-06-01')).toEqual({ total: 3, open: 2, overdue: 1, pct: 33 });
  const all = jobStats([...tasks, t('d', 'fab', 'Manager Review', 5, '2026-01-01')], '2026-06-01');
  expect(all.fab).toEqual({ total: 1, open: 1, overdue: 1, pct: 100 });
  expect(all.job.total).toBe(4);
  expect(all.design.total).toBe(0);
});

test('rollup completes the job when no task is left open', () => {
  const done = [t('a', 'fab', 'Completed', 10), t('b', 'install', 'Complete - Not Used', 10)];
  expect(rollup(job(), done)).toMatchObject({ stage: 'Completed', job: 100, fab: 100, install: 100 });
  expect(rollup(job(), [...done, t('c', 'install', 'Manager Review', 10)]).stage).toBe('In Progress');
});

test('rollup treats Rejected and Reopen as open, and moves Preparation and Completed jobs to In Progress', () => {
  expect(rollup(job(), [t('a', 'fab', 'Rejected', 10)]).stage).toBe('In Progress');
  expect(rollup(job({ stage: 'Preparation' }), [t('a', 'fab', 'Awaiting Scheduling', 10)]).stage).toBe('In Progress');
  expect(rollup(job({ stage: 'Completed' }), [t('a', 'fab', 'Reopen', 10)]).stage).toBe('In Progress');
});

test('rollup never changes a closed, cancelled or on-hold stage, and does nothing without tasks', () => {
  const done = [t('a', 'fab', 'Completed', 10)];
  ['Completed - Closed', 'Cancelled', 'On Hold'].forEach((stage) => expect(rollup(job({ stage }), done).stage).toBe(stage));
  expect(rollup(job(), [])).toBeNull();
});

test('close job is for a Project Manager at 100% and not already closed', () => {
  expect(canCloseJob(job({ job: 100 }), 'pm').ok).toBe(true);
  expect(canCloseJob(job({ job: 100 }), 'fabManager').reason).toMatch(/Project Manager/);
  expect(canCloseJob(job({ job: 92 }), 'pm').reason).toMatch(/92%/);
  expect(canCloseJob(job({ job: 100, stage: 'Completed - Closed' }), 'pm').ok).toBe(false);
  expect(canCloseJob(job({ job: 100, stage: 'Cancelled' }), 'pm').ok).toBe(false);
});

test('job list tabs', () => {
  const jobs = [
    job({ id: 'A' }),
    job({ id: 'B', stage: 'Preparation', pm: 'Helen Cho', fabManager: 'Greg Walsh' }),
    job({ id: 'C', stage: 'Completed' }),
    job({ id: 'D', stage: 'Completed - Closed', pm: 'Helen Cho' }),
    job({ id: 'E', stage: 'On Hold', fabManager: 'Tom Hendry' }),
  ];
  const ids = (tab, person = 'Rachel Barnes') => jobs.filter((j) => matchesTab(j, tab, person)).map((j) => j.id);
  expect(ids('all')).toEqual(['A', 'B', 'C', 'D', 'E']);
  expect(ids('mine')).toEqual(['A', 'C', 'E']);
  expect(ids('myOpen')).toEqual(['A', 'E']); // completed jobs are not open
  expect(ids('myOpen', 'Tom Hendry')).toEqual(['A', 'E']); // fab manager counts as mine
  expect(ids('prep')).toEqual(['B']);
  expect(ids('ongoing')).toEqual(['A']);
  expect(ids('completed')).toEqual(['C', 'D']);
  expect(isMine(jobs[0], '')).toBe(false);
});

test('filters combine with a tab', () => {
  const jobs = [job({ id: 'A' }), job({ id: 'B', pm: 'Helen Cho', name: 'Hoarding' }), job({ id: 'C', fabManager: 'Greg Walsh' })];
  expect(filterJobs(jobs, { pm: 'Helen Cho' }).map((j) => j.id)).toEqual(['B']);
  expect(filterJobs(jobs, { fabManager: 'Greg Walsh' }).map((j) => j.id)).toEqual(['C']);
  expect(filterJobs(jobs, { q: 'hoard' }).map((j) => j.id)).toEqual(['B']);
  expect(filterJobs(jobs, { tab: 'mine', person: 'Rachel Barnes', pm: 'Helen Cho' })).toEqual([]);
});
