import { PageHeader, Card } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import MyDay from './MyDay';
import FabDashboard from './FabDashboard';

const PLANS = {
  workshop: ['Open workshop tasks', 'Overdue equipment checks', 'Register of equipment'],
};

export default function RoleHome() {
  const { role, roleId } = useDemo();
  if (roleId === 'fabManager' || roleId === 'ic2') return <FabDashboard variant={roleId === 'ic2' ? 'ic2' : 'manager'} />;
  if (roleId === 'fabWorker' || roleId === 'installer') return <MyDay />;
  return (
    <div className="dash">
      <PageHeader eyebrow={role.label} title={`${role.name}'s home`} subtitle="This role's dashboard is the next screen to build." />
      <Card title="Planned for this role">
        <ul className="plain">{(PLANS[roleId] || []).map((p) => <li key={p}>{p}</li>)}</ul>
      </Card>
    </div>
  );
}
