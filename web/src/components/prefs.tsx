import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Personal display choices, kept in this browser only (never sent to the server). */
export interface Prefs {
	density: 'comfortable' | 'compact';
	text: 'normal' | 'large';
	groupedNav: boolean;
}
const DEFAULTS: Prefs = { density: 'comfortable', text: 'normal', groupedNav: true };
const KEY = 've.prefs';

function read(): Prefs {
	try {
		const raw = window.localStorage.getItem(KEY);
		const v = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
		return {
			density: v.density === 'compact' ? 'compact' : 'comfortable',
			text: v.text === 'large' ? 'large' : 'normal',
			groupedNav: v.groupedNav === false ? false : true,
		};
	} catch {
		return DEFAULTS;
	}
}

const PrefsContext = createContext<{ prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void; reset: () => void }>({ prefs: DEFAULTS, setPrefs: () => {}, reset: () => {} });

export function PrefsProvider({ children }: { children: ReactNode }) {
	const [prefs, setAll] = useState<Prefs>(read);
	useEffect(() => {
		const root = document.documentElement;
		root.dataset.density = prefs.density;
		root.dataset.text = prefs.text;
		try {
			window.localStorage.setItem(KEY, JSON.stringify(prefs));
		} catch {
			/* the choice is just not remembered */
		}
	}, [prefs]);
	const value = useMemo(() => ({ prefs, setPrefs: (p: Partial<Prefs>) => setAll((old) => ({ ...old, ...p })), reset: () => setAll(DEFAULTS) }), [prefs]);
	return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePrefs = () => useContext(PrefsContext);
