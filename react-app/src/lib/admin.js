// Admin area rules (FSD section 5.14). Pure functions, so they are easy to test.
import { fromKey, toKey } from './dates';

// The round trip catches dates that JavaScript would quietly roll over, like 2026-13-45.
const isDateKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && toKey(fromKey(v)) === v;
const wholeNumber = (v) => /^\d+$/.test(String(v).trim());

// Validates the General tab. Returns an error message, or '' when the values are fine.
export function validateGeneral(d) {
  if (!isDateKey(d.anchor)) return 'The pay period start date must be a real date.';
  if (!wholeNumber(d.days) || Number(d.days) < 1 || Number(d.days) > 31) return 'The pay period length must be a whole number of days from 1 to 31.';
  if (!isDateKey(d.cutoff)) return 'The hours-not-filled cutoff must be a real date.';
  if (!wholeNumber(d.expiryDays) || Number(d.expiryDays) < 1 || Number(d.expiryDays) > 365) return 'The expiry warning must be a whole number of days from 1 to 365.';
  if (!d.workshopJobId) return 'Choose the workshop job.';
  if (!d.pcbuName.trim()) return 'The PCBU name is required.';
  return '';
}

export const generalPatch = (d) => ({
  payPeriod: { anchor: d.anchor, days: Number(d.days) },
  hoursCutoff: d.cutoff,
  expiryDays: Number(d.expiryDays),
  workshopJobId: d.workshopJobId,
  pcbu: { name: d.pcbuName.trim(), contact: d.pcbuContact.trim(), phone: d.pcbuPhone.trim() },
});

// Mail templates: the {placeholders} a text uses.
export const placeholdersOf = (text) => [...new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];

export function validateTemplate(t) {
  if (!t.subject.trim()) return 'The subject is required.';
  if (!t.body.trim()) return 'The message is required.';
  return '';
}

// A primary role can be removed only when no worker holds it, so no worker is left with a role that does not exist.
export function canRemovePrimaryRole(role, workers) {
  const n = workers.filter((w) => w.primaryRole === role).length;
  return n === 0 ? { ok: true, reason: '' } : { ok: false, reason: `${n} worker${n > 1 ? 's' : ''} still ${n > 1 ? 'have' : 'has'} this role.` };
}

export function addPrimaryRole(list, name) {
  const v = name.trim();
  if (!v) return { error: 'Enter a role name.' };
  if (list.some((r) => r.toLowerCase() === v.toLowerCase())) return { error: 'That role already exists.' };
  return { list: [...list, v] };
}

// Import and export. Only the keys below can be imported, and each is checked, so a bad file cannot break the app.
export const SETTINGS_KEYS = ['payPeriod', 'hoursCutoff', 'expiryDays', 'workshopJobId', 'pcbu', 'roleAssignments', 'issueRouting', 'hoursReportRecipients', 'primaryRoles', 'templates'];

export const exportSettings = (settings) => JSON.stringify(Object.fromEntries(SETTINGS_KEYS.map((k) => [k, settings[k]])), null, 2);

export function parseSettingsImport(text, current) {
  let data;
  try { data = JSON.parse(text); } catch { return { error: 'That file is not valid JSON.' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'The file must hold a settings object.' };
  const patch = {};
  Object.keys(data).filter((k) => SETTINGS_KEYS.includes(k)).forEach((k) => { patch[k] = data[k]; });
  if (Object.keys(patch).length === 0) return { error: 'No known settings were found in that file.' };
  const merged = { ...current, ...patch };
  const err = validateGeneral({
    anchor: merged.payPeriod?.anchor, days: merged.payPeriod?.days, cutoff: merged.hoursCutoff, expiryDays: merged.expiryDays,
    workshopJobId: merged.workshopJobId, pcbuName: merged.pcbu?.name || '',
  });
  if (err) return { error: err };
  if (!Array.isArray(merged.primaryRoles) || !Array.isArray(merged.templates) || !Array.isArray(merged.hoursReportRecipients)) return { error: 'The roles, templates and recipients must be lists.' };
  if (typeof merged.issueRouting !== 'object' || typeof merged.roleAssignments !== 'object') return { error: 'The issue routing and role assignments must be objects.' };
  return { patch, count: Object.keys(patch).length };
}

// CSV with every value quoted, so commas and line breaks in text are safe.
export const toCsv = (columns, rows) => {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [columns.map((c) => q(c.label)).join(','), ...rows.map((r) => columns.map((c) => q(c.get(r))).join(','))].join('\n');
};
