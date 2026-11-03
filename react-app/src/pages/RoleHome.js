import { PageHeader } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import MyDay from './MyDay';
import FabDashboard from './FabDashboard';
import WorkshopDashboard from './WorkshopDashboard';
import AdminHome from './AdminHome';
import InstallDashboard from './InstallDashboard';
import DesignPage from './DesignPage';
import JobsPage from './JobsPage';

export default function RoleHome() {
  const { role, roleId } = useDemo();
  if (roleId === 'fabManager' || roleId === 'ic2') return <FabDashboard variant={roleId === 'ic2' ? 'ic2' : 'manager'} />;
  if (roleId === 'fabWorker' || roleId === 'installer' || roleId === 'contractor') return <MyDay />;
  if (roleId === 'admin') return <AdminHome />;
  if (roleId === 'installCoordinator') return <InstallDashboard />;
  if (roleId === 'designer') return <DesignPage />;
  if (roleId === 'viewer') return <JobsPage />;
  if (roleId === 'workshop') return <WorkshopDashboard />;
  return (
    <div className="dash">
      <PageHeader eyebrow={role.label} title={`${role.name}'s home`} subtitle="This role's dashboard is the next screen to build." />
    </div>
  );
}
