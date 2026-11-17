import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';
/** What the person chose: a fixed theme, or 'auto' to follow the device (and change with it). */
export type ThemeMode = Theme | 'auto';
const KEY = 've-theme';
const QUERY = '(prefers-color-scheme: dark)';

const ThemeContext = createContext<{ theme: Theme; mode: ThemeMode; setMode: (m: ThemeMode) => void; toggleTheme: () => void }>({
	theme: 'light',
	mode: 'auto',
	setMode: () => {},
	toggleTheme: () => {},
});

/** The saved choice, else 'auto'. Storage can be blocked, so every access is guarded. */
function savedMode(): ThemeMode {
	try {
		const saved = localStorage.getItem(KEY);
		if (saved === 'light' || saved === 'dark' || saved === 'auto') return saved;
	} catch {
		/* storage blocked: follow the device */
	}
	return 'auto';
}

const deviceTheme = (): Theme => (window.matchMedia?.(QUERY).matches ? 'dark' : 'light');

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [mode, setMode] = useState<ThemeMode>(savedMode);
	const [device, setDevice] = useState<Theme>(deviceTheme);
	const theme: Theme = mode === 'auto' ? device : mode;

	// Follow the device while on 'auto', e.g. a phone that turns dark in the evening.
	useEffect(() => {
		const mq = window.matchMedia?.(QUERY);
		if (!mq) return;
		const onChange = () => setDevice(mq.matches ? 'dark' : 'light');
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	}, []);

	useEffect(() => {
		document.documentElement.setAttribute('data-theme', theme);
	}, [theme]);

	useEffect(() => {
		try {
			localStorage.setItem(KEY, mode);
		} catch {
			/* ignore */
		}
	}, [mode]);

	// The quick toggle in the top bar picks the opposite of what is showing, as a fixed choice.
	const toggleTheme = useCallback(() => setMode(theme === 'dark' ? 'light' : 'dark'), [theme]);
	const value = useMemo(() => ({ theme, mode, setMode, toggleTheme }), [theme, mode, toggleTheme]);
	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
