// Which sidebar sections each role can open. This is a PROPOSAL for the demo.
// The Creator export has no permission profiles, so confirm this table with the client.
const ALL = ['/', '/jobs', '/design', '/fabrication', '/installation', '/swms', '/hours', '/issues', '/workers'];

export const ACCESS = {
  pm: ALL,
  fabManager: ALL,
  ic2: ['/', '/jobs', '/fabrication', '/installation', '/hours', '/issues', '/workers'],
  fabWorker: ['/', '/jobs', '/swms', '/hours', '/issues', '/workers'],
  installer: ['/', '/jobs', '/installation', '/swms', '/hours', '/issues', '/workers'],
  workshop: ['/', '/jobs', '/fabrication', '/hours', '/issues', '/workers'],
};

export const KNOWN_SECTIONS = new Set(Object.values(ACCESS).flat());
// "/swms/SW-209" belongs to the "/swms" section.
export const sectionOf = (pathname) => { const seg = pathname.split('/')[1]; return seg ? `/${seg}` : '/'; };
export const canAccess = (roleId, path) => (ACCESS[roleId] || []).includes(sectionOf(path));
