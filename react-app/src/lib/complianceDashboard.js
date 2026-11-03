// CMP-2: the compliance dashboard. Active VE and non-VE workers, and tickets, inductions and company documents that are
// past their expiry, expire today, or expire within the warning window. Pure functions.
// FSD question 16 is open (which date expiries are measured from). Built on the simple rule: measured from today.
import { daysUntil } from './compliance';

// 'past', 'today', 'soon' (within `days`), 'ok', or 'missing' when no expiry date has been filled in.
export function bucketOf(expiry, days) {
  if (!expiry) return 'missing';
  const d = daysUntil(expiry);
  if (d < 0) return 'past';
  if (d === 0) return 'today';
  return d <= days ? 'soon' : 'ok';
}

const ATTENTION = ['past', 'today', 'soon'];
const byExpiry = (a, b) => a.expiry.localeCompare(b.expiry);

// data: { workers, companies, tickets, inductions, companyDocs, ticketTypes, inductionTypes, veName }
// opts: { activeOnly, days }
export function complianceSummary(data, { activeOnly = true, days = 30 } = {}) {
  const { workers, companies, tickets, inductions, companyDocs, ticketTypes, inductionTypes, veName } = data;
  const company = (id) => companies.find((c) => c.id === id);
  const typeName = (types, id) => types.find((t) => t.id === id)?.name || id;

  const scopeWorkers = workers.filter((w) => !activeOnly || w.active);
  const isVe = (w) => company(w.companyId)?.name === veName;
  const workerById = Object.fromEntries(scopeWorkers.map((w) => [w.id, w]));

  const person = (kind, types) => (x) => {
    const w = workerById[x.workerId];
    return w && { id: x.id, kind, ownerId: w.id, owner: w.name, employer: company(w.companyId)?.name || '', name: typeName(types, x.typeId), expiry: x.expiry, bucket: bucketOf(x.expiry, days) };
  };
  const tk = tickets.map(person('ticket', ticketTypes)).filter(Boolean);
  const ind = inductions.map(person('induction', inductionTypes)).filter(Boolean);
  const docs = companyDocs
    .filter((d) => !activeOnly || company(d.companyId)?.active)
    .map((d) => ({ id: d.id, kind: 'doc', ownerId: '', owner: company(d.companyId)?.name || d.companyId, employer: '', name: d.name, expiry: d.expiry, bucket: bucketOf(d.expiry, days) }));

  const all = [...tk, ...ind, ...docs];
  const count = (b) => all.filter((x) => x.bucket === b).length;
  const attention = (list) => list.filter((x) => ATTENTION.includes(x.bucket)).sort(byExpiry);

  return {
    workers: { ve: scopeWorkers.filter(isVe).length, nonVe: scopeWorkers.filter((w) => !isVe(w)).length },
    counts: { past: count('past'), today: count('today'), soon: count('soon'), missing: count('missing') },
    tickets: attention(tk),
    inductions: attention(ind),
    docs: attention(docs),
  };
}

export const FILTERS = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'past', label: 'Past expiry' },
  { id: 'today', label: 'Expires today' },
  { id: 'soon', label: 'Within warning window' },
];
export const applyFilter = (list, filter) => (filter === 'attention' ? list : list.filter((x) => x.bucket === filter));
