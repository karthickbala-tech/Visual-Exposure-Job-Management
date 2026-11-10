// Calendar screens (FSD section 12: Fab Calendar, Install Calendar, Unified Calendar). Pure functions.
const EXCLUDED_INSTALL = ['External Install', 'Print Only']; // FSD 5.12: the install calendar leaves these out

export const showOnInstallCalendar = (task, includeAll = false) => includeAll || !EXCLUDED_INSTALL.includes(task.type);

// tab: 'unified' | 'fab' | 'install'. types: array of type names to keep (empty means all).
export function calendarEvents(tasks, { tab = 'unified', types = [], includeAll = false } = {}) {
  const keep = (t) => types.length === 0 || types.includes(t.type);
  const fab = tasks.filter((t) => t.kind === 'fab' && t.stage !== 'Cancelled' && keep(t));
  const install = tasks.filter((t) => t.kind === 'install' && t.stage !== 'Cancelled' && showOnInstallCalendar(t, includeAll) && keep(t));
  const ev = (t, prefix) => ({ id: t.id, date: t.date, title: prefix ? `${prefix}: ${t.name}` : t.name, type: t.type });
  if (tab === 'fab') return fab.map((t) => ev(t));
  if (tab === 'install') return install.map((t) => ev(t));
  return [...install.map((t) => ev(t, 'Install')), ...fab.map((t) => ev(t, 'Fab'))];
}
