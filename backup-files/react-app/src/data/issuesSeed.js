// SAMPLE DATA ONLY. Fields, departments and statuses come from the Creator "Issues" form.
import { addDays, toKey, today } from '../lib/dates';

export const DEPARTMENTS = ['Install', 'Civic Billboards', 'Workshop', 'Management', 'VT/Digital Screens'];
// Creator has "To Be Quoted" on the issue and "To be Quoted" on its history rows. One spelling is used here.
export const STATUSES = ['To Be discussed', 'In Progress', 'Completed'];
export const PRIORITIES = ['High', 'Medium', 'Low'];
export const DIRECTIONS = ['Inbound', 'Outbound', 'Middle Panel'];
export const SITES = ['Tullamarine Fwy north face', 'Citylink panel 12', 'West Gate digital screen'];
// Setup form: one manager per department, plus "inform also" lists. SAMPLE names.
export const ISSUE_MANAGERS = {
  Install: { manager: 'Rachel Barnes', also: ['Dave Kerr'] },
  Workshop: { manager: 'Tom Hendry', also: ['Mia Torres'] },
  Management: { manager: 'Anna Lee', also: [] },
  'VT/Digital Screens': { manager: 'Ben Ortiz', also: ['Anna Lee'] },
  'Civic Billboards': { manager: 'Chloe Nguyen', also: ['Rachel Barnes'] },
};
export const PEOPLE = ['Rachel Barnes', 'Tom Hendry', 'Mia Torres', 'Dave Kerr', 'Sam Taylor', 'Jo Patel', 'Anna Lee', 'Ben Ortiz', 'Chloe Nguyen'];

const d = (n) => toKey(addDays(today(), n));
const iso = (n) => addDays(today(), n).toISOString();
const mgr = (dep) => ISSUE_MANAGERS[dep];

const make = (id, o) => ({
  location: '', site: '', direction: '', taskId: '', review: '', completionNotes: '', dateCompleted: '', history: [],
  assignedTo: mgr(o.department).manager, notify: mgr(o.department).also, ...o, status: ['Completed','In Progress','To Be discussed'].includes(o.status) ? o.status : 'In Progress', id,
});

export const seedIssues = [
  make('IS-1', { subject: 'Ladder rack damaged on van 3', description: 'Rear ladder rack bent after a low-clearance incident. Not safe to carry long lengths.', department: 'Install', priority: 'High', status: 'In Progress', reportedBy: 'Dave Kerr', date: d(-6), location: 'Sunshine West depot', taskId: 'I1', review: 'WHS Reported', dueDate: d(2),
    history: [{ at: iso(-5), by: 'Rachel Barnes', personResponsible: 'Tom Hendry', status: 'In Progress', nextStep: 'Quote for a replacement rack', workCompleted: '', dueDate: d(2) }] }),
  make('IS-2', { subject: 'Panel 12 face lighting out', description: 'Left half of the face is dark after dusk.', department: 'Civic Billboards', priority: 'High', status: 'To Be Quoted', reportedBy: 'Mia Torres', date: d(-3), site: 'Citylink panel 12', direction: 'Outbound', dueDate: d(-1),
    history: [{ at: iso(-2), by: 'Chloe Nguyen', personResponsible: 'Chloe Nguyen', status: 'To Be Quoted', nextStep: 'Get a lift and electrician quote', workCompleted: '', dueDate: d(-1) }] }),
  make('IS-3', { subject: 'CNC router vacuum table losing suction', description: 'Parts shifting during cuts since Monday.', department: 'Workshop', priority: 'Medium', status: 'To Be discussed', reportedBy: 'Sam Taylor', date: d(-2), location: 'Workshop bay 2', taskId: 'F1', review: 'Management Review', dueDate: '' }),
  make('IS-4', { subject: 'Update the induction checklist template', description: 'New site rules need adding before next month.', department: 'Management', priority: 'Low', status: 'On Hold', reportedBy: 'Rachel Barnes', date: d(-12), dueDate: d(14),
    history: [{ at: iso(-10), by: 'Anna Lee', personResponsible: 'Anna Lee', status: 'On Hold', nextStep: 'Wait for the updated site rules', workCompleted: '', dueDate: d(14) }] }),
  make('IS-5', { subject: 'Digital screen shows the wrong playlist', description: 'Lobby screen is looping last month\'s content.', department: 'VT/Digital Screens', priority: 'Medium', status: 'Quote Sent', reportedBy: 'Jo Patel', date: d(-9), site: 'West Gate digital screen', dueDate: d(5),
    history: [{ at: iso(-7), by: 'Ben Ortiz', personResponsible: 'Ben Ortiz', status: 'Quoted', nextStep: 'Send the quote for remote content access', workCompleted: '', dueDate: d(3) },
      { at: iso(-4), by: 'Ben Ortiz', personResponsible: 'Ben Ortiz', status: 'Quote Sent', nextStep: 'Follow up with the client', workCompleted: '', dueDate: d(5) }] }),
  make('IS-6', { subject: 'Hi-vis stock running low', description: 'Fewer than five vests left in the install store.', department: 'Install', priority: 'Low', status: 'Completed', reportedBy: 'Dave Kerr', date: d(-15), dueDate: d(-8), dateCompleted: d(-9), completionNotes: 'Ordered 20 vests. Delivered and stocked.',
    history: [{ at: iso(-14), by: 'Rachel Barnes', personResponsible: 'Rachel Barnes', status: 'In Progress', nextStep: 'Place a supplier order', workCompleted: '', dueDate: d(-8) },
      { at: iso(-9), by: 'Rachel Barnes', personResponsible: 'Rachel Barnes', status: 'Completed', nextStep: '', workCompleted: 'Ordered 20 vests. Delivered and stocked.', dueDate: '' }] }),
  make('IS-7', { subject: 'Spray booth filter overdue', description: 'Filter change is two weeks past the maintenance date.', department: 'Workshop', priority: 'High', status: 'In Progress', reportedBy: 'Tom Hendry', date: d(-4), location: 'Spray booth', dueDate: d(1),
    history: [{ at: iso(-3), by: 'Tom Hendry', personResponsible: 'Jo Patel', status: 'In Progress', nextStep: 'Fit the new filter', workCompleted: '', dueDate: d(1) }] }),
];
