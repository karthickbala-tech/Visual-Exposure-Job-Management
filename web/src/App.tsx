import { HashRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthGate } from './auth/AuthGate';
import { Shell } from './components/Shell';
import { ThemeProvider } from './components/theme';
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
import { Placeholder } from './pages/Placeholder';

const queryClient = new QueryClient({
	defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

/**
 * HashRouter: Catalyst client hosting serves one index.html, so hash URLs
 * (/app/#/jobs) refresh and deep-link without any server rewrite rules.
 */
export default function App() {
	return (
		<ThemeProvider>
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
							<Route path="people" element={<People />} />
							<Route path="compliance" element={<Compliance />} />
							<Route path="tasks/:id" element={<TaskDetail />} />
							<Route path="checklists/:id" element={<ChecklistPage />} />
							<Route path="*" element={<Placeholder title="Page not found" />} />
						</Route>
					</Routes>
				</HashRouter>
			</AuthGate>
			</ToastProvider>
		</QueryClientProvider>
		</ThemeProvider>
	);
}
