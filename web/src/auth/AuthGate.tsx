import type { ReactNode } from 'react';
import { useMe } from '../api/queries';
import { ApiError } from '../api/client';
import { Login } from './Login';

/** Renders children only for a signed-in user; shows the login form on 401. */
export function AuthGate({ children }: { children: ReactNode }) {
	const me = useMe();

	if (me.isPending) return <p className="status" role="status">Loading...</p>;
	if (me.error instanceof ApiError && me.error.status === 401) return <Login />;
	if (me.error instanceof ApiError && me.error.status === 403) {
		return (
			<main className="status" role="alert">
				<h1 className="page-title">No access</h1>
				<p>Your account has no role in this application. Ask an administrator to give you one.</p>
			</main>
		);
	}
	if (me.isError) {
		return (
			<main className="status" role="alert">
				<h1 className="page-title">Something went wrong</h1>
				<p>The server could not be reached. Try again in a moment.</p>
				<button className="btn btn-primary" onClick={() => me.refetch()}>Retry</button>
			</main>
		);
	}
	return <>{children}</>;
}
