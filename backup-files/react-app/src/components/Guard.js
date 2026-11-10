import { Link, Outlet, useLocation } from 'react-router-dom';
import { Card, PageHeader } from './ui';
import { useDemo } from '../context/DemoContext';
import { ROLES } from '../data/mockData';
import { ACCESS, KNOWN_SECTIONS, canAccess, sectionOf } from '../lib/access';

// Wraps every page. Unknown addresses fall through so "Page not found" still works.
export default function Guard() {
  const { roleId, role } = useDemo();
  const { pathname } = useLocation();
  const section = sectionOf(pathname);

  if (!KNOWN_SECTIONS.has(section) || canAccess(roleId, pathname)) return <Outlet />;

  const allowed = Object.entries(ACCESS).filter(([, paths]) => paths.includes(section)).map(([id]) => ROLES[id].label);
  return (
    <div className="dash">
      <PageHeader eyebrow="No access" title="This page is not part of your role" subtitle={`You are viewing as ${role.label}.`} />
      <Card title="Who can open this page">
        <p>{allowed.join(', ')}.</p>
        <p className="muted">Change "Viewing as" at the top right to try another role.</p>
        <Link to="/" className="btn btn-primary">Go to my dashboard</Link>
      </Card>
    </div>
  );
}
