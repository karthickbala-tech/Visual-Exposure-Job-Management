import { useEffect } from 'react';
import { X } from 'lucide-react';

const TONES = {
  // job + task stages (names from the Creator export)
  Preparation: 'gray', 'In Progress': 'blue', 'On Hold': 'amber', Completed: 'green',
  'Completed - Closed': 'green', Cancelled: 'red',
  'Awaiting Scheduling': 'gray', Scheduled: 'blue', 'Manager Review': 'purple', Rejected: 'red', Reopen: 'amber',
  'Not Started': 'gray', 'Client Review': 'purple',
  // SWMS
  Created: 'red', 'PM Signed': 'amber', 'TL Signed': 'amber', Closed: 'gray', 'Not Required': 'gray',
};

export const Chip = ({ value, tone }) => <span className={`chip chip-${tone || TONES[value] || 'gray'}`}>{value}</span>;

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Card({ title, action, children, flush = false, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </section>
  );
}

export function KpiCard({ icon: Icon, label, value, note, tone = 'brand', children }) {
  return (
    <div className={`kpi kpi-${tone}`}>
      <div className="kpi-top">
        <span className="kpi-icon"><Icon size={18} aria-hidden="true" /></span>
        <span className="kpi-label">{label}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {children}
      <div className="kpi-note">{note}</div>
    </div>
  );
}

export function ProgressBar({ value, tone = 'brand', label }) {
  return (
    <div className="bar-row" title={`${value}%`}>
      <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span className={`bar-fill bar-${tone}`} style={{ width: `${value}%` }} />
      </div>
      <span className="bar-num">{value}%</span>
    </div>
  );
}

// columns: [{ key, label, primary?, render?(row) }]. On phones each row becomes a card.
export function ResponsiveTable({ columns, rows, empty = 'Nothing to show' }) {
  return (
    <div className="table-wrap">
      <table className="rtable">
        <thead>
          <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td className="table-empty" colSpan={columns.length}>{empty}</td></tr>}
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((c) => (
                <td key={c.key} data-label={c.label} className={c.primary ? 'cell-primary' : ''}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
