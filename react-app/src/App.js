import { HashRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Guard from './components/Guard';
import { DemoProvider, useDemo } from './context/DemoContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, RoleSync } from './context/AuthContext';
import { PublicOnly, RequireAuth } from './components/RequireAuth';
import SignInPage from './pages/auth/SignInPage';
import SignUpPage from './pages/auth/SignUpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
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
import EquipmentPage from './pages/EquipmentPage';
import DevicesPage from './pages/DevicesPage';
import CalendarPage from './pages/CalendarPage';
import RoleHome from './pages/RoleHome';
import AdminPage from './pages/AdminPage';
import CompliancePage from './pages/CompliancePage';
import { NAV } from './navConfig';
import './App.css';

// Sidebar paths that have a real screen. Anything else in NAV still shows a placeholder.
const BUILT = ['/', '/jobs', '/fabrication', '/installation', '/swms', '/hours', '/issues', '/workers', '/design', '/equipment', '/devices', '/calendar', '/compliance', '/admin'];

function Home() {
  const { roleId } = useDemo();
  return roleId === 'pm' ? <PmDashboard /> : <RoleHome />;
}

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
    <DemoProvider>
      <RoleSync />
      <HashRouter>
        <Routes>
          <Route element={<PublicOnly />}>
            <Route path="login" element={<SignInPage />} />
            <Route path="signup" element={<SignUpPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
          </Route>
          <Route element={<RequireAuth />}>
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
            <Route path="equipment" element={<EquipmentPage />} />
            <Route path="devices" element={<DevicesPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="compliance" element={<CompliancePage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="workers/:workerId" element={<WorkerDetail />} />
            <Route path="swms/:swmsId" element={<SwmsDetail />} />
            {NAV.filter((n) => !BUILT.includes(n.path)).map((n) => (
              <Route key={n.path} path={n.path} element={<PlaceholderPage title={n.label} blurb={n.blurb} replaces={n.replaces} />} />
            ))}
            <Route path="*" element={<PlaceholderPage title="Page not found" />} />
            </Route>
          </Route>
          </Route>
        </Routes>
      </HashRouter>
    </DemoProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
