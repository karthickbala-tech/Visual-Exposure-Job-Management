import { addressLine, locationsForJob, mapsUrl, signSummary } from './jobSites';

const sites = [{ id: 'S1', jobId: 'J1', name: 'A', address: '1 Main St', suburb: 'Preston', state: 'VIC', postcode: '3072', lat: -37.7, lng: 145 }, { id: 'S2', jobId: 'J2', name: 'B' }];
const signs = [
  { id: 'a', jobId: 'J1', siteId: 'S1', qty: 2, install: 'Installed' },
  { id: 'b', jobId: 'J1', siteId: 'S1', qty: 3, install: 'Scheduled' },
  { id: 'c', jobId: 'J2', siteId: 'S2', qty: 1, install: 'Installed' },
];

test('locationsForJob returns only that job\'s sites and signs', () => {
  const out = locationsForJob('J1', sites, signs);
  expect(out).toHaveLength(1);
  expect(out[0].signs.map((s) => s.id)).toEqual(['a', 'b']);
  expect(locationsForJob('J9', sites, signs)).toEqual([]);
});

test('signSummary counts signs, pieces and installed signs', () => {
  expect(signSummary(signs.slice(0, 2))).toEqual({ signs: 2, pieces: 5, installed: 1 });
  expect(signSummary([])).toEqual({ signs: 0, pieces: 0, installed: 0 });
});

test('addressLine and mapsUrl handle missing coordinates', () => {
  expect(addressLine(sites[0])).toBe('1 Main St, Preston, VIC 3072');
  expect(mapsUrl(sites[0])).toContain('query=-37.7,145');
  expect(mapsUrl({ address: '2 High St', suburb: 'X', state: 'VIC', postcode: '3000' })).toContain('query=2%20High%20St');
});
