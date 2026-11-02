import { HashRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Guard from './components/Guard';
import { DemoProvider, useDemo } from './context/DemoContext';
import { ThemeProvider } from './context/ThemeContext';
import PlaceholderPage from './pages/PlaceholderPage';
import PmDashboard from './pages/PmDashboard';
import JobsPage from './pages/JobsPage';
import Job360 from './pages/Job360';
import FabDashboard from './pages/FabDashboard';
import InstallDashboard from './pages/InstallDashboard';
import { SwmsList, SwmsDetail } from './pages/SwmsPage';
import HoursPage from './pages/HoursPage';
import { IssuesBoard, IssueDetail } from './pages/IssuesPage';
import { WorkersPage, WorkerDetail } from './pages/WorkersPage';
import DesignPage from './pages/DesignPage';
import RoleHome from './pages/RoleHome';
import { NAV } from './navConfig';
import './App.css';

function Home() {
  const { roleId } = useDemo();
  return roleId === 'pm' ? <PmDashboard /> : <RoleHome />;
}

export default function App() {
  return (
    <ThemeProvider>
    <DemoProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
          <Route element={<Guard />}>
            <Route index element={<Home />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="jobs/:jobId" element={<Job360 />} />
            <Route path="fabrication" element={<FabDashboard variant="manager" />} />
            <Route path="installation" element={<InstallDashboard />} />
            <Route path="swms" element={<SwmsList />} />
            <Route path="hours" element={<HoursPage />} />
            <Route path="issues" element={<IssuesBoard />} />
            <Route path="issues/:issueId" element={<IssueDetail />} />
            <Route path="design" element={<DesignPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="workers/:workerId" element={<WorkerDetail />} />
            <Route path="swms/:swmsId" element={<SwmsDetail />} />
            {NAV.filter((n) => n.path !== '/' && n.path !== '/jobs' && n.path !== '/fabrication' && n.path !== '/installation' && n.path !== '/swms' && n.path !== '/hours' && n.path !== '/issues' && n.path !== '/workers' && n.path !== '/design').map((n) => (
              <Route key={n.path} path={n.path} element={<PlaceholderPage title={n.label} blurb={n.blurb} replaces={n.replaces} />} />
            ))}
            <Route path="*" element={<PlaceholderPage title="Page not found" />} />
            </Route>
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
    </ThemeProvider>
  );
}
