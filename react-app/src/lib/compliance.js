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
