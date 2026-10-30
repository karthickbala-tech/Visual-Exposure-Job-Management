import { HashRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import { DemoProvider, useDemo } from './context/DemoContext';
import PlaceholderPage from './pages/PlaceholderPage';
import PmDashboard from './pages/PmDashboard';
import JobsPage from './pages/JobsPage';
import Job360 from './pages/Job360';
import FabDashboard from './pages/FabDashboard';
import InstallDashboard from './pages/InstallDashboard';
import { SwmsList, SwmsDetail } from './pages/SwmsPage';
import RoleHome from './pages/RoleHome';
import { NAV } from './navConfig';
import './App.css';

function Home() {
  const { roleId } = useDemo();
  return roleId === 'pm' ? <PmDashboard /> : <RoleHome />;
}

export default function App() {
  return (
    <DemoProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="jobs/:jobId" element={<Job360 />} />
            <Route path="fabrication" element={<FabDashboard variant="manager" />} />
            <Route path="installation" element={<InstallDashboard />} />
            <Route path="swms" element={<SwmsList />} />
            <Route path="swms/:swmsId" element={<SwmsDetail />} />
            {NAV.filter((n) => n.path !== '/' && n.path !== '/jobs' && n.path !== '/fabrication' && n.path !== '/installation' && n.path !== '/swms').map((n) => (
              <Route key={n.path} path={n.path} element={<PlaceholderPage title={n.label} blurb={n.blurb} replaces={n.replaces} />} />
            ))}
            <Route path="*" element={<PlaceholderPage title="Page not found" />} />
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
  );
}
