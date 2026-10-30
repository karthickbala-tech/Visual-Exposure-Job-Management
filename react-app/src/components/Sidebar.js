import { NavLink } from 'react-router-dom';
import { AlertTriangle, Briefcase, Clock, Hammer, LayoutDashboard, PenTool, Settings, ShieldCheck, Truck, Users, X } from 'lucide-react';
import { NAV } from '../navConfig';
import { useDemo } from '../context/DemoContext';

const ICONS = {
  home: LayoutDashboard, jobs: Briefcase, design: PenTool, fab: Hammer, install: Truck,
  swms: ShieldCheck, hours: Clock, issues: AlertTriangle, people: Users,
};

export default function Sidebar({ open, onClose }) {
  const { role, roleId } = useDemo();
  const homeLabel = `${roleId === 'pm' ? 'PM' : role.label} Dashboard`;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary">
      <div className="side-top">
        <img className="logo-img" src={`${process.env.PUBLIC_URL}/logo.png`} alt="Visual Exposure" width="160" height="31" />
        <button type="button" className="icon-btn side-close" aria-label="Close menu" onClick={onClose}><X size={18} /></button>
      </div>

      <nav className="side-nav">
        {NAV.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <NavLink key={item.path} to={item.path} end={item.end} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}>
              <Icon size={17} aria-hidden="true" />
              <span>{item.home ? homeLabel : item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="side-user">
        <span className="avatar">{role.initials}</span>
        <div>
          <strong>{role.name}</strong>
          <span>{role.label}</span>
        </div>
        <button type="button" className="icon-btn side-gear" aria-label="Settings"><Settings size={16} /></button>
      </div>
    </aside>
  );
}
