import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle, Briefcase, CalendarDays, ChevronDown, ClipboardCheck, Clock, FolderKanban, Hammer, HardHat, LayoutDashboard,
  ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, PenTool, Settings, ShieldCheck, Smartphone, Truck, Users, Wrench, X, Boxes,
} from 'lucide-react';
import { NAV } from '../navConfig';
import { useDemo } from '../context/DemoContext';
import { usePrefs } from '../context/PrefsContext';
import { canAccess } from '../lib/access';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui-kit/dropdown-menu';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  calendar: CalendarDays, home: LayoutDashboard, jobs: Briefcase, design: PenTool, fab: Hammer, install: Truck,
  swms: ShieldCheck, checklist: ListChecks, compliance: ClipboardCheck, admin: Settings, hours: Clock, issues: AlertTriangle, people: Users, equipment: Wrench, devices: Smartphone,
};

// The menu in sections, so long role menus (Admin has 15 items) fold into 4 groups.
// Every role sees the same sections (with only the pages it may open), and one section is open at a time,
// so the menu always fits on screen even though its scrollbar is hidden.
export const NAV_GROUPS = [
  { id: 'work', label: 'Work', icon: FolderKanban, paths: ['/jobs', '/design', '/fabrication', '/installation', '/calendar'] },
  { id: 'field', label: 'Field and safety', icon: HardHat, paths: ['/swms', '/checklists', '/hours', '/issues'] },
  { id: 'people', label: 'People', icon: Users, paths: ['/workers', '/compliance'] },
  { id: 'assets', label: 'Assets', icon: Boxes, paths: ['/equipment', '/devices'] },
];
const GROUPED = new Set(NAV_GROUPS.flatMap((g) => g.paths));

export default function Sidebar({ open, onClose }) {
  const { role, roleId } = useDemo();
  const { prefs, setPref } = usePrefs();
  const { user, signOut } = useAuth() || {}; // tests can render the menu without sign-in
  const { pathname } = useLocation();
  const collapsed = prefs.sidebarCollapsed;
  const homeLabel = `${roleId === 'pm' ? 'PM' : role.label} Dashboard`;
  const allowed = NAV.filter((item) => canAccess(roleId, item.path) && (item.home || !prefs.hidden.includes(item.path)));
  const byPath = Object.fromEntries(allowed.map((i) => [i.path, i]));
  const activeGroup = NAV_GROUPS.find((g) => g.paths.some((p) => pathname === p || pathname.startsWith(`${p}/`)))?.id;
  const [openGroup, setOpenGroup] = useState(activeGroup || null);
  useEffect(() => { if (activeGroup) setOpenGroup(activeGroup); }, [activeGroup]);
  const toggleGroup = (id) => setOpenGroup((cur) => (cur === id ? null : id));

  const link = (item, sub = false) => {
    const Icon = ICONS[item.icon];
    const label = item.home ? homeLabel : item.label;
    return (
      <NavLink key={item.path} to={item.path} end={item.end} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
        className={({ isActive }) => `side-link ${sub ? 'sub' : ''} ${isActive ? 'active' : ''}`}>
        <Icon size={17} aria-hidden="true" />
        <span className="side-label">{label}</span>
      </NavLink>
    );
  };

  // Build the menu: Dashboard first, then the sections, then pages that sit in no section (Admin).
  const items = [];
  allowed.filter((i) => i.home).forEach((i) => items.push(link(i)));
  if (prefs.grouped && !collapsed) {
    NAV_GROUPS.forEach((g) => {
      const kids = g.paths.map((p) => byPath[p]).filter(Boolean);
      if (kids.length === 0) return;
      const isOpen = openGroup === g.id;
      const hasActive = g.id === activeGroup;
      items.push(
        <div key={g.id} className={`side-group ${isOpen ? 'open' : ''}`}>
          <button type="button" className={`side-link side-group-btn ${hasActive && !isOpen ? 'has-active' : ''}`} aria-expanded={isOpen} onClick={() => toggleGroup(g.id)}>
            <g.icon size={17} aria-hidden="true" />
            <span className="side-label">{g.label}</span>
            <ChevronDown size={15} className="side-chev" aria-hidden="true" />
          </button>
          {isOpen && <div className="side-sub">{kids.map((k) => link(k, true))}</div>}
        </div>,
      );
    });
  } else {
    allowed.filter((i) => !i.home && GROUPED.has(i.path)).forEach((i) => items.push(link(i)));
  }
  allowed.filter((i) => !i.home && !GROUPED.has(i.path)).forEach((i) => items.push(link(i)));

  return (
    <aside className={`sidebar ${open ? 'open' : ''} ${collapsed ? 'collapsed' : ''}`} aria-label="Primary">
      <div className="side-top">
        {collapsed
          ? <img className="logo-mark" src={`${process.env.PUBLIC_URL}/logo-mark.png`} alt="Visual Exposure" width="40" height="40" />
          : <img className="logo-img" src={`${process.env.PUBLIC_URL}/logo.png`} alt="Visual Exposure" width="190" height="37" />}
        <button type="button" className="icon-btn side-collapse" aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu (wider page)'}
          onClick={() => setPref('sidebarCollapsed', (v) => !v)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
      </div>

      <nav className="side-nav">{items}</nav>

      {user && (
        <div className="side-user-wrap">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="side-user" aria-label={`${user.name}, ${role.label}. Account menu`} title={collapsed ? `${user.name}, ${role.label}` : undefined}>
                <span className="side-avatar" aria-hidden="true">{user.initials}</span>
                <span className="side-who"><strong>{user.name}</strong><small>{role.label}</small></span>
                <ChevronDown size={18} className="side-user-chev" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'start'} sideOffset={8} className="side-user-menu">
              <DropdownMenuItem onSelect={signOut} className="side-user-signout"><LogOut size={18} aria-hidden="true" /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </aside>
  );
}
