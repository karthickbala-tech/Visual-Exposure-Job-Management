// SAMPLE DATA ONLY. Tool codes follow the Creator pattern "VE - n". Replace with Catalyst API calls later.
import { addDays, toKey, today } from '../lib/dates';

const ago = (n) => toKey(addDays(today(), -n));

export const EQUIPMENT_TYPES = ['Power tool', 'CNC', 'Welding', 'Paint', 'Print', 'Access', 'Lifting'];
export const CHEMICAL_UNITS = ['L', 'mL', 'kg', 'cylinders', 'units'];

export const seedLocations = [
  { id: 'L-1', name: 'Main bay', supervisor: 'Tom H.', notes: 'Fabrication, assembly and finishing.' },
  { id: 'L-2', name: 'CNC room', supervisor: 'Mia T.', notes: 'Router and laser. Dust extraction on.' },
  { id: 'L-3', name: 'Paint booth', supervisor: 'Jo P.', notes: 'Spray painting only. Respirators required.' },
  { id: 'L-4', name: 'Store', supervisor: 'Sam T.', notes: 'Materials and chemical storage.' },
  { id: 'L-5', name: 'Yard', supervisor: 'Tom H.', notes: 'Lifts, vehicles and outdoor storage.' },
];

const ahead = (n) => toKey(addDays(today(), n));
export const seedChemicals = [
  { id: 'CH-1', name: 'Acetone', supplier: 'Chemcentre', hazardClass: '3 Flammable liquid', location: 'Store', stock: 20, unit: 'L', sdsUrl: 'https://example.com/sds/acetone.pdf', reviewDate: ahead(40) },
  { id: 'CH-2', name: '2-pack automotive paint', supplier: 'Paintright', hazardClass: '3 Flammable liquid', location: 'Paint booth', stock: 12, unit: 'L', sdsUrl: 'https://example.com/sds/2pack-paint.pdf', reviewDate: ahead(-15) },
  { id: 'CH-3', name: 'Vinyl surface cleaner', supplier: 'Signsupply', hazardClass: 'Not classified', location: 'Main bay', stock: 6, unit: 'L', sdsUrl: 'https://example.com/sds/vinyl-cleaner.pdf', reviewDate: ahead(200) },
  { id: 'CH-4', name: 'Two-part epoxy adhesive', supplier: 'Bondtech', hazardClass: '8 Corrosive', location: 'Store', stock: 9, unit: 'units', sdsUrl: 'https://example.com/sds/epoxy.pdf', reviewDate: ahead(90) },
  { id: 'CH-5', name: 'Isopropyl alcohol', supplier: 'Chemcentre', hazardClass: '3 Flammable liquid', location: 'Main bay', stock: 5, unit: 'L', sdsUrl: '', reviewDate: ahead(120) },
  { id: 'CH-6', name: 'LPG cylinder', supplier: 'Gasworks', hazardClass: '2.1 Flammable gas', location: 'Yard', stock: 3, unit: 'cylinders', sdsUrl: 'https://example.com/sds/lpg.pdf', reviewDate: ahead(300) },
];

const mins = (n) => new Date(Date.now() - n * 60000).toISOString();
// Location is empty when the MDM returns none. Those devices are listed but not plotted (FSD §6, MDM sync).
export const seedDevices = [
  { id: 'D-1', workerId: 'W-1', model: 'iPhone 13', os: 'iOS 17.5', serial: 'F2LZ8Q1VK2', lat: -37.8136, lng: 144.9631, address: 'Melbourne CBD VIC', seenAt: mins(12) },
  { id: 'D-2', workerId: 'W-2', model: 'Galaxy A54', os: 'Android 14', serial: 'RZ8T30KDM1', lat: -37.7955, lng: 144.8305, address: 'Sunshine West VIC (workshop)', seenAt: mins(4) },
  { id: 'D-3', workerId: 'W-3', model: 'Galaxy A54', os: 'Android 14', serial: 'RZ8T30KDM7', lat: -37.7955, lng: 144.8305, address: 'Sunshine West VIC (workshop)', seenAt: mins(9) },
  { id: 'D-4', workerId: 'W-5', model: 'iPhone 12', os: 'iOS 17.4', serial: 'G6KX2P9LQ4', lat: -37.9906, lng: 145.2147, address: 'Dandenong VIC', seenAt: mins(35) },
  { id: 'D-5', workerId: 'W-6', model: 'iPhone SE', os: 'iOS 16.7', serial: 'C8QW55HN03', lat: null, lng: null, address: '', seenAt: null },
  { id: 'D-6', workerId: 'W-7', model: 'Galaxy A34', os: 'Android 13', serial: 'RZ9M41TTB2', lat: -37.8250, lng: 144.9580, address: 'Southbank VIC', seenAt: mins(60 * 30) },
];

export const seedEquipment = [
  { id: 'VE - 101', name: 'Panel saw', type: 'Power tool', location: 'Main bay', status: 'In service', intervalDays: 90, lastChecked: ago(100), responsible: 'Jo P.', history: [] },
  { id: 'VE - 102', name: 'CNC router', type: 'CNC', location: 'CNC room', status: 'In service', intervalDays: 30, lastChecked: ago(20), responsible: 'Mia T.', history: [] },
  { id: 'VE - 103', name: 'Laser cutter', type: 'CNC', location: 'CNC room', status: 'In service', intervalDays: 30, lastChecked: ago(45), responsible: 'Mia T.', history: [] },
  { id: 'VE - 104', name: 'Spray booth extraction', type: 'Paint', location: 'Paint booth', status: 'In service', intervalDays: 60, lastChecked: ago(75), responsible: 'Jo P.', history: [] },
  { id: 'VE - 105', name: 'MIG welder', type: 'Welding', location: 'Main bay', status: 'In service', intervalDays: 90, lastChecked: ago(30), responsible: 'Tom H.', history: [] },
  { id: 'VE - 106', name: 'Scissor lift (hired)', type: 'Access', location: 'Yard', status: 'In service', offHireRequired: true, intervalDays: 30, lastChecked: ago(35), responsible: 'Tom H.', history: [] },
  { id: 'VE - 107', name: 'Boom lift (hired)', type: 'Access', location: 'Yard', status: 'Off hire', offHireRequired: true, intervalDays: 30, lastChecked: ago(60), responsible: 'Tom H.', history: [] },
  { id: 'VE - 108', name: 'Vinyl plotter', type: 'Print', location: 'Main bay', status: 'In service', intervalDays: 180, lastChecked: ago(60), responsible: 'Jo P.', history: [] },
  { id: 'VE - 109', name: 'Air compressor', type: 'Power tool', location: 'Store', status: 'In service', intervalDays: 60, lastChecked: ago(10), responsible: 'Sam T.', history: [] },
  { id: 'VE - 110', name: 'Forklift', type: 'Lifting', location: 'Yard', status: 'In service', intervalDays: 30, lastChecked: ago(31), responsible: 'Jo P.', history: [] },
];
