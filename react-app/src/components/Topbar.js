import { useEffect, useRef } from 'react';
import { Bell, Menu, Moon, Search, Sun } from 'lucide-react';
import { ROLES } from '../data/mockData';
import { useDemo } from '../context/DemoContext';
import { useTheme } from '../context/ThemeContext';

export default function Topbar({ onMenu }) {
  const { roleId, changeRole } = useDemo();
  const { theme, toggleTheme } = useTheme();
  const searchRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="topbar">
      <button type="button" className="icon-btn menu-btn" aria-label="Open menu" onClick={onMenu}><Menu size={20} /></button>

      <label className="search">
        <Search size={16} aria-hidden="true" />
        <input ref={searchRef} type="search" placeholder="Search jobs, tasks, sites" aria-label="Search" />
        <kbd>Ctrl K</kbd>
      </label>

      <div className="topbar-right">
        <label className="role-switch">
          <span>Viewing as</span>
          <select value={roleId} onChange={(e) => changeRole(e.target.value)} aria-label="Switch role">
            {Object.entries(ROLES).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="icon-btn theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button type="button" className="icon-btn bell" aria-label="Notifications"><Bell size={18} /><i /></button>
      </div>
    </div>
  );
}
