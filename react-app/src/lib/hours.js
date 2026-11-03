// HRS-1 (weekly Employee Hours roll-up) and HRS-4 (hours not filled). Pure functions.
import { addDays, fromKey, toKey } from './dates';
import { WORKSHOP_TASK_TYPES } from './config';

const r2 = (n) => Math.round(n * 100) / 100;
const sum = (list, f) => r2(list.reduce((n, x) => n + f(x), 0));

export const weekDays = (weekStartKey) => Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(weekStartKey), i)));

// One row per worker for the week: hours per day, fab, install and workshop hours, unbilled, and final (billed) hours.
// Total includes workshop hours (the Creator report left them out).
export function weeklyRollup(log, weekStartKey) {
  const days = weekDays(weekStartKey);
  const inWeek = log.filter((h) => h.date >= days[0] && h.date <= days[6]);
  const build = (name, list) => {
    const total = sum(list, (x) => x.hours);
    const unbilled = sum(list, (x) => x.unbilled || 0);
    const byDay = {};
    days.forEach((d) => { byDay[d] = sum(list.filter((x) => x.date === d), (x) => x.hours); });
    return {
      id: name, name, byDay,
      fab: sum(list.filter((x) => x.kind === 'fab'), (x) => x.hours),
      install: sum(list.filter((x) => x.kind === 'install'), (x) => x.hours),
      workshop: sum(list.filter((x) => x.kind === 'workshop'), (x) => x.hours),
      total, unbilled, final: r2(total - unbilled),
    };
  };
  const names = [...new Set(inWeek.map((h) => h.worker))].sort();
  const rows = names.map((n) => build(n, inWeek.filter((h) => h.worker === n)));
  return { days, rows, totals: build('Total', inWeek) };
}

export function rollupCsv({ days, rows, totals }) {
  const head = ['Worker', ...days, 'Fab', 'Install', 'Workshop', 'Total', 'Unbilled', 'Final'];
  const line = (r) => [r.name, ...days.map((d) => r.byDay[d]), r.fab, r.install, r.workshop, r.total, r.unbilled, r.final];
  const esc = (v) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [head, ...rows.map(line), line(totals)].map((r) => r.map(esc).join(',')).join('\n');
}

export const isWorkshopTask = (task) => WORKSHOP_TASK_TYPES.includes(task.type);

// HRS-4: completed post-job checklists with zero hours, for fab tasks scheduled in the past on or after the cutoff date.
export function hoursNotFilled({ tasks, checklists, person, cutoff, todayKey }) {
  const out = [];
  checklists.forEach((c) => {
    if (c.person !== person || !c.steps.post2) return;
    const task = tasks.find((t) => t.id === c.taskId);
    if (!task || task.kind !== 'fab' || !(task.date < todayKey) || task.date < cutoff) return;
    if (Number(c.steps.post2.hours) > 0) return;
    out.push({ task, record: c, workshop: isWorkshopTask(task) });
  });
  return out.sort((a, b) => a.task.date.localeCompare(b.task.date));
}

export const splitNotFilled = (list) => ({ workshop: list.filter((x) => x.workshop).length, other: list.filter((x) => !x.workshop).length });
