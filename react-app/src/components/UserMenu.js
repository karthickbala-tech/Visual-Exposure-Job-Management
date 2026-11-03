import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDemo } from '../context/DemoContext';
import './UserMenu.css';

// Account button for the top bar: shows who is signed in and lets them sign out on any screen size.
export default function UserMenu() {
  const { user, signOut } = useAuth();
  const { role } = useDemo();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="avatar avatar-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`Account menu for ${user.name}`} onClick={() => setOpen((o) => !o)}>
        {user.initials}
      </button>
      {open && (
        <div className="user-pop" role="menu">
          <div className="user-pop-head">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
            <small>{role.label}</small>
          </div>
          <button type="button" role="menuitem" className="user-pop-item" onClick={signOut}>
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
