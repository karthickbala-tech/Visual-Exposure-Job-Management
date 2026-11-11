import { AlertTriangle, BarChart3, Boxes, Briefcase, Building2, CalendarDays, ClipboardList, Clock, Contact, FileCheck2, HardHat, KanbanSquare, Layers, LayoutDashboard, Settings, ShieldCheck, Smartphone, Users, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/** Roles that may open each screen. Only for showing menus and a friendly "No access" page: the server enforces access regardless. */
export const MANAGERS = ['admin', 'project_manager', 'fab_manager', 'install_coordinator'];
const OFFICE = [...MANAGERS, 'second_ic'];
export const ROUTE_ROLES: Record<string, string[] | undefined> = {
	design: [...OFFICE, 'viewer'],
	fabrication: [...OFFICE, 'fab_worker', 'workshop', 'viewer'],
	installation: [...OFFICE, 'installer', 'viewer'],
	hours: [...OFFICE, 'installer', 'fab_worker', 'workshop'],
	swms: [...OFFICE, 'installer'],
	checklists: MANAGERS,
	equipment: [...OFFICE, 'workshop', 'fab_worker'],
	directory: [...OFFICE, 'viewer'],
	people: OFFICE,
	devices: MANAGERS,
	admin: ['admin'],
};

export interface NavItem {
	to: string;
	label: string;
	icon: LucideIcon;
	end?: boolean;
	roles?: string[];
}
export interface NavGroup {
	key: string;
	label: string;
	icon: LucideIcon;
	items: NavItem[];
}
export type NavEntry = NavItem | NavGroup;
export const isGroup = (e: NavEntry): e is NavGroup => 'items' in e;

/** The menu: a few groups so fourteen items do not sit in one long list (the same grouping the owner picked from the second design). Every entry has its own icon, groups included, so none repeats. */
export const NAV: NavEntry[] = [
	{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
	{
		key: 'work',
		label: 'Work',
		icon: Layers,
		items: [
			{ to: '/jobs', label: 'Jobs', icon: Briefcase },
			{ to: '/tasks', label: 'Task board', icon: KanbanSquare },
			{ to: '/calendar', label: 'Calendar', icon: CalendarDays },
				{ to: '/variance', label: 'Fab variance', icon: BarChart3 },
		],
	},
	{
		key: 'field',
		label: 'Field and safety',
		icon: HardHat,
		items: [
			{ to: '/swms', label: 'SWMS', icon: FileCheck2, roles: ROUTE_ROLES.swms },
			{ to: '/reports/checklists', label: 'Checklists', icon: ClipboardList, roles: ROUTE_ROLES.checklists },
			{ to: '/hours', label: 'Hours', icon: Clock, roles: ROUTE_ROLES.hours },
			{ to: '/issues', label: 'Issues', icon: AlertTriangle },
		],
	},
	{
		key: 'people',
		label: 'Team',
		icon: Contact,
		items: [
			{ to: '/people', label: 'People', icon: Users, roles: ROUTE_ROLES.people },
			{ to: '/compliance', label: 'Compliance', icon: ShieldCheck },
			{ to: '/directory', label: 'Companies and sites', icon: Building2, roles: ROUTE_ROLES.directory },
		],
	},
	{
		key: 'assets',
		label: 'Assets',
		icon: Boxes,
		items: [
			{ to: '/equipment', label: 'Equipment', icon: Wrench, roles: ROUTE_ROLES.equipment },
			{ to: '/devices', label: 'Devices', icon: Smartphone, roles: ROUTE_ROLES.devices },
		],
	},
	{ to: '/admin', label: 'Admin', icon: Settings, roles: ROUTE_ROLES.admin },
];

const sees = (item: NavItem, roles: string[]) => !item.roles || item.roles.some((r) => roles.includes(r));

/** What this person's roles may see: items they cannot open are dropped; an empty group disappears; a group with one item shows that item alone. */
export function visibleNav(roles: string[]): NavEntry[] {
	const out: NavEntry[] = [];
	for (const e of NAV) {
		if (!isGroup(e)) {
			if (sees(e, roles)) out.push(e);
			continue;
		}
		const items = e.items.filter((i) => sees(i, roles));
		if (items.length === 1) out.push(items[0]);
		else if (items.length > 1) out.push({ ...e, items });
	}
	return out;
}

/** The key of the sidebar group that holds this route ('work', 'field', 'people', 'assets'), or undefined for pages outside the groups. Colours follow it. */
export function moduleOf(pathname: string): string | undefined {
	for (const e of NAV) {
		if (isGroup(e) && e.items.some((i) => pathname === i.to || pathname.startsWith(i.to + '/'))) return e.key;
	}
	return undefined;
}

/** Every item, flat (for the collapsed rail and for people who turn grouping off). */
export const flatNav = (entries: NavEntry[]): NavItem[] => entries.flatMap((e) => (isGroup(e) ? e.items : [e]));
