import { EVENTS, filterLog, logSummary, makeNotifications, retried } from './notifications';

const settings = {
  roleAssignments: { fabManager: 'Tom Hendry', installationManager: 'Rachel Barnes', director: 'Karen Wells' },
  issueRouting: { Install: { manager: 'Rachel Barnes', also: ['Dave Kerr', 'Rachel Barnes'] } },
};
const make = (event, ctx) => makeNotifications(event, ctx, settings, '2026-03-02T00:00:00Z', 1);

test('a fab task goes to the Fab Manager, other tasks go to the job PM', () => {
  const fab = make('task.submitted', { type: 'Fabrication', kind: 'fab', pm: 'Helen Cho' });
  expect(fab.map((r) => r.recipient)).toEqual(['Tom Hendry']);
  expect(fab[0].subject).toBe('Fabrication Task Approval');
  const inst = make('task.submitted', { type: 'Install', kind: 'install', pm: 'Helen Cho' });
  expect(inst.map((r) => r.recipient)).toEqual(['Helen Cho']);
});

test('rejection goes to each assignee, with the task name in the subject', () => {
  const rows = make('task.rejected', { type: 'Install', task: 'Pylon fit', assignees: ['Dave K.', 'Luke M.'] });
  expect(rows.map((r) => r.recipient)).toEqual(['Dave K.', 'Luke M.']);
  expect(rows[0].subject).toBe('Install Task is Rejected: Pylon fit');
});

test('issue emails go to the department manager, the reporter and the inform-also list, once each', () => {
  const rows = make('issue.reported', { subject: 'Ladder rack', department: 'Install', reportedBy: 'Sam Taylor' });
  expect(rows.map((r) => r.recipient)).toEqual(['Rachel Barnes', 'Sam Taylor', 'Dave Kerr']); // Rachel is listed twice, sent once
  expect(rows.map((r) => r.recipientRole)).toEqual(['Department manager', 'Reporter', 'Inform also']);
});

test('job closure goes to the director, the PM and the Fab Manager', () => {
  expect(make('job.closed', { job: 'Pylon', pm: 'Rachel Barnes' }).map((r) => r.recipient)).toEqual(['Karen Wells', 'Rachel Barnes', 'Tom Hendry']);
});

test('people who cannot be resolved are skipped, and unknown events give nothing', () => {
  expect(make('job.closed', { job: 'Pylon', pm: '' }).map((r) => r.recipient)).toEqual(['Karen Wells', 'Tom Hendry']);
  expect(make('issue.reported', { subject: 'x', department: 'Nowhere', reportedBy: '' })).toEqual([]);
  expect(make('nope', {})).toEqual([]);
});

test('every row has an id, a status of Sent and one attempt; ids are unique', () => {
  const rows = make('job.closed', { job: 'Pylon', pm: 'Rachel Barnes' });
  expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  rows.forEach((r) => expect(r).toMatchObject({ status: 'Sent', attempts: 1, event: 'job.closed' }));
  expect(Object.keys(EVENTS)).toHaveLength(10);
});

test('retry only changes failed rows', () => {
  const failed = { id: 'a', status: 'Failed', attempts: 2, error: 'Mailbox unavailable', at: 'old' };
  expect(retried(failed, 'new')).toMatchObject({ status: 'Sent', attempts: 3, at: 'new', error: '' });
  const sent = { id: 'b', status: 'Sent', attempts: 1 };
  expect(retried(sent, 'new')).toBe(sent);
});

test('filter and summary', () => {
  const log = [
    { id: '1', status: 'Sent', event: 'job.closed', recipient: 'Karen Wells', subject: 'Job Closed: Pylon', ref: 'J-1' },
    { id: '2', status: 'Failed', event: 'issue.reported', recipient: 'Tom Hendry', subject: 'Issue Reported: Rack', ref: 'x' },
  ];
  expect(filterLog(log, { status: 'Failed' }).map((r) => r.id)).toEqual(['2']);
  expect(filterLog(log, { event: 'job.closed' }).map((r) => r.id)).toEqual(['1']);
  expect(filterLog(log, { q: 'karen' }).map((r) => r.id)).toEqual(['1']);
  expect(filterLog(log, {}).length).toBe(2);
  expect(logSummary(log)).toEqual({ total: 2, sent: 1, failed: 1 });
});
