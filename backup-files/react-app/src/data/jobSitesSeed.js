// SAMPLE DATA ONLY (fictional sites and signs). Replace with the site, sign_group and sign tables when Catalyst is connected.
// Sign stage values are placeholders: confirm the picklists against the CRM Assets (Sign) module.
export const seedSites = [
  { id: 'S-101', jobId: 'J-1042', name: 'Northgate Shopping Centre', address: '120 Northgate Drive', suburb: 'Preston', state: 'VIC', postcode: '3072', lat: -37.7389, lng: 145.0127 },
  { id: 'S-102', jobId: 'J-1047', name: 'Harbourline Distribution Hub', address: '8 Dockside Road', suburb: 'Port Melbourne', state: 'VIC', postcode: '3207', lat: -37.8353, lng: 144.9392 },
  { id: 'S-103', jobId: 'J-1051', name: 'Metro Tunnel Works Site', address: 'Swanston Street (north gate)', suburb: 'Melbourne', state: 'VIC', postcode: '3000', lat: -37.8097, lng: 144.9631 },
  { id: 'S-104', jobId: 'J-1053', name: 'Southern Cross Hardware, Dandenong', address: '45 Frankston-Dandenong Road', suburb: 'Dandenong', state: 'VIC', postcode: '3175', lat: -37.9906, lng: 145.2147 },
  { id: 'S-105', jobId: 'J-1058', name: 'Eastfield University, Science Building', address: '1 University Avenue', suburb: 'Bundoora', state: 'VIC', postcode: '3083', lat: -37.7156, lng: 145.0457 },
  { id: 'S-106', jobId: 'J-1058', name: 'Eastfield University, Library', address: '3 University Avenue', suburb: 'Bundoora', state: 'VIC', postcode: '3083', lat: -37.7168, lng: 145.0481 },
  { id: 'S-107', jobId: 'J-1039', name: 'Summit Supermarkets, Westbrook', address: '210 Westbrook Parade', suburb: 'Werribee', state: 'VIC', postcode: '3030', lat: -37.9, lng: 144.6594 },
  { id: 'S-108', jobId: 'J-1060', name: 'Summit Supermarkets, Pylon Site', address: '77 Highway Boulevard', suburb: 'Hoppers Crossing', state: 'VIC', postcode: '3029', lat: -37.8789, lng: 144.7006 },
];

// stages: [deal, artwork, manufacturing, install]
const S = (id, jobId, siteId, group, name, rev, qty, medium, finishing, stages) => ({
  id, jobId, siteId, group, name, rev, qty, medium, finishing,
  deal: stages[0], artwork: stages[1], manufacturing: stages[2], install: stages[3],
});

export const seedSigns = [
  S('SG-1', 'J-1042', 'S-101', 'Pylons', 'Main pylon, north entry', 'C', 1, 'Aluminium and acrylic', 'Satin paint, LED backlit', ['Won', 'Approved', 'In fabrication', 'Not started']),
  S('SG-2', 'J-1042', 'S-101', 'Pylons', 'Secondary pylon, car park', 'B', 1, 'Aluminium and acrylic', 'Satin paint', ['Won', 'Approved', 'In fabrication', 'Not started']),
  S('SG-3', 'J-1042', 'S-101', 'Directional', 'Directional blades', 'A', 6, 'Aluminium', 'Powder coat', ['Won', 'In design', 'Not started', 'Not started']),
  S('SG-4', 'J-1047', 'S-102', 'Wayfinding', 'Level 1 wayfinding set', 'B', 12, 'Aluminium composite', 'Digital print, laminate', ['Won', 'Approved', 'Complete', 'Installed']),
  S('SG-5', 'J-1047', 'S-102', 'Wayfinding', 'Level 3 wayfinding set', 'B', 14, 'Aluminium composite', 'Digital print, laminate', ['Won', 'Approved', 'Complete', 'Scheduled']),
  S('SG-6', 'J-1051', 'S-103', 'Hoardings', 'Hoarding wrap, north gate', 'A', 24, 'Printed vinyl', 'Anti-graffiti laminate', ['Won', 'In design', 'Not started', 'Not started']),
  S('SG-7', 'J-1053', 'S-104', 'Facade', 'Facade lightbox', 'D', 1, 'Aluminium extrusion, tensioned fabric', 'LED modules', ['Won', 'Approved', 'In fabrication', 'Not started']),
  S('SG-8', 'J-1053', 'S-104', 'Facade', 'Existing lightbox removal', 'A', 1, 'Removal', 'Make good', ['Won', 'Approved', 'Complete', 'Scheduled']),
  S('SG-9', 'J-1058', 'S-105', 'Building letters', 'Science Building letters', 'C', 14, 'Stainless steel', 'Brushed, stud mounted', ['Won', 'Approved', 'Complete', 'Installed']),
  S('SG-10', 'J-1058', 'S-106', 'Building letters', 'Library entry letters', 'A', 9, 'Stainless steel', 'Brushed, stud mounted', ['Won', 'Approved', 'Complete', 'Installed']),
  S('SG-11', 'J-1039', 'S-107', 'Entry', 'Entry sign', 'B', 1, 'Routed aluminium', 'Satin paint', ['Won', 'Approved', 'Complete', 'Installed']),
  S('SG-12', 'J-1060', 'S-108', 'Pylons', 'Concept pylon', 'A', 1, 'To be confirmed', 'To be confirmed', ['Quoted', 'Not started', 'Not started', 'Not started']),
];
