import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import { Dialog } from './components/Dialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from './auth/AuthGate';
import { ApiError } from './api/client';
import { Shell } from './components/Shell';
import { ThemeProvider } from './components/theme';
import { PrefsProvider } from './components/prefs';
import { Guard } from './components/Guard';
import { ROUTE_ROLES } from './navConfig';
import { Settings } from './pages/Settings';
import { ToastProvider } from './components/toast';
import { MessageProvider } from './components/Messages';
import { Home } from './pages/Home';
import { JobModule } from './components/JobModule';
import { Jobs } from './pages/Jobs';
import { NewJob } from './pages/NewJob';
import { EditJob } from './pages/EditJob';
import { NewIssue } from './pages/NewIssue';
import { NewPerson } from './pages/NewPerson';
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
 * A popup route: the page opens over the screen the user came from (the list stays visible behind it).
 * Navigate to it with state { background: location }. Closing it, or saving and going on to the record, ends the popup.
 */
function PopupRoute({ title, children }: { title: string; children: React.ReactNode }) {
	const location = useLocation();
	const navigate = useNavigate();
	const background = (location.state as { background?: Location } | null)?.background;
	return <Dialog title={title} wide onClose={() => navigate(background ?? '/', { replace: true })}>{children}</Dialog>;
}

/** The app's routes. A URL reached from another screen with a background location also opens as a popup over it. */
function AppRoutes() {
	const location = useLocation();
	const background = (location.state as { background?: Location } | null)?.background;
	return (
		<>
			<Routes location={background ?? location}>
						<Route element={<Shell />}>
							<Route index element={<Home />} />
							<Route path="jobs" element={<JobModule><Jobs /></JobModule>} />
							<Route path="jobs/new" element={<JobModule><NewJob /></JobModule>} />
							<Route path="jobs/:id/edit" element={<JobModule><EditJob /></JobModule>} />
							<Route path="jobs/:id" element={<JobModule><JobDetail /></JobModule>} />
							<Route path="issues" element={<Issues />} />
							<Route path="issues/new" element={<NewIssue />} />
							<Route path="calendar" element={<Calendar />} />
							<Route path="people" element={<Guard roles={ROUTE_ROLES.people}><People /></Guard>} />
							<Route path="people/new" element={<Guard roles={ROUTE_ROLES.people}><NewPerson /></Guard>} />
							<Route path="people/:id" element={<PersonDetail />} />
							<Route path="compliance" element={<Compliance />} />
							<Route path="equipment" element={<Guard roles={ROUTE_ROLES.equipment}><Equipment /></Guard>} />
							<Route path="devices" element={<Guard roles={ROUTE_ROLES.devices}><Devices /></Guard>} />
							<Route path="settings" element={<Settings />} />
							<Route path="admin" element={<Guard roles={ROUTE_ROLES.admin}><Admin /></Guard>} />
							<Route path="directory" element={<Guard roles={ROUTE_ROLES.directory}><Directory /></Guard>} />
							<Route path="tasks" element={<JobModule><TaskBoard /></JobModule>} />
							<Route path="design" element={<Navigate to="/tasks?type=design" replace />} />
							<Route path="fabrication" element={<Navigate to="/tasks" replace />} />
							<Route path="installation" element={<Navigate to="/tasks?type=install" replace />} />
							<Route path="hours" element={<Guard roles={ROUTE_ROLES.hours}><Hours /></Guard>} />
							<Route path="swms" element={<Guard roles={ROUTE_ROLES.swms}><SwmsList /></Guard>} />
							<Route path="reports/checklists" element={<Guard roles={ROUTE_ROLES.checklists}><ChecklistReport /></Guard>} />
							<Route path="tasks/:id" element={<JobModule><TaskDetail /></JobModule>} />
							<Route path="checklists/:id" element={<ChecklistPage />} />
							<Route path="*" element={<Placeholder title="Page not found" />} />
						</Route>
	
			</Routes>
			{background && (
				<Routes>
					<Route path="jobs/new" element={<PopupRoute title="New job"><JobModule><NewJob /></JobModule></PopupRoute>} />
					<Route path="jobs/:id/edit" element={<PopupRoute title="Edit job"><JobModule><EditJob /></JobModule></PopupRoute>} />
					<Route path="issues/new" element={<PopupRoute title="Raise an issue"><NewIssue /></PopupRoute>} />
					<Route path="people/new" element={<PopupRoute title="Add a person"><Guard roles={ROUTE_ROLES.people}><NewPerson /></Guard></PopupRoute>} />
				</Routes>
			)}
		</>
	);
}

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
			<MessageProvider>
			<AuthGate>
				<HashRouter>
					<AppRoutes />
				</HashRouter>
			</AuthGate>
			</MessageProvider>
			</ToastProvider>
		</QueryClientProvider>
		</PrefsProvider>
		</ThemeProvider>
	);
}
