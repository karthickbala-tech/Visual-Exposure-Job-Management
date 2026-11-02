import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as store from '../lib/authStore';
import { useDemo } from './DemoContext';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => store.getSession());

  const signIn = useCallback(async (email, password, remember) => {
    const u = await store.signIn(email, password, remember);
    setUser(u);
    return u;
  }, []);
  const signUp = useCallback(async (data) => {
    const u = await store.signUp(data);
    setUser(u);
    return u;
  }, []);
  const signOut = useCallback(() => { store.signOut(); setUser(null); }, []);

  const value = useMemo(() => ({ user, signIn, signUp, signOut, requestPasswordReset: store.requestPasswordReset }), [user, signIn, signUp, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Puts the app in the signed-in user's role when they sign in. The "Viewing as" demo switcher still works afterwards.
export function RoleSync() {
  const { user } = useAuth();
  const { changeRole } = useDemo();
  useEffect(() => { if (user) changeRole(user.roleId); }, [user, changeRole]);
  return null;
}
