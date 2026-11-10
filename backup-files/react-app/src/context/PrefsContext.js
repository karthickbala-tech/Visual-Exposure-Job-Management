import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTheme } from './ThemeContext';

// Each person's display settings, kept on this device. In the Catalyst build these move to the user's profile.
const KEY = 've-prefs';
export const ACCENTS = {
  green: { label: 'Visual Exposure green', brand: '#68b04d', strong: '#3f7a2b', soft: '#e8f2e2' },
  blue: { label: 'Blue', brand: '#3b82f6', strong: '#1d4fb0', soft: '#e3edfd' },
  teal: { label: 'Teal', brand: '#14b8a6', strong: '#0f766e', soft: '#dcf5f1' },
  violet: { label: 'Violet', brand: '#8b5cf6', strong: '#6d3fd6', soft: '#efe8fd' },
  orange: { label: 'Orange', brand: '#f97316', strong: '#c2410c', soft: '#fdece0' },
  slate: { label: 'Slate', brand: '#64748b', strong: '#334155', soft: '#eceff3' },
};
export const DEFAULT_PREFS = { accent: 'green', density: 'default', fontSize: 'medium', sidebarCollapsed: false, grouped: true, hidden: [] };

const read = () => {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch (e) { return { ...DEFAULT_PREFS }; }
};
const hsl = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  let h = 0; let s = 0;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const PrefsContext = createContext({ prefs: DEFAULT_PREFS, setPref: () => {}, resetPrefs: () => {} });

export function PrefsProvider({ children }) {
  const [prefs, setPrefs] = useState(read);
  const { theme } = useTheme();

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* ignore */ }
    const root = document.documentElement;
    root.setAttribute('data-density', prefs.density);
    root.setAttribute('data-font', prefs.fontSize);
    const a = ACCENTS[prefs.accent] || ACCENTS.green;
    if (prefs.accent === 'green') {
      ['--brand', '--brand-strong', '--brand-soft', '--ui-primary', '--ui-ring', '--ui-brand', '--ui-accent'].forEach((v) => root.style.removeProperty(v));
    } else {
      root.style.setProperty('--brand', a.brand);
      root.style.setProperty('--brand-strong', a.strong);
      // The pale tint only suits the light theme; dark keeps its own dark tint.
      if (theme === 'light') root.style.setProperty('--brand-soft', a.soft); else root.style.removeProperty('--brand-soft');
      root.style.setProperty('--ui-primary', hsl(a.strong));
      root.style.setProperty('--ui-ring', hsl(a.brand));
      root.style.setProperty('--ui-brand', hsl(a.brand));
      if (theme === 'light') root.style.setProperty('--ui-accent', hsl(a.soft)); else root.style.removeProperty('--ui-accent');
    }
  }, [prefs, theme]);

  const setPref = useCallback((k, v) => setPrefs((p) => ({ ...p, [k]: typeof v === 'function' ? v(p[k]) : v })), []);
  const resetPrefs = useCallback(() => setPrefs({ ...DEFAULT_PREFS }), []);
  const value = useMemo(() => ({ prefs, setPref, resetPrefs }), [prefs, setPref, resetPrefs]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
