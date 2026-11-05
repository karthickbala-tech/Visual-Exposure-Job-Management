import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui-kit/dialog';
import { cn } from '../lib/utils';

const TONES = {
  // job + task stages (names from the Creator export)
  // Same colours as StageBadge: grey not started, blue scheduled, amber in progress, purple in review, green done.
  Preparation: 'gray', 'In Progress': 'amber', 'On Hold': 'gray', Completed: 'green',
  'Completed - Closed': 'green', Cancelled: 'gray', 'Complete - Not Used': 'gray',
  'Awaiting Scheduling': 'gray', Scheduled: 'blue', 'Manager Review': 'purple', Rejected: 'red', Reopen: 'red',
  'Not Started': 'gray', 'Client Review': 'amber', 'Awaiting Submission': 'amber', 'Approved & Completed': 'green',
  'To be Assigned': 'gray', Assigned: 'blue', Open: 'blue',
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

// Every pop-up form in the app. Built on the shadcn/ui Dialog (Radix): focus stays inside, Esc and the
// backdrop close it, and screen readers announce the title. The "modal" class is kept for existing tests.
export function Modal({ title, onClose, children, wide = false }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className={cn('modal max-h-[92vh] gap-0 overflow-y-auto p-0', wide ? 'sm:max-w-2xl' : 'sm:max-w-[520px]')}
        aria-describedby={undefined}
        onOpenAutoFocus={(e) => {
          // Keep the field a form marks autoFocus; otherwise focus the dialog itself rather than its first button.
          e.preventDefault();
          const box = e.currentTarget;
          requestAnimationFrame(() => { if (box && !box.contains(document.activeElement)) box.focus(); });
        }}
      >
        <DialogHeader className="px-5 pb-1 pr-12 pt-5 text-left">
          <DialogTitle id="modal-title" className="text-lg font-bold leading-snug">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
