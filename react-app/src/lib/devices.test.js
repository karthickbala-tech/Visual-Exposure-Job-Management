import { hasLocation, isStale, toMapPoints } from './devices';

test('devices without a location are not plotted', () => {
  expect(hasLocation({ lat: null, lng: null })).toBe(false);
  expect(toMapPoints([{ id: 'a', lat: null, lng: null }], 600, 300)).toEqual([]);
});

test('north is at the top and west at the left', () => {
  const pts = toMapPoints([{ id: 'n', lat: -37, lng: 144 }, { id: 's', lat: -38, lng: 145 }], 600, 300, 40);
  const n = pts.find((p) => p.id === 'n');
  const s = pts.find((p) => p.id === 's');
  expect(n.y).toBeLessThan(s.y);
  expect(n.x).toBeLessThan(s.x);
});

test('a single device is centred', () => {
  const [p] = toMapPoints([{ id: 'x', lat: -37, lng: 144 }], 600, 300, 40);
  expect(p).toEqual({ id: 'x', x: 300, y: 150 });
});

test('a device not seen for over a day is stale', () => {
  const now = Date.now();
  expect(isStale({ seenAt: new Date(now - 3600000).toISOString() }, now)).toBe(false);
  expect(isStale({ seenAt: new Date(now - 30 * 3600000).toISOString() }, now)).toBe(true);
  expect(isStale({ seenAt: null }, now)).toBe(true);
});
