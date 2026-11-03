import { addPrimaryRole, canRemovePrimaryRole, exportSettings, parseSettingsImport, placeholdersOf, toCsv, validateGeneral, validateTemplate } from './admin';
import { DEFAULT_SETTINGS } from './config';

const ok = { anchor: '2026-01-05', days: '14', cutoff: '2026-10-01', expiryDays: '30', workshopJobId: 'J-0000', pcbuName: 'VE' };

test('general settings: good values pass', () => expect(validateGeneral(ok)).toBe(''));

test('general settings: each bad value is named', () => {
  expect(validateGeneral({ ...ok, anchor: '' })).toMatch(/start date/);
  expect(validateGeneral({ ...ok, anchor: '2026-13-45' })).toMatch(/start date/);
  expect(validateGeneral({ ...ok, days: '0' })).toMatch(/length/);
  expect(validateGeneral({ ...ok, days: '1.5' })).toMatch(/length/);
  expect(validateGeneral({ ...ok, cutoff: 'soon' })).toMatch(/cutoff/);
  expect(validateGeneral({ ...ok, expiryDays: '400' })).toMatch(/expiry/);
  expect(validateGeneral({ ...ok, workshopJobId: '' })).toMatch(/workshop job/);
  expect(validateGeneral({ ...ok, pcbuName: '  ' })).toMatch(/PCBU/);
});

test('mail templates: placeholders are found once each and empty text is refused', () => {
  expect(placeholdersOf('Hi {name}, {task} for {name}')).toEqual(['name', 'task']);
  expect(validateTemplate({ subject: '', body: 'x' })).toMatch(/subject/);
  expect(validateTemplate({ subject: 'x', body: ' ' })).toMatch(/message/);
  expect(validateTemplate({ subject: 'x', body: 'y' })).toBe('');
});

test('primary roles: no duplicates, and a role in use cannot be removed', () => {
  expect(addPrimaryRole(['Installer'], ' installer ').error).toMatch(/already/);
  expect(addPrimaryRole(['Installer'], '').error).toMatch(/Enter/);
  expect(addPrimaryRole(['Installer'], 'Estimator').list).toEqual(['Installer', 'Estimator']);
  const workers = [{ primaryRole: 'Installer' }, { primaryRole: 'Installer' }];
  expect(canRemovePrimaryRole('Installer', workers)).toEqual({ ok: false, reason: '2 workers still have this role.' });
  expect(canRemovePrimaryRole('Estimator', workers).ok).toBe(true);
});

test('settings import: round trip works, bad files are refused', () => {
  const text = exportSettings(DEFAULT_SETTINGS);
  const res = parseSettingsImport(text, DEFAULT_SETTINGS);
  expect(res.error).toBeUndefined();
  expect(res.count).toBe(10);
  expect(parseSettingsImport('not json', DEFAULT_SETTINGS).error).toMatch(/JSON/);
  expect(parseSettingsImport('[]', DEFAULT_SETTINGS).error).toMatch(/object/);
  expect(parseSettingsImport('{"unknown":1}', DEFAULT_SETTINGS).error).toMatch(/No known/);
  expect(parseSettingsImport('{"expiryDays":0}', DEFAULT_SETTINGS).error).toMatch(/expiry/);
  expect(parseSettingsImport('{"templates":"x"}', DEFAULT_SETTINGS).error).toMatch(/lists/);
});

test('settings import ignores keys it does not know', () => {
  const res = parseSettingsImport('{"expiryDays":45,"isAdmin":true}', DEFAULT_SETTINGS);
  expect(res.patch).toEqual({ expiryDays: 45 });
});

test('csv: every value is quoted and quotes are doubled', () => {
  const csv = toCsv([{ label: 'Name', get: (r) => r.n }, { label: 'Note', get: (r) => r.t }], [{ n: 'A, B', t: 'say "hi"' }, { n: 'C', t: undefined }]);
  expect(csv).toBe('"Name","Note"\n"A, B","say ""hi"""\n"C",""');
});
