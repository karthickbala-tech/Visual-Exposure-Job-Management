/**
 * How roles and permission areas are written on screen. Same words as the server (lib/config.js ROLE_LABELS).
 * Before this, screens turned the key into words ("second_ic" -> "second ic") and CSS capitalised it into "Second Ic".
 */
export const ROLE_LABEL: Record<string, string> = {
	admin: 'Administrator',
	project_manager: 'Project Manager',
	fab_manager: 'Fab Manager',
	install_coordinator: 'Install Coordinator',
	second_ic: 'Second IC',
	installer: 'Installer',
	fab_worker: 'Fab Worker',
	workshop: 'Workshop',
	designer: 'Designer',
	contractor: 'Contractor',
	viewer: 'Viewer',
};

/** Every role, in the order screens list them. */
export const ROLE_KEYS = Object.keys(ROLE_LABEL);

export const roleLabel = (r: string): string => ROLE_LABEL[r] ?? r.replace(/_/g, ' ');

/** The areas of the permission matrix (server: lib/domain/matrix.js RESOURCES, without '*'), with their names. */
export const AREA_LABEL: Record<string, string> = {
	jobs: 'Jobs',
	tasks: 'Tasks',
	sites: 'Sites',
	signs: 'Signs',
	people: 'People',
	hours: 'Hours',
	issues: 'Issues',
	swms: 'SWMS',
	compliance: 'Compliance',
	companies: 'Companies',
	equipment: 'Equipment',
	devices: 'Devices',
};
