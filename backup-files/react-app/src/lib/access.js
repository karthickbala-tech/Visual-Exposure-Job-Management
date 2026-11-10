// Which sidebar sections each role can open. This is a PROPOSAL for the demo.
// The Creator export has no permission profiles, so confirm this table with the client.
const ALL = ['/', '/jobs', '/design', '/fabrication', '/installation', '/swms', '/hours', '/issues', '/workers', '/checklists'];

export const ACCESS = {
  pm: [...ALL, '/calendar', '/equipment', '/devices', '/checklists'],
  fabManager: [...ALL, '/calendar', '/equipment', '/devices', '/checklists'],
  ic2: ['/', '/jobs', '/fabrication', '/installation', '/calendar', '/hours', '/issues', '/workers', '/equipment', '/checklists'],
  fabWorker: ['/', '/jobs', '/swms', '/hours', '/issues', '/workers', '/checklists'],
  installer: ['/', '/jobs', '/installation', '/swms', '/hours', '/issues', '/workers', '/checklists'],
  workshop: ['/', '/jobs', '/fabrication', '/hours', '/issues', '/workers', '/equipment', '/checklists'],
  // Admin sees everything, including the two admin-only screens.
  admin: [...ALL, '/calendar', '/equipment', '/devices', '/compliance', '/admin', '/checklists'],
  // Install Coordinator: install dashboard, hours reports, calendars (FSD section 2).
  installCoordinator: ['/', '/jobs', '/installation', '/calendar', '/swms', '/hours', '/issues', '/workers', '/checklists'],
  // Designer: design tasks and design checklists.
  designer: ['/', '/jobs', '/design', '/hours', '/issues', '/checklists'],
  // Contractor: own install work only. No Workers screen, so no employee PII (FSD section 2).
  contractor: ['/', '/jobs', '/installation', '/swms', '/hours', '/issues', '/checklists'],
  // Viewer: read-only list screens. Workers and Hours are left out because they hold PII (FSD section 2).
  viewer: ['/', '/jobs', '/design', '/fabrication', '/installation', '/calendar', '/swms', '/issues', '/equipment', '/devices', '/checklists'],
};

export const KNOWN_SECTIONS = new Set(Object.values(ACCESS).flat());
// "/swms/SW-209" belongs to the "/swms" section.
export const sectionOf = (pathname) => { const seg = pathname.split('/')[1]; return seg ? `/${seg}` : '/'; };
export const canAccess = (roleId, path) => (ACCESS[roleId] || []).includes(sectionOf(path));

// Who can add and edit equipment, chemicals and workshop locations. Everyone with access can mark a check as done. PROPOSAL: confirm with the client.
export const EQUIPMENT_EDITORS = ['admin', 'pm', 'fabManager', 'workshop'];
