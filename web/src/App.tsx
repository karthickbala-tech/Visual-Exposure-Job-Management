import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Shell } from './components/Shell';
import { Home } from './pages/Home';
import { Placeholder } from './pages/Placeholder';
import './pages/Home.css';

const queryClient = new QueryClient({
	defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

export default function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<Routes>
					<Route element={<Shell />}>
						<Route index element={<Home />} />
						{['jobs', 'tasks', 'swms', 'issues', 'hours'].map((p) => (
							<Route key={p} path={p} element={<Placeholder title={p} />} />
						))}
						<Route path="*" element={<Placeholder title="Page not found" />} />
					</Route>
				</Routes>
			</BrowserRouter>
		</QueryClientProvider>
	);
}
