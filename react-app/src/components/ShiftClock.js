import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ChevronRight, Coffee, LogIn, LogOut } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { shortName } from '../lib/people';
import { addDays, startOfWeek, toKey, today } from '../lib/dates';

const pad = (n) => String(n).padStart(2, '0');
const startMs = (start) => { const [h, m] = String(start || '0:0').split(':').map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); };
const clock = (secs) => `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;
const hhmm = (hours) => `${Math.floor(hours)}h ${pad(Math.round((hours % 1) * 60))}m`;
const ampm = (start) => { const [h, m] = String(start || '0:0').split(':').map(Number); return `${pad(((h + 11) % 12) + 1)}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };

// Check in / break / check out on every dashboard. A live session timer while checked in, one clear main button,
// and this week's total with a link to the full timesheet. Same timesheet actions as Booked hours > Timesheet.
export default function ShiftClock() {
  const { role, roleId, timesheets, checkIn, startBreak, endBreak, checkOut } = useDemo();
  const [now, setNow] = useState(Date.now());
  const me = shortName(role.name);
  const active = timesheets.find((t) => t.worker === me && t.status !== 'Checked-out');
  const onBreak = active?.status === 'On Break';
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (roleId === 'viewer') return null;

  const breakSecs = (active?.breakMins || 0) * 60 + (onBreak && active.breakStartedAt ? Math.max(0, Math.floor((now - new Date(active.breakStartedAt).getTime()) / 1000)) : 0);
  const worked = active ? Math.max(0, Math.floor((now - startMs(active.start)) / 1000) - breakSecs) : 0;
  const from = toKey(startOfWeek(today()));
  const to = toKey(addDays(startOfWeek(today()), 6));
  const week = timesheets.filter((t) => t.worker === me && t.status === 'Checked-out' && t.date >= from && t.date <= to);
  const weekHours = week.reduce((n, t) => n + (t.total || 0), 0) + worked / 3600;
  const state = !active ? 'out' : onBreak ? 'break' : 'in';

  return (
    <section className={`shift shift-${state}`} aria-label="Check in and out">
      <div className="shift-main">
        <span className="shift-dot" aria-hidden="true" />
        <div className="shift-text">
          <span className="shift-state">{state === 'out' ? 'Not checked in' : state === 'break' ? 'On break' : 'Checked in'}</span>
          {state === 'out'
            ? <span className="shift-sub">Start your day with one tap</span>
            : <span className="shift-sub">Since {ampm(active.start)}{breakSecs ? ` · break ${Math.round(breakSecs / 60)} min` : ''}</span>}
        </div>
        {state !== 'out' && <span className="shift-timer" role="timer" aria-label={`Worked ${clock(worked)}`}>{clock(worked)}</span>}
      </div>

      <div className="shift-actions">
        {state === 'out' && <button type="button" className="shift-btn go" onClick={checkIn}><LogIn size={17} aria-hidden="true" /> Check in</button>}
        {state === 'in' && (
          <>
            <button type="button" className="shift-btn soft" onClick={() => startBreak(active.id)}><Coffee size={17} aria-hidden="true" /> Break</button>
            <button type="button" className="shift-btn stop" onClick={() => checkOut(active.id, '')}><LogOut size={17} aria-hidden="true" /> Check out</button>
          </>
        )}
        {state === 'break' && <button type="button" className="shift-btn go" onClick={() => endBreak(active.id)}><Coffee size={17} aria-hidden="true" /> End break</button>}
      </div>

      <Link to="/hours" className="shift-week" aria-label={`This week ${hhmm(weekHours)}. Open my timesheet`}>
        <CalendarClock size={16} aria-hidden="true" />
        <span><b>{hhmm(weekHours)}</b> this week</span>
        <span className="shift-week-link">Timesheet <ChevronRight size={14} aria-hidden="true" /></span>
      </Link>
    </section>
  );
}
