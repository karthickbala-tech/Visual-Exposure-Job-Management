// SAMPLE DATA ONLY. Field names and lists come from the Creator forms. Ticket, induction and document types are examples.
import { addDays, toKey, today } from '../lib/dates';

export const VE_NAME = 'Visual Exposure';
export const WORKER_TYPES = ['Employee - FT Installer', 'Employee - Casual Installer', 'Employee - FT Fabricator', 'Employee - Casual Fabricator', 'Employee - Management',
  'Subby - Local Installer', 'Subby - Local Fabricator', 'Subby - Local Wet Hire Contractor', 'Subby - Interstate'];
export const COMPANY_TYPES = ['Local - Installer', 'Local - Fabricator', 'Local - Supplier', 'Interstate - Installer', 'Interstate - Full Service'];
export const PRIMARY_ROLES = ['Project Manager', 'Fab Manager', 'Fab 2IC', 'Fabricator', 'Installer', 'Workshop'];

export const ticketTypes = [
  { id: 'TT-1', name: 'Working at Heights', years: 2, ve: true, nonVe: true },
  { id: 'TT-2', name: 'EWP Licence', years: 5, ve: true, nonVe: false },
  { id: 'TT-3', name: 'First Aid', years: 3, ve: true, nonVe: false },
  { id: 'TT-4', name: 'Dogging', years: 5, ve: true, nonVe: true },
];
export const inductionTypes = [
  { id: 'IT-1', name: 'Crown', ve: true, nonVe: true },
  { id: 'IT-2', name: 'Vicinity', ve: true, nonVe: false },
  { id: 'IT-3', name: 'Fed Square', ve: false, nonVe: false },
];
export const docTypes = [
  { id: 'DT-1', name: 'Public liability insurance', years: 1, required: true },
  { id: 'DT-2', name: 'WorkCover certificate', years: 1, required: true },
  { id: 'DT-3', name: 'Subcontractor agreement', years: 3, required: false },
];

export const seedCompanies = [
  { id: 'C-1', name: VE_NAME, active: true, type: 'Local - Full Service', phone: '', email: '', suburb: 'Sunshine West', state: 'VIC' },
  { id: 'C-2', name: 'Apex Install Pty Ltd', active: true, type: 'Local - Installer', phone: '03 5550 0142', email: 'office@apexinstall.example', suburb: 'Dandenong', state: 'VIC' },
  { id: 'C-3', name: 'Northline Signs', active: true, type: 'Local - Fabricator', phone: '03 5550 0177', email: 'hello@northline.example', suburb: 'Preston', state: 'VIC' },
  { id: 'C-4', name: 'Southbank Rigging Co', active: true, type: 'Interstate - Installer', phone: '02 5550 0190', email: 'jobs@southbankrigging.example', suburb: 'Parramatta', state: 'NSW' },
];

export const seedWorkers = [
  { id: 'W-1', name: 'Rachel Barnes', active: true, companyId: 'C-1', type: 'Employee - Management', primaryRole: 'Project Manager', phone: '0400 000 101', email: 'rachel.b@example.com', start: '2019-03-04', skills: 'Project management, client liaison', ratings: [] },
  { id: 'W-2', name: 'Tom Hendry', active: true, companyId: 'C-1', type: 'Employee - Management', primaryRole: 'Fab Manager', phone: '0400 000 102', email: 'tom.h@example.com', start: '2016-07-18', skills: 'Welding, CNC, workshop planning', ratings: [] },
  { id: 'W-3', name: 'Mia Torres', active: true, companyId: 'C-1', type: 'Employee - FT Fabricator', primaryRole: 'Fab 2IC', phone: '0400 000 103', email: 'mia.t@example.com', start: '2020-01-13', skills: 'CNC router, vinyl, paint', ratings: [{ task: 'Pylon panels', type: 'Fab', role: 'Team Member', rating: 4.5 }, { task: 'Letters CCV', type: 'Fab', role: 'Team Member', rating: 5 }] },
  { id: 'W-4', name: 'Sam Taylor', active: true, companyId: 'C-1', type: 'Employee - FT Fabricator', primaryRole: 'Fabricator', phone: '0400 000 104', email: 'sam.t@example.com', start: '2021-05-24', skills: 'Metal fabrication, LED', ratings: [{ task: 'Pylon skins', type: 'Fab', role: 'Team Member', rating: 4 }] },
  { id: 'W-5', name: 'Dave Kerr', active: true, companyId: 'C-1', type: 'Employee - FT Installer', primaryRole: 'Installer', phone: '0400 000 105', email: 'dave.k@example.com', start: '2018-09-10', skills: 'Install team leader, EWP, signage', ratings: [{ task: 'Harbourline wayfinding', type: 'Install', role: 'Team Member', rating: 4.8 }] },
  { id: 'W-6', name: 'Jo Patel', active: true, companyId: 'C-1', type: 'Employee - Casual Fabricator', primaryRole: 'Workshop', phone: '0400 000 106', email: 'jo.p@example.com', start: '2023-02-06', skills: 'Paint, finishing', ratings: [] },
  { id: 'W-7', name: 'Luke Marsh', active: true, companyId: 'C-1', type: 'Employee - FT Installer', primaryRole: 'Installer', phone: '0400 000 107', email: 'luke.m@example.com', start: '2022-11-01', skills: 'Install, vinyl', ratings: [{ task: 'Level 3 wayfinding', type: 'Install', role: 'Team Member', rating: 4.2 }] },
  { id: 'W-8', name: 'Ravi Singh', active: true, companyId: 'C-2', type: 'Subby - Local Installer', primaryRole: '', phone: '0400 000 201', email: 'ravi@apexinstall.example', start: '2022-04-04', skills: 'Install crew, crane lifts', ratings: [] },
  { id: 'W-9', name: 'Kim Ho', active: true, companyId: 'C-3', type: 'Subby - Local Fabricator', primaryRole: '', phone: '0400 000 202', email: 'kim@northline.example', start: '2021-08-16', skills: 'Routing, folding', ratings: [] },
  { id: 'W-10', name: 'Ellis Ward', active: true, companyId: 'C-4', type: 'Subby - Interstate', primaryRole: '', phone: '0400 000 203', email: 'ellis@southbankrigging.example', start: '2024-01-22', skills: 'Rigging, high-rise installs', ratings: [] },
  { id: 'W-11', name: 'Pat Nguyen', active: false, companyId: 'C-2', type: 'Subby - Local Installer', primaryRole: '', phone: '0400 000 204', email: 'pat@apexinstall.example', start: '2020-06-01', skills: 'Install crew (left the company)', ratings: [] },
];

const day = (n) => (n === null ? '' : toKey(addDays(today(), n)));
// expiry offsets in days from today. null means "not filled in yet".
const PATTERN = [400, 12, -20, null, 700, 25, 300, null, 150, 18, -3, 520];
let k = 0;
const build = (types, flag, owners, prefix, ownerKey) => {
  const out = [];
  owners.forEach((o) => types.filter((t) => t[flag]).forEach((t) => {
    const off = PATTERN[k % PATTERN.length]; k += 1;
    out.push({ id: `${prefix}-${out.length + 1}`, [ownerKey]: o.id, typeId: t.id, ref: off === null ? '' : `${prefix}${1000 + k}`, issue: off === null ? '' : day(off - 365), expiry: day(off) });
  }));
  return out;
};
const ve = seedWorkers.filter((w) => w.companyId === 'C-1');
const nonVe = seedWorkers.filter((w) => w.companyId !== 'C-1');
export const seedTickets = [...build(ticketTypes, 've', ve, 'TK', 'workerId'), ...build(ticketTypes, 'nonVe', nonVe, 'TK2', 'workerId')].map((t, i) => ({ ...t, id: `TK-${i + 1}` }));
export const seedInductions = [...build(inductionTypes, 've', ve, 'IN', 'workerId'), ...build(inductionTypes, 'nonVe', nonVe, 'IN2', 'workerId')].map((t, i) => ({ ...t, id: `IN-${i + 1}` }));
export const seedCompanyDocs = seedCompanies.filter((c) => c.id !== 'C-1').flatMap((c, ci) => docTypes.filter((d) => d.required).map((d, di) => {
  const off = [200, 14, -9, 365, 40, 280][(ci * 2 + di) % 6];
  return { id: `CD-${ci * 2 + di + 1}`, companyId: c.id, typeId: d.id, name: d.name, issue: day(off - 365), expiry: day(off) };
}));
