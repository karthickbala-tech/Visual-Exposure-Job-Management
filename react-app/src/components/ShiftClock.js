import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coffee, LogIn, LogOut, Timer } from 'lucide-react';
import { useDemo } from '../context/DemoContext';
import { shortName } from '../lib/people';

const sinceText = (start) => {
  const [h, m] = String(start || '0:0').split(':').map(Number);
  const now = new Date();
  const mins = Math.max(0, now.getHours() * 60 + now.getMinutes() - (h * 60 + m));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

// Check in / break / check out at the top of every dashboard, so nobody has to open Booked hours to start their day.
// Uses the same timesheet actions as Booked hours > Timesheet.
export default function ShiftClock() {
  const { role, roleId, timesheets, checkIn, startBreak, endBreak, checkOut } = useDemo();
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60000); return () => clearInterval(t); }, []);
  if (roleId === 'viewer') return null;
  const me = shortName(role.name);
  const active = timesheets.find((t) => t.worker === me && t.status !== 'Checked-out');
  const onBreak = active?.status === 'On Break';

  return (
    <section className={`shift-clock ${active ? (onBreak ? 'is-break' : 'is-in') : ''}`} aria-label="Check in and out">
      <Timer size={20} aria-hidden="true" className="shift-icon" />
      <div className="shift-text">
        {!active && <><strong>You are not checked in</strong><small>Check in when you start work</small></>}
        {active && !onBreak && <><strong>Checked in at {active.start}</strong><small>Working for {sinceText(active.start)}{active.breakMins ? ` · ${active.breakMins} min break` : ''}</small></>}
        {onBreak && <><strong>On break</strong><small>Started work at {active.start}</small></>}
      </div>
      <div className="shift-actions">
        {!active && <button type="button" className="btn btn-primary" onClick={checkIn}><LogIn size={16} aria-hidden="true" /> Check in</button>}
        {active && !onBreak && (
          <>
            <button type="button" className="btn btn-ghost" onClick={() => startBreak(active.id)}><Coffee size={16} aria-hidden="true" /> Break</button>
            <button type="button" className="btn btn-primary" onClick={() => checkOut(active.id, '')}><LogOut size={16} aria-hidden="true" /> Check out</button>
          </>
        )}
        {onBreak && <button type="button" className="btn btn-primary" onClick={() => endBreak(active.id)}><Coffee size={16} aria-hidden="true" /> End break</button>}
        <Link className="shift-link" to="/hours">My timesheet</Link>
      </div>
    </section>
  );
}
