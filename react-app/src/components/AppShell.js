import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useDemo } from '../context/DemoContext';

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();
  const { toast, dismissToast } = useDemo();

  useEffect(() => setNavOpen(false), [pathname]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(dismissToast, 3200);
    return () => clearTimeout(t);
  }, [toast, dismissToast]);

  return (
    <div className="shell">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <div className="main-col">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main className="page"><Outlet /></main>
      </div>
      {toast && <div className="toast" role="status"><CheckCircle2 size={16} className="toast-icon" aria-hidden="true" />{toast.msg}</div>}
    </div>
  );
}
