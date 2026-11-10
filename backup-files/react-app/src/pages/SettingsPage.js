import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { PageHeader } from '../components/ui';
import { Card } from '../components/ui-kit/card';
import { Button } from '../components/ui-kit/button';
import { SavedViews } from '../components/ListKit';
import { NAV_GROUPS } from '../components/Sidebar';
import { useDemo } from '../context/DemoContext';
import { useTheme } from '../context/ThemeContext';
import { ACCENTS, usePrefs } from '../context/PrefsContext';
import { NAV } from '../navConfig';
import { canAccess } from '../lib/access';
import { cn } from '../lib/utils';

function Section({ title, hint, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4"><h2 className="m-0 text-[15px] font-bold">{title}</h2>{hint && <p className="m-0 mt-0.5 text-sm text-muted-foreground">{hint}</p>}</div>
      <div className="grid gap-5 p-5">{children}</div>
    </Card>
  );
}
function Row({ label, hint, children, top = false }) {
  return (
    <div className={cn('grid gap-2 sm:grid-cols-[14rem_1fr]', top ? 'sm:items-start' : 'sm:items-center')}>
      <div><div className="text-sm font-semibold">{label}</div>{hint && <div className="text-xs text-muted-foreground">{hint}</div>}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 rounded-full transition-colors', checked ? 'bg-primary' : 'bg-input')}>
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

// Display settings for the signed-in person: theme, colour, density, text size and the side menu.
// Saved on this device; nothing here changes data or what a role can open.
export default function SettingsPage() {
  const { roleId } = useDemo();
  const { mode, setMode } = useTheme();
  const { prefs, setPref, resetPrefs } = usePrefs();
  const menu = NAV.filter((i) => !i.home && canAccess(roleId, i.path));
  const toggleHidden = (path) => setPref('hidden', (h) => (h.includes(path) ? h.filter((x) => x !== path) : [...h, path]));
  const groupOf = (path) => NAV_GROUPS.find((g) => g.paths.includes(path))?.label || 'On its own';

  return (
    <div className="dash ui-scope font-sans">
      <PageHeader eyebrow="Your account" title="Settings" subtitle="Make the app look and feel the way you like. These settings are yours and are saved on this device." />

      <Section title="Appearance" hint="Theme, colour and size">
        <Row label="Theme" hint="Auto follows your device">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Theme">
            {[['light', 'Light', Sun], ['dark', 'Dark', Moon], ['auto', 'Auto', Monitor]].map(([id, label, Icon]) => (
              <button key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
                className={cn('flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold', mode === id ? 'border-primary bg-accent text-primary' : 'border-input bg-card')}>
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Accent colour" hint="Buttons, links and highlights">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Accent colour">
            {Object.entries(ACCENTS).map(([id, a]) => (
              <button key={id} type="button" role="radio" aria-checked={prefs.accent === id} aria-label={a.label} title={a.label} onClick={() => setPref('accent', id)}
                className={cn('grid h-9 w-9 place-items-center rounded-full border-2', prefs.accent === id ? 'border-foreground' : 'border-transparent')}
                style={{ background: a.brand }}>
                {prefs.accent === id && <Check className="h-4 w-4 text-white" />}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Density" hint="How much space between rows">
          <SavedViews label="Density" value={prefs.density} onChange={(v) => setPref('density', v)} views={[{ id: 'compact', label: 'Compact' }, { id: 'default', label: 'Default' }, { id: 'comfortable', label: 'Comfortable' }]} />
        </Row>
        <Row label="Text size">
          <SavedViews label="Text size" value={prefs.fontSize} onChange={(v) => setPref('fontSize', v)} views={[{ id: 'small', label: 'Small' }, { id: 'medium', label: 'Medium' }, { id: 'large', label: 'Large' }]} />
        </Row>
      </Section>

      <Section title="Side menu" hint="Make more room for the page, or keep the menu short">
        <Row label="Collapse the menu" hint="Icons only, for a wider page. The button next to the logo does the same.">
          <Switch label="Collapse the menu" checked={prefs.sidebarCollapsed} onChange={(v) => setPref('sidebarCollapsed', v)} />
        </Row>
        <Row label="Group into sections" hint="Work, Field and safety, People, Assets. Each opens to show its pages.">
          <Switch label="Group into sections" checked={prefs.grouped} onChange={(v) => setPref('grouped', v)} />
        </Row>
        <Row top label="Pages in my menu" hint="Hidden pages still open from links and search">
          <ul className="m-0 grid list-none gap-1 p-0 sm:grid-cols-2">
            {menu.map((i) => (
              <li key={i.path}>
                <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-muted">
                  <input type="checkbox" checked={!prefs.hidden.includes(i.path)} onChange={() => toggleHidden(i.path)} />
                  <span className="text-sm font-medium">{i.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{groupOf(i.path)}</span>
                </label>
              </li>
            ))}
          </ul>
        </Row>
      </Section>

      <div><Button variant="outline" onClick={() => { resetPrefs(); setMode('auto'); }}><RotateCcw /> Reset to defaults</Button></div>
    </div>
  );
}
