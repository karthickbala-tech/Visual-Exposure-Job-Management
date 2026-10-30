// SAMPLE DATA ONLY. Booked hours come from post-job checklists; timesheets from staff check-in and out.
import { addDays, toKey, today } from '../lib/dates';
import { calcPay } from '../lib/payRules';

const day = (n) => toKey(addDays(today(), n));

// [days ago (negative), worker, kind, jobId, hours, unbilled hours]
const LOG = [
  [-1, 'Dave K.', 'install', 'J-1047', 8, 0], [-2, 'Dave K.', 'install', 'J-1047', 7.5, 1], [-3, 'Dave K.', 'install', 'J-1058', 6, 0],
  [-1, 'Sam T.', 'fab', 'J-1042', 7, 0], [-2, 'Sam T.', 'fab', 'J-1042', 8, 0.5], [-4, 'Sam T.', 'install', 'J-1047', 8, 0],
  [-1, 'Mia T.', 'fab', 'J-1042', 8, 0], [-2, 'Mia T.', 'fab', 'J-1053', 6, 0], [-2, 'Mia T.', 'workshop', 'J-1053', 2, 2],
  [-3, 'Tom H.', 'fab', 'J-1053', 8, 0], [-5, 'Tom H.', 'workshop', 'J-1042', 4, 4],
  [-1, 'Jo P.', 'fab', 'J-1058', 7, 0], [-3, 'Jo P.', 'install', 'J-1053', 5, 0],
  [-1, 'Luke M.', 'install', 'J-1058', 9, 1], [-2, 'Luke M.', 'install', 'J-1058', 8, 0],
  [-9, 'Dave K.', 'install', 'J-1047', 8, 0], [-10, 'Sam T.', 'fab', 'J-1042', 8, 0], [-9, 'Mia T.', 'fab', 'J-1042', 7.5, 0],
];
export const seedHoursLog = LOG.map(([n, worker, kind, jobId, hours, unbilled], i) => ({ id: `H${i + 1}`, date: day(n), worker, kind, jobId, hours, unbilled }));

// [days ago, worker, start, end, break minutes, notes]
const TS = [
  [-1, 'Rachel B.', '07:30', '16:30', 30, 'Site visit and client call'], [-2, 'Rachel B.', '08:00', '17:00', 30, ''],
  [-3, 'Rachel B.', '07:00', '18:30', 45, 'Late delivery'], [-1, 'Tom H.', '06:30', '15:00', 30, ''],
  [-2, 'Tom H.', '06:30', '17:30', 30, 'Pylon frame welding'], [-1, 'Mia T.', '07:00', '15:30', 30, ''],
];
export const seedTimesheets = TS.map(([n, worker, start, end, breakMins, notes], i) => {
  const date = day(n);
  const pay = calcPay({ date, start, end, breakMins });
  return { id: `T${i + 1}`, worker, date, start, end, breakMins, breakStartedAt: null, status: 'Checked-out', notes, ...pay };
});
