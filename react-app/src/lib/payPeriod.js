// HRS-3: one pay-period configuration for "this" and "last" pay period (FSD question 11 is open, so the start day and length are settings).
import { addDays, fromKey, toKey } from './dates';

const DAY_MS = 86400000;

// The pay period containing a date. Periods repeat every `days` days from the anchor date, before and after it.
export function payPeriodFor(dateKey, cfg) {
  const anchor = fromKey(cfg.anchor);
  const diff = Math.round((fromKey(dateKey) - anchor) / DAY_MS);
  const idx = Math.floor(diff / cfg.days);
  const start = addDays(anchor, idx * cfg.days);
  return { from: toKey(start), to: toKey(addDays(start, cfg.days - 1)) };
}

export const thisPayPeriod = (todayKey, cfg) => payPeriodFor(todayKey, cfg);
export const lastPayPeriod = (todayKey, cfg) => payPeriodFor(toKey(addDays(fromKey(thisPayPeriod(todayKey, cfg).from), -1)), cfg);
