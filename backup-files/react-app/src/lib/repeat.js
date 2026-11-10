import { membersOf } from './people';
// FAB-3: repeating workshop tasks. When one is completed, the next one is created for previous date + the interval.
// WORKFLOWS section 10: Days = count, Weeks x 7, Months x 30. Pure functions.
import { addDays, fromKey, toKey } from './dates';

export const REPEAT_UNITS = ['Days', 'Weeks', 'Months'];
const UNIT_DAYS = { Days: 1, Weeks: 7, Months: 30 };

export const repeatDays = (r) => Number(r.count) * UNIT_DAYS[r.unit];

// Returns an error message, or '' when the repeat is fine. An empty repeat (no count) means "does not repeat".
export function validateRepeat(r) {
  if (!r || r.count === '' || r.count == null) return '';
  if (!/^\d+$/.test(String(r.count)) || Number(r.count) < 1 || Number(r.count) > 365) return 'Repeat every must be a whole number from 1 to 365.';
  if (!REPEAT_UNITS.includes(r.unit)) return 'Choose days, weeks or months.';
  return '';
}

// The repeat to store on a task, or null when it does not repeat.
export const cleanRepeat = (r) => (r && r.count !== '' && r.count != null && !validateRepeat(r) ? { count: Number(r.count), unit: r.unit } : null);

export const nextRepeatDate = (dateKey, repeat) => toKey(addDays(fromKey(dateKey), repeatDays(repeat)));

export const repeatLabel = (r) => `Every ${r.count === 1 ? '' : `${r.count} `}${r.count === 1 ? r.unit.slice(0, -1).toLowerCase() : r.unit.toLowerCase()}`;

// Only Workshop tasks repeat (Maintenance tasks come from the equipment schedule, FAB-4). Completed once, and never twice for the same task.
export const shouldRepeat = (task) => task.type === 'Workshop' && !!task.repeat && !task.repeatSpawned && task.stage === 'Completed';

// The next task in the series. It starts Scheduled when a team leader is set, otherwise Awaiting Scheduling.
export function nextRepeatTask(task, id, at) {
  return {
    id, kind: 'fab', name: task.name, jobId: task.jobId, type: task.type, date: nextRepeatDate(task.date, task.repeat),
    leader: task.leader || '', member: task.member || '', members: membersOf(task), stage: task.leader ? 'Scheduled' : 'Awaiting Scheduling',
    quoted: task.quoted || 0, booked: 0, repeat: task.repeat, repeatOf: task.id,
    history: [{ at, who: 'System', text: `Created by repeat of ${task.id}` }],
  };
}
