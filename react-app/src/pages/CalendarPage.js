import { useMemo, useState } from 'react';
import CalendarCard from '../components/CalendarCard';
import { PageHeader } from '../components/ui';
import { FilterPanel, SavedViews } from '../components/ListKit';
import { useDemo } from '../context/DemoContext';
import { FAB_TYPES, fabTypeColors } from '../data/fabTypes';
import { installTypeStyles } from '../data/mockData';
import { calendarEvents } from '../lib/calendar';

const TABS = [
  { id: 'unified', label: 'Unified' },
  { id: 'fab', label: 'Fabrication' },
  { id: 'install', label: 'Installation' },
];
const INSTALL_TYPES = Object.keys(installTypeStyles);

// FSD section 12: Fab Calendar (by type), Install Calendar and Unified Calendar in one screen.
export default function CalendarPage() {
  const { tasks } = useDemo();
  const [tab, setTab] = useState('unified');
  const [types, setTypes] = useState([]);
  const [includeAll, setIncludeAll] = useState(false);

  const typeList = tab === 'fab' ? FAB_TYPES : tab === 'install' ? INSTALL_TYPES : [...INSTALL_TYPES, ...FAB_TYPES];
  const colors = tab === 'fab' ? fabTypeColors : tab === 'install' ? installTypeStyles : { ...installTypeStyles, ...fabTypeColors };
  const events = useMemo(() => calendarEvents(tasks, { tab, types, includeAll }), [tasks, tab, types, includeAll]);
  const shown = types.length ? Object.fromEntries(Object.entries(colors).filter(([k]) => types.includes(k))) : colors;

  const pickTab = (id) => { setTab(id); setTypes([]); };
  const toggle = (t) => setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  return (
    <div className="dash">
      <PageHeader eyebrow="Schedule" title="Calendar" subtitle="Design, fabrication and install tasks by day. Click a task to open it, or a day to see that day." />

      <div className="ui-scope flex flex-wrap items-center gap-2 font-sans">
        <SavedViews label="Calendar" value={tab} onChange={pickTab} views={TABS} />
        <FilterPanel active={types.length + (includeAll ? 1 : 0)} onClear={() => { setTypes([]); setIncludeAll(false); }}>
          <div className="cal-filters" aria-label="Type filter">
            {typeList.map((t) => (
              <button key={t} type="button" aria-pressed={types.includes(t)} className={`type-chip ${types.includes(t) ? 'on' : ''}`} onClick={() => toggle(t)}>
                <i className="dot" style={{ background: colors[t] }} />{t}
              </button>
            ))}
          </div>
          {tab !== 'fab' && (
            <label className="check-inline flex items-center gap-2 text-sm"><input type="checkbox" checked={includeAll} onChange={(e) => setIncludeAll(e.target.checked)} />Include External and Print Only</label>
          )}
        </FilterPanel>
        {types.length > 0 && <span className="text-sm text-muted-foreground">Showing {types.join(', ')}</span>}
      </div>

      <CalendarCard key={tab} title={`${TABS.find((t) => t.id === tab).label} calendar`} events={events} typeColors={shown} defaultView="Month" />
    </div>
  );
}
