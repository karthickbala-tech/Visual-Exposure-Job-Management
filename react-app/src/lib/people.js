// Sample data matches people by short name ("Mia T."). Replace with worker IDs when Catalyst is connected.
export const shortName = (full) => {
  const [first, last = ''] = String(full || '').split(' ');
  return `${first} ${last.charAt(0)}.`;
};

// Kept for older imports. Screens now build their pickers from the Workers register (crewOptions).
export const FAB_CREW = ['Mia T.', 'Tom H.', 'Sam T.', 'Jo P.'];
export const INSTALL_CREW = ['Dave K.', 'Luke M.', 'Sam T.', 'Jo P.', 'Spark Co.'];

// TSK-3: a crew is one team leader plus any number of team members. Older records hold a single `member`.
export const membersOf = (task) => {
  if (!task) return [];
  if (Array.isArray(task.members)) return task.members.filter(Boolean);
  return task.member ? [task.member] : [];
};

// The fields a task stores for a crew. `member` is kept as the first member so older screens and seed data still read.
export const crewFields = (leader, members = []) => {
  const list = [...new Set((members || []).filter((m) => m && m !== leader))];
  return { leader: leader || '', members: list, member: list[0] || '' };
};

const FAB_TYPES = ['Employee - FT Fabricator', 'Employee - Casual Fabricator', 'Subby - Local Fabricator'];
const INSTALL_TYPES = ['Employee - FT Installer', 'Employee - Casual Installer', 'Subby - Local Installer', 'Subby - Local Wet Hire Contractor', 'Subby - Interstate'];
const FAB_ROLES = ['Fab Manager', 'Fab 2IC', 'Fabricator', 'Workshop'];
const INSTALL_ROLES = ['Installer'];

// Who can be put on a fab or install crew: active people from the Workers register. VE fabricators also help on installs,
// as they do in the Creator data. `keep` adds names already on the task so an edit never drops them silently.
export function crewOptions(workers, kind, keep = []) {
  const fits = (w) => {
    if (!w.active) return false;
    if (kind === 'fab') return FAB_ROLES.includes(w.primaryRole) || FAB_TYPES.includes(w.type);
    return INSTALL_ROLES.includes(w.primaryRole) || INSTALL_TYPES.includes(w.type)
      || (w.companyId === 'C-1' && ['Fabricator', 'Workshop'].includes(w.primaryRole));
  };
  const names = (workers || []).filter(fits).map((w) => shortName(w.name));
  return [...new Set([...names, ...keep.filter(Boolean)])].sort();
}

// DES-1: design tasks go to designers, or to a PM who does their own artwork. Existing owners are kept in the list.
export function designerOptions(workers, tasks = []) {
  const names = (workers || []).filter((w) => w.active && ['Designer', 'Project Manager'].includes(w.primaryRole)).map((w) => shortName(w.name));
  const owners = tasks.filter((t) => t.kind === 'design' && t.owner).map((t) => t.owner);
  return [...new Set([...names, ...owners])].sort();
}
