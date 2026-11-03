import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from './ui';
import {
  DAY_NAMES, MONTH_NAMES, MONTH_SHORT, addDays, formatLong, startOfWeek, toKey, today,
} from '../lib/dates';

// events: [{ id, date: 'YYYY-MM-DD', title, type }], typeColors: { type: '#hex' }
// Desktop shows a grid. Phones show an agenda list of the same range.
export default function CalendarCard({ title, events, typeColors, defaultView = 'Month' }) {
  const [view, setView] = useState(defaultView);
  const [anchor, setAnchor] = useState(today());
  const todayKey = toKey(today());

  const byDate = useMemo(() => {
    const map = {};
    events.forEach((e) => { (map[e.date] = map[e.date] || []).push(e); });
    return map;
  }, [events]);

  let days;
  let label;
  if (view === 'Week') {
    const s = startOfWeek(anchor);
    const e = addDays(s, 6);
    days = Array.from({ length: 7 }, (_, i) => addDays(s, i));
    label = `${s.getDate()} ${MONTH_SHORT[s.getMonth()]} - ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} ${e.getFullYear()}`;
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    const start = startOfWeek(first);
    const count = Math.ceil((Math.round((last - start) / 86400000) + 1) / 7) * 7;
    days = Array.from({ length: count }, (_, i) => addDays(start, i));
    label = `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
  }

  const shift = (dir) => {
    if (view === 'Month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    else setAnchor(addDays(anchor, dir * 7));
  };

  const agenda = days
    .filter((d) => view === 'Week' || d.getMonth() === anchor.getMonth())
    .map((d) => ({ key: toKey(d), list: byDate[toKey(d)] || [] }))
    .filter((d) => d.list.length > 0);

  const dot = (type) => <i className="dot" style={{ background: typeColors[type] || '#7b8794' }} />;

  return (
    <Card title={title} flush className="cal">
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button type="button" className="icon-btn" aria-label="Previous" onClick={() => shift(-1)}><ChevronLeft size={18} /></button>
          <button type="button" className="icon-btn" aria-label="Next" onClick={() => shift(1)}><ChevronRight size={18} /></button>
          <strong className="cal-label">{label}</strong>
        </div>
        <div className="cal-ctrl">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAnchor(today())}>Today</button>
          <div className="segmented" role="tablist" aria-label="Calendar view">
            {['Month', 'Week'].map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`cal-grid cal-${view.toLowerCase()}`}>
        {DAY_NAMES.map((n) => <div key={n} className="cal-dow">{n}</div>)}
        {days.map((d) => {
          const key = toKey(d);
          const list = byDate[key] || [];
          const outside = view === 'Month' && d.getMonth() !== anchor.getMonth();
          return (
            <div key={key} className={`cal-cell ${outside ? 'outside' : ''}`}>
              <span className={`cal-num ${key === todayKey ? 'today' : ''}`}>{d.getDate()}</span>
              {list.slice(0, 3).map((e) => (
                <div key={e.id} className="cal-ev" title={`${e.title} (${e.type})`}>{dot(e.type)}<span>{e.title}</span></div>
              ))}
              {list.length > 3 && <span className="cal-more">+{list.length - 3} more</span>}
            </div>
          );
        })}
      </div>

      <div className="cal-agenda">
        {agenda.length === 0 && <p className="muted pad">Nothing scheduled in this {view.toLowerCase()}.</p>}
        {agenda.map(({ key, list }) => (
          <div key={key} className="agenda-day">
            <h3 className={key === todayKey ? 'today' : ''}>{formatLong(key)}</h3>
            {list.map((e) => <div key={e.id} className="agenda-ev">{dot(e.type)}<span>{e.title}</span><small>{e.type}</small></div>)}
          </div>
        ))}
      </div>

      <div className="cal-legend">
        {Object.entries(typeColors).map(([name, color]) => (
          <span key={name}><i className="dot" style={{ background: color }} />{name}</span>
        ))}
      </div>
    </Card>
  );
}
