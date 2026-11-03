import { fromKey, today } from './dates';

// Tickets, inductions and company documents all use the same four states.
export const DAYS_BEFORE_EXPIRY = 30; // default for the Setup form "Days Before Expiry"
let expiryDays = DAYS_BEFORE_EXPIRY;
// The Admin setting. DemoProvider calls this whenever it changes, so every screen that uses statusOf follows it.
export const setExpiryDays = (n) => { expiryDays = Number(n) > 0 ? Number(n) : DAYS_BEFORE_EXPIRY; };
export const getExpiryDays = () => expiryDays;
const RANK = { Current: 0, Incomplete: 1, Expiring: 2, Expired: 3 };
export const STATUS_TONE = { Current: 'green', Expiring: 'amber', Expired: 'red', Incomplete: 'gray' };

export const daysUntil = (expiry) => Math.round((fromKey(expiry) - today()) / 86400000);
export function statusOf(expiry) {
  if (!expiry) return 'Incomplete';
  const d = daysUntil(expiry);
  if (d < 0) return 'Expired';
  return d <= expiryDays ? 'Expiring' : 'Current';
}
export const worst = (expiries) => expiries.map(statusOf).reduce((w, s) => (RANK[s] > RANK[w] ? s : w), 'Current');
export const expiryText = (expiry) => {
  if (!expiry) return 'Not filled in';
  const d = daysUntil(expiry);
  return d < 0 ? `${-d} days ago` : d === 0 ? 'Today' : `in ${d} days`;
};

// CMP-2: mutually exclusive expiry buckets for the compliance dashboard.
// Expired = before today, Today = expires today, Soon = 1 to DAYS_BEFORE_EXPIRY days, Incomplete = no expiry date yet.
export const BUCKETS = ['Expired', 'Today', 'Soon', 'Incomplete'];
export function bucketOf(expiry) {
  if (!expiry) return 'Incomplete';
  const d = daysUntil(expiry);
  if (d < 0) return 'Expired';
  if (d === 0) return 'Today';
  return d <= DAYS_BEFORE_EXPIRY ? 'Soon' : 'Current';
}

// Counts for the dashboard tiles. activeOnly drops inactive workers (and their tickets and inductions)
// and inactive companies (and their documents).
export function complianceSummary({ workers, companies, tickets, inductions, companyDocs, veName, activeOnly = true }) {
  const companyOf = (id) => companies.find((c) => c.id === id);
  const keepWorker = (w) => !!w && (!activeOnly || w.active);
  const keepCompany = (c) => !!c && (!activeOnly || c.active);
  const shownWorkers = workers.filter(keepWorker);
  const isVe = (w) => companyOf(w.companyId)?.name === veName;
  const workerIds = new Set(shownWorkers.map((w) => w.id));
  const t = tickets.filter((x) => workerIds.has(x.workerId));
  const i = inductions.filter((x) => workerIds.has(x.workerId));
  const d = companyDocs.filter((x) => keepCompany(companyOf(x.companyId)));
  const buckets = {};
  BUCKETS.forEach((b) => {
    const n = (list) => list.filter((x) => bucketOf(x.expiry) === b).length;
    buckets[b] = { tickets: n(t), inductions: n(i), docs: n(d), total: n(t) + n(i) + n(d) };
  });
  return {
    workers: { ve: shownWorkers.filter(isVe).length, nonVe: shownWorkers.filter((w) => !isVe(w)).length },
    buckets, tickets: t, inductions: i, docs: d, shownWorkers,
  };
}
