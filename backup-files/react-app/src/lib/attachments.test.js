import { canDeleteAttachment, formatSize, makeAttachments } from './attachments';

test('file sizes are shown in B, KB and MB', () => {
  expect(formatSize(512)).toBe('512 B');
  expect(formatSize(2048)).toBe('2 KB');
  expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
  expect(formatSize(undefined)).toBe('0 B');
});

test('the uploader or a manager can delete an attachment, other roles cannot', () => {
  const a = { by: 'Dave Kerr' };
  expect(canDeleteAttachment(a, 'installer', 'Dave Kerr')).toBe(true);
  expect(canDeleteAttachment(a, 'installer', 'Sam Taylor')).toBe(false);
  expect(canDeleteAttachment(a, 'pm', 'Rachel Barnes')).toBe(true);
  expect(canDeleteAttachment(a, 'fabManager', 'Tom Hendry')).toBe(true);
});

test('makeAttachments gives each file its own id and skips nameless entries', () => {
  const list = makeAttachments('I1', [{ name: 'a.pdf', size: 10 }, { name: 'b.jpg' }, {}], 'Rachel Barnes', 'now', 1);
  expect(list.map((x) => x.name)).toEqual(['a.pdf', 'b.jpg']);
  expect(new Set(list.map((x) => x.id)).size).toBe(2);
  expect(list[1].size).toBe(0);
});
