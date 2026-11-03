import { PageHeader } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import MyDay from './MyDay';
import FabDashboard from './FabDashboard';
import WorkshopDashboard from './WorkshopDashboard';

export default function RoleHome() {
  const { role, roleId } = useDemo();
  if (roleId === 'fabManager' || roleId === 'ic2') return <FabDashboard variant={roleId === 'ic2' ? 'ic2' : 'manager'} />;
  if (roleId === 'fabWorker' || roleId === 'installer') return <MyDay />;
  if (roleId === 'workshop') return <WorkshopDashboard />;
  return (
    <div className="dash">
      <PageHeader eyebrow={role.label} title={`${role.name}'s home`} subtitle="This role's dashboard is the next screen to build." />
    </div>
  );
}
