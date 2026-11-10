import { RotateCcw } from 'lucide-react';
import { usePrefs } from '../components/prefs';
import type { Prefs } from '../components/prefs';
import { useTheme } from '../components/theme';
import { Card, PageHeader } from '../components/ui';

function Choice<T extends string>({ label, hint, value, options, onChange }: { label: string; hint: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
	return (
		<div className="pref-row">
			<div>
				<strong>{label}</strong>
				<p className="muted">{hint}</p>
			</div>
			<div className="segmented" role="group" aria-label={label}>
				{options.map((o) => (
					<button key={o.value} type="button" className={value === o.value ? 'on' : ''} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
						{o.label}
					</button>
				))}
			</div>
		</div>
	);
}

/** Personal display settings: how the app looks for you in this browser. Company settings are in Admin. */
export function Settings() {
	const { prefs, setPrefs, reset } = usePrefs();
	const { theme, toggleTheme } = useTheme();
	return (
		<>
			<PageHeader eyebrow="Just for you" title="Settings" subtitle="How the app looks on this device. Saved in this browser only.">
				<button className="btn btn-ghost" onClick={reset}>
					<RotateCcw size={16} aria-hidden="true" /> Reset to default
				</button>
			</PageHeader>
			<Card title="Appearance">
				<div className="stack">
					<Choice label="Theme" hint="Light for bright workshops and offices, dark for evenings." value={theme} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={(v) => v !== theme && toggleTheme()} />
					<Choice<Prefs['density']> label="Density" hint="Compact fits more rows on a screen." value={prefs.density} options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} onChange={(density) => setPrefs({ density })} />
					<Choice<Prefs['text']> label="Text size" hint="Larger text is easier to read on a phone or in bright light." value={prefs.text} options={[{ value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }]} onChange={(text) => setPrefs({ text })} />
				</div>
			</Card>
			<Card title="Menu">
				<Choice<'grouped' | 'flat'> label="Sidebar" hint="Grouped keeps the menu short; flat shows every page at once." value={prefs.groupedNav ? 'grouped' : 'flat'} options={[{ value: 'grouped', label: 'Grouped' }, { value: 'flat', label: 'Flat list' }]} onChange={(v) => setPrefs({ groupedNav: v === 'grouped' })} />
			</Card>
		</>
	);
}
