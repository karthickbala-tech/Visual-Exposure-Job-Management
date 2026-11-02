// Weeks start on Monday (Australia).
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

const pad = (n) => String(n).padStart(2, '0');

// Dates travel through the app as 'YYYY-MM-DD' keys so time zones never shift them.
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const startOfWeek = (d) => addDays(d, -((d.getDay() + 6) % 7));
export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
export const dayName = (d) => DAY_NAMES[(d.getDay() + 6) % 7];
export const formatShort = (key) => {
  const d = fromKey(key);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};
export const formatLong = (key) => {
  const d = fromKey(key);
  return `${dayName(d)} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};
export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};
export const fullDate = () => {
  const d = today();
  return `${DAY_LONG[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};
export const fmtStamp = (iso) =>
  new Date(iso).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
