// Pay rules copied from the Creator workflow "K Calculate_Timesheet_Hours".
// Weekdays: 06:00-18:00 is in-hours (first 8h single, next 2h time and a half, then double). Time outside 06:00-18:00 is double.
// Saturday: first 2h time and a half, then double. Sunday: all double.
// Breaks come off double time first, then time and a half, then single time.
// Demo limit: shifts must end on the same day they start.
const IN_START = 360;
const IN_END = 1080;
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const r2 = (n) => Math.round(n * 100) / 100;

export function calcPay({ date, start, end, breakMins = 0 }) {
  const s = toMin(start);
  const e = toMin(end);
  if (!(e > s)) return null;
  const total = (e - s) / 60;
  const [y, m, d] = date.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  let single = 0; let half = 0; let dbl = 0;

  if (dow === 6) {
    if (total <= 2) half = total; else { half = 2; dbl = total - 2; }
  } else if (dow === 0) {
    dbl = total;
  } else {
    let inMin = 0;
    if (s < IN_END && e > IN_START) {
      const a = Math.max(s, IN_START);
      const b = Math.min(e, IN_END);
      if (b > a) inMin = b - a;
    }
    const inH = inMin / 60;
    const outH = total - inH;
    if (inH <= 8) single = inH;
    else if (inH <= 10) { single = 8; half = inH - 8; }
    else { single = 8; half = 2; dbl = inH - 10; }
    dbl += outH;
  }

  let rem = (breakMins || 0) / 60;
  if (rem > 0) {
    if (dbl >= rem) dbl -= rem;
    else {
      rem -= dbl; dbl = 0;
      if (half >= rem) half -= rem;
      else { rem -= half; half = 0; single = Math.max(0, single - rem); }
    }
  }
  return { single: r2(single), half: r2(half), double: r2(dbl), total: r2(single + half + dbl) };
}
export const ZERO_PAY = { single: 0, half: 0, double: 0, total: 0 };
export const fmtH = (n) => `${Math.round(n * 100) / 100}h`;
