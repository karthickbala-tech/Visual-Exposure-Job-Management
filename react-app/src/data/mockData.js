// SAMPLE DATA ONLY (fictional clients and people). Replace with Catalyst API calls later.
// Stage names come from the Creator export (Projects_1.ds).
import { addDays, toKey, today } from '../lib/dates';

const day = (n) => toKey(addDays(today(), n));

export const ROLES = {
  pm: { label: 'Project Manager', name: 'Rachel Barnes', initials: 'RB' },
  fabManager: { label: 'Fab Manager', name: 'Tom Hendry', initials: 'TH' },
  ic2: { label: 'Fab 2IC', name: 'Mia Torres', initials: 'MT' },
  fabWorker: { label: 'Fab Worker', name: 'Sam Taylor', initials: 'ST' },
  installer: { label: 'Installer', name: 'Dave Kerr', initials: 'DK' },
  workshop: { label: 'Workshop', name: 'Jo Patel', initials: 'JP' },
};

export const CLIENTS = [
  'Northgate Retail Group', 'Harbourline Logistics', 'Metro Rail Alliance',
  'Southern Cross Hardware', 'Eastfield University', 'Summit Supermarkets',
];

export const seedJobs = [
  { id: 'J-1042', name: 'Northgate Mall Pylon Refresh', client: 'Northgate Retail Group', stage: 'In Progress', fab: 68, install: 0, job: 42, finish: day(19), risk: 'Fab behind schedule', booked: 132, quoted: 180 },
  { id: 'J-1047', name: 'Harbourline Wayfinding', client: 'Harbourline Logistics', stage: 'In Progress', fab: 100, install: 55, job: 78, finish: day(7), risk: '', booked: 104, quoted: 120 },
  { id: 'J-1051', name: 'Metro Tunnel Site Hoardings', client: 'Metro Rail Alliance', stage: 'Preparation', fab: 0, install: 0, job: 12, finish: day(43), risk: '', booked: 0, quoted: 90 },
  { id: 'J-1053', name: 'Southern Cross Façade', client: 'Southern Cross Hardware', stage: 'In Progress', fab: 35, install: 0, job: 24, finish: day(28), risk: 'Hours 32% over quote', booked: 185, quoted: 140 },
  { id: 'J-1058', name: 'Eastfield Building Letters', client: 'Eastfield University', stage: 'In Progress', fab: 100, install: 85, job: 92, finish: day(3), risk: '', booked: 98, quoted: 96 },
  { id: 'J-1060', name: 'Summit Pylon Concept', client: 'Summit Supermarkets', stage: 'Preparation', fab: 0, install: 0, job: 5, finish: day(52), risk: '', booked: 0, quoted: 60 },
];

export const designTasks = [
  { id: 'D1', name: 'Pylon panel artwork rev C', jobId: 'J-1042', owner: 'Anitha R.', stage: 'In Progress', due: day(-6) },
  { id: 'D2', name: 'Hoarding print files', jobId: 'J-1051', owner: 'Marco D.', stage: 'Manager Review', due: day(-3) },
  { id: 'D3', name: 'Façade lightbox shop drawings', jobId: 'J-1053', owner: 'Anitha R.', stage: 'In Progress', due: day(-2) },
  { id: 'D4', name: 'Summit pylon concept', jobId: 'J-1060', owner: 'Priya S.', stage: 'Not Started', due: day(5) },
];

export const seedSwms = [
  { id: 'SW-209', title: 'Pylon crane lift', jobId: 'J-1042', onSite: day(4), hazards: ['Falls', 'Mobile Plant', 'Roadways'], status: 'Created', pmSignature: null },
  { id: 'SW-212', title: 'Level 3 wayfinding install', jobId: 'J-1047', onSite: day(3), hazards: ['Falls'], status: 'PM Signed', pmSignature: { name: 'Rachel Barnes', role: 'Project Manager', signedAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString() } },
  { id: 'SW-214', title: 'Façade lightbox removal', jobId: 'J-1053', onSite: day(10), hazards: ['Demolition', 'Dust', 'Hot Works'], status: 'Created', pmSignature: null },
];

export const installTasks = [
  { id: 'I1', name: 'Wayfinding L1-L2', jobId: 'J-1047', type: 'VE Install', date: day(-3), leader: 'Dave K.', member: 'Sam T.', stage: 'In Progress', swms: 'Completed', quoted: 32, booked: 30 },
  { id: 'I2', name: 'Wayfinding L3', jobId: 'J-1047', type: 'VE Install', date: day(3), leader: 'Dave K.', member: 'Sam T.', stage: 'Scheduled', swms: 'PM Signed', quoted: 24, booked: 0 },
  { id: 'I3', name: 'Building letters touch-up', jobId: 'J-1058', type: 'Minor Task', date: day(0), leader: 'Luke M.', member: '', stage: 'In Progress', swms: 'Not Required', quoted: 6, booked: 4 },
  { id: 'I4', name: 'Pylon crane lift', jobId: 'J-1042', type: 'VE Install', date: day(4), leader: 'Luke M.', member: 'Dave K.', stage: 'Scheduled', swms: 'Created', quoted: 16, booked: 0 },
  { id: 'I5', name: 'Hoarding vinyl wrap', jobId: 'J-1051', type: 'Print Only', date: day(11), leader: 'Sam T.', member: 'Jo P.', stage: 'Awaiting Scheduling', swms: 'Not Required', quoted: 20, booked: 0 },
  { id: 'I6', name: 'Façade lightbox removal', jobId: 'J-1053', type: 'VE Subtask', date: day(10), leader: 'Dave K.', member: 'Jo P.', stage: 'Scheduled', swms: 'Created', quoted: 10, booked: 0 },
  { id: 'I7', name: 'Electrical connection', jobId: 'J-1053', type: 'External Install', date: day(13), leader: 'Spark Co.', member: '', stage: 'Awaiting Scheduling', swms: 'Not Required', quoted: 4, booked: 0 },
  { id: 'I8', name: 'Building letters L5', jobId: 'J-1058', type: 'VE Install', date: day(-9), leader: 'Luke M.', member: 'Sam T.', stage: 'Manager Review', swms: 'Completed', quoted: 28, booked: 36 },
];

export const installTypeStyles = {
  'VE Install': '#4caf3a',
  'VE Subtask': '#2f80ed',
  'Minor Task': '#f2a33a',
  'Print Only': '#a855f7',
  'External Install': '#7b8794',
};

export const fabTasks = [
  { id: 'F1', name: 'Pylon panel CNC cut', jobId: 'J-1042', type: 'CNC Router', date: day(-2), leader: 'Mia T.', member: 'Sam T.', stage: 'In Progress', quoted: 24, booked: 18 },
  { id: 'F2', name: 'Pylon frame welding', jobId: 'J-1042', type: 'Metal', date: day(1), leader: 'Tom H.', member: 'Jo P.', stage: 'Scheduled', quoted: 30, booked: 0 },
  { id: 'F3', name: 'Pylon spray paint', jobId: 'J-1042', type: 'Paint', date: day(5), leader: 'Mia T.', member: '', stage: 'Awaiting Scheduling', quoted: 16, booked: 0 },
  { id: 'F4', name: 'Façade LED module fit', jobId: 'J-1053', type: 'LED', date: day(2), leader: 'Tom H.', member: 'Sam T.', stage: 'Manager Review', quoted: 12, booked: 12 },
  { id: 'F5', name: 'Letter faces cut and pack', jobId: 'J-1058', type: 'CNC Router', date: day(-8), leader: 'Mia T.', member: 'Jo P.', stage: 'Completed', quoted: 20, booked: 19 },
];
