// Sample data matches people by short name ("Mia T."). Replace with worker IDs when Catalyst is connected.
export const shortName = (full) => {
  const [first, last = ''] = full.split(' ');
  return `${first} ${last.charAt(0)}.`;
};
export const FAB_CREW = ['Mia T.', 'Tom H.', 'Sam T.', 'Jo P.'];
export const INSTALL_CREW = ['Dave K.', 'Luke M.', 'Sam T.', 'Jo P.', 'Spark Co.'];
