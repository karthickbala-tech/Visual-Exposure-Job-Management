import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from './auth/AuthGate';
import { ApiError } from './api/client';
import { Shell } from './components/Shell';
import { ThemeProvider } from './components/theme';
import { PrefsProvider } from './components/prefs';
import { Guard } from './components/Guard';
import { ROUTE_ROLES } from './navConfig';
import { Settings } from './pages/Settings';
import { WorkList } from './pages/WorkList';
import { ToastProvider } from './components/toast';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { TaskDetail } from './pages/TaskDetail';
import { ChecklistPage } from './pages/ChecklistPage';
import { Issues } from './pages/Issues';
import { Calendar } from './pages/Calendar';
import { People } from './pages/People';
import { Compliance } from './pages/Compliance';
import { Equipment } from './pages/Equipment';
import { Devices } from './pages/Devices';
import { Admin } from './pages/Admin';
import { Directory } from './pages/Directory';
import { Placeholder } from './pages/Placeholder';
import { Hours } from './pages/Hours';
import { PersonDetail } from './pages/PersonDetail';
import { TaskBoard } from './pages/TaskBoard';
import { ChecklistReport, SwmsList } from './pages/SwmsList';

const queryClient = new QueryClient({
	// Every request costs the Catalyst plan's small monthly allowance: no refetch on focus or reconnect, and a failed
	// request is retried once, never for a refusal (401, 403, 404, 400), which a retry cannot fix.
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			refetchOnReconnect: false,
			retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status < 500),
		},
	},
});

/**
 * HashRouter: Catalyst client hosting serves one index.html, so hash URLs
 * (/app/#/jobs) refresh and deep-link without any server rewrite rules.
 */
export default function App() {
	return (
		<ThemeProvider>
		<PrefsProvider>
		<QueryClientProvider client={queryClient}>
			<ToastProvider>
			<AuthGate>
				<HashRouter>
					<Routes>
						<Route element={<Shell />}>
							<Route index element={<Home />} />
							<Route path="jobs" element={<Jobs />} />
							<Route path="jobs/:id" element={<JobDetail />} />
							<Route path="issues" element={<Issues />} />
							<Route path="calendar" element={<Calendar />} />
							<Route path="people" element={<Guard roles={ROUTE_ROLES.people}><People /></Guard>} />
							<Route path="people/:id" element={<PersonDetail />} />
							<Route path="compliance" element={<Compliance />} />
							<Route path="equipment" element={<Guard roles={ROUTE_ROLES.equipment}><Equipment /></Guard>} />
							<Route path="devices" element={<Guard roles={ROUTE_ROLES.devices}><Devices /></Guard>} />
							<Route path="settings" element={<Settings />} />
							<Route path="admin" element={<Guard roles={ROUTE_ROLES.admin}><Admin /></Guard>} />
							<Route path="directory" element={<Guard roles={ROUTE_ROLES.directory}><Directory /></Guard>} />
							<Route path="tasks" element={<TaskBoard />} />
							<Route path="design" element={<Guard roles={ROUTE_ROLES.design}><WorkList kind="design" /></Guard>} />
							<Route path="fabrication" element={<Guard roles={ROUTE_ROLES.fabrication}><WorkList kind="fabrication" /></Guard>} />
							<Route path="installation" element={<Guard roles={ROUTE_ROLES.installation}><WorkList kind="install" /></Guard>} />
							<Route path="hours" element={<Guard roles={ROUTE_ROLES.hours}><Hours /></Guard>} />
							<Route path="swms" element={<Guard roles={ROUTE_ROLES.swms}><SwmsList /></Guard>} />
							<Route path="reports/checklists" element={<Guard roles={ROUTE_ROLES.checklists}><ChecklistReport /></Guard>} />
							<Route path="tasks/:id" element={<TaskDetail />} />
							<Route path="checklists/:id" element={<ChecklistPage />} />
							<Route path="*" element={<Placeholder title="Page not found" />} />
						</Route>
					</Routes>
				</HashRouter>
			</AuthGate>
			</ToastProvider>
		</QueryClientProvider>
		</PrefsProvider>
		</ThemeProvider>
	);
}
