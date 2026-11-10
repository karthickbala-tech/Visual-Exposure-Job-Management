import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Everything inside needs a signed-in user. Signed-out visitors go to the sign-in page and come back here afterwards.
export function RequireAuth() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: `${pathname}${search}` }} />;
  return <Outlet />;
}

// Sign in, sign up and password pages. Signed-in users are sent on to the app.
export function PublicOnly() {
  const { user } = useAuth();
  const { state } = useLocation();
  if (user) return <Navigate to={(state && state.from) || '/'} replace />;
  return <Outlet />;
}
