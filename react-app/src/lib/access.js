// Which sidebar sections each role can open. This is a PROPOSAL for the demo.
// The Creator export has no permission profiles, so confirm this table with the client.
const ALL = ['/', '/jobs', '/design', '/fabrication', '/installation', '/swms', '/hours', '/issues', '/workers'];

export const ACCESS = {
  pm: [...ALL, '/calendar', '/equipment', '/devices'],
  fabManager: [...ALL, '/calendar', '/equipment', '/devices'],
  ic2: ['/', '/jobs', '/fabrication', '/installation', '/calendar', '/hours', '/issues', '/workers', '/equipment'],
  fabWorker: ['/', '/jobs', '/swms', '/hours', '/issues', '/workers'],
  installer: ['/', '/jobs', '/installation', '/swms', '/hours', '/issues', '/workers'],
  workshop: ['/', '/jobs', '/fabrication', '/hours', '/issues', '/workers', '/equipment'],
};

export const KNOWN_SECTIONS = new Set(Object.values(ACCESS).flat());
// "/swms/SW-209" belongs to the "/swms" section.
export const sectionOf = (pathname) => { const seg = pathname.split('/')[1]; return seg ? `/${seg}` : '/'; };
export const canAccess = (roleId, path) => (ACCESS[roleId] || []).includes(sectionOf(path));

// Who can add and edit equipment, chemicals and workshop locations. Everyone with access can mark a check as done. PROPOSAL: confirm with the client.
export const EQUIPMENT_EDITORS = ['pm', 'fabManager', 'workshop'];
