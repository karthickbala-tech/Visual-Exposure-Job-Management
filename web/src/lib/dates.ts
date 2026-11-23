/**
 * Today's date as YYYY-MM-DD in the business time zone (Melbourne), the same rule as the server's lib/time.js todayLocal.
 * `new Date().toISOString().slice(0, 10)` gives the UTC date, which in Melbourne is still yesterday until 10 or 11 am:
 * date pickers then refused today, checklist shift dates defaulted to yesterday and overdue flags ran a day late.
 */
export const BUSINESS_TZ = 'Australia/Melbourne';

const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const todayIso = (now: Date = new Date()): string => fmt.format(now);
