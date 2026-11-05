import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 've-theme';
const ThemeContext = createContext({ theme: 'light', mode: 'light', setMode: () => {}, toggleTheme: () => {} });

// mode is what the person chose (light, dark or auto); theme is what is shown now.
// auto follows the device setting and, when that is not available, switches to dark after 8 pm.
const systemDark = () => (window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : new Date().getHours() >= 20 || new Date().getHours() < 6);

function initialMode() {
  try {
    const saved = localStorage.getItem(KEY);
    if (['light', 'dark', 'auto'].includes(saved)) return saved;
  } catch (e) { /* storage blocked: fall through */ }
  return 'auto';
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(initialMode);
  const [sys, setSys] = useState(systemDark);
  const theme = mode === 'auto' ? (sys ? 'dark' : 'light') : mode;

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSys(mq.matches);
    if (mq.addEventListener) mq.addEventListener('change', on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#17181a' : '#2f3234');
  }, [theme]);
  useEffect(() => { try { localStorage.setItem(KEY, mode); } catch (e) { /* ignore */ } }, [mode]);

  const toggleTheme = useCallback(() => setMode(theme === 'dark' ? 'light' : 'dark'), [theme]);
  const value = useMemo(() => ({ theme, mode, setMode, toggleTheme }), [theme, mode, toggleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
