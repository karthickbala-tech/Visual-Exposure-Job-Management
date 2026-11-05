import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  AlertTriangle, Briefcase, CalendarDays, ChevronDown, ClipboardCheck, Clock, FolderKanban, Hammer, HardHat, LayoutDashboard,
  ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, PenTool, Settings, ShieldCheck, Smartphone, SlidersHorizontal, Truck, Users, Wrench, X, Boxes,
} from 'lucide-react';
import { NAV } from '../navConfig';
import { useDemo } from '../context/DemoContext';
import { usePrefs } from '../context/PrefsContext';
import { canAccess } from '../lib/access';
import { useAuth } from '../context/AuthContext';

const ICONS = {
  calendar: CalendarDays, home: LayoutDashboard, jobs: Briefcase, design: PenTool, fab: Hammer, install: Truck,
  swms: ShieldCheck, checklist: ListChecks, compliance: ClipboardCheck, admin: Settings, hours: Clock, issues: AlertTriangle, people: Users, equipment: Wrench, devices: Smartphone,
};

// The menu in sections, so long role menus (Admin has 15 items) fold into 4 groups.
// A section with only one page for this role shows that page directly.
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
  const [openGroups, setOpenGroups] = useState(() => new Set(activeGroup ? [activeGroup] : []));
  useEffect(() => { if (activeGroup) setOpenGroups((s) => new Set([...s, activeGroup])); }, [activeGroup]);
  const toggleGroup = (id) => setOpenGroups((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
      if (kids.length === 1) { items.push(link(kids[0])); return; }
      const isOpen = openGroups.has(g.id);
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
          ? <span className="logo-mark" role="img" aria-label="Visual Exposure">VE</span>
          : <img className="logo-img" src={`${process.env.PUBLIC_URL}/logo.png`} alt="Visual Exposure" width="160" height="31" />}
        <button type="button" className="icon-btn side-collapse" aria-label={collapsed ? 'Expand menu' : 'Collapse menu'} title={collapsed ? 'Expand menu' : 'Collapse menu (wider page)'}
          onClick={() => setPref('sidebarCollapsed', (v) => !v)}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
        <button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
      </div>

      <nav className="side-nav">{items}</nav>

      <div className="side-foot">
        <NavLink to="/settings" title={collapsed ? 'Settings' : undefined} aria-label={collapsed ? 'Settings' : undefined} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
          <SlidersHorizontal size={17} aria-hidden="true" />
          <span className="side-label">Settings</span>
        </NavLink>
        {user && (
          <div className="side-profile" title={collapsed ? `${user.name}, ${role.label}` : undefined}>
            <span className="side-avatar" aria-hidden="true">{user.initials}</span>
            <span className="side-who side-label"><strong>{user.name}</strong><small>{role.label}</small></span>
          </div>
        )}
        {user && (
          <button type="button" className="side-link side-signout" onClick={signOut} title={collapsed ? 'Sign out' : undefined} aria-label={collapsed ? 'Sign out' : undefined}>
            <LogOut size={17} aria-hidden="true" />
            <span className="side-label">Sign out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
