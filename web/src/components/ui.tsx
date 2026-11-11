import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Page title block: small green eyebrow, uppercase heading, optional subtitle and actions. */
export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
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

/** A bordered panel with an optional small uppercase title and a right-hand action. */
export function Card({ title, action, children, flush = false, label, tone }: { title?: string; action?: ReactNode; children: ReactNode; flush?: boolean; label?: string; tone?: 'loc' | 'sign' | 'crm' }) {
	return (
		<section className={'card' + (tone ? ' card--' + tone : '')} aria-label={title ?? label}>
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

/** A big-number tile. `tone` colours the number: danger when something needs attention, ok when all is clear. */
export function Kpi({ label, value, note, tone, to }: { label: string; value: ReactNode; note?: string; tone?: 'danger' | 'ok'; to?: string }) {
	const cls = 'kpi' + (tone ? ` kpi-${tone}` : '');
	const body = (
		<>
			<span className="kpi-label">{label}</span>
			<span className="kpi-value num">{value}</span>
			{note && <span className="kpi-note">{note}</span>}
		</>
	);
	return to ? (
		<Link className={cls} to={to}>
			{body}
		</Link>
	) : (
		<div className={cls}>{body}</div>
	);
}

export interface FilterChip { key: string; label: string; count: number; danger?: boolean }

/** The top row of a list card: one or more groups of filter chips. */
export function FilterBar({ children }: { children: ReactNode }) {
	return <div className="filter-bar">{children}</div>;
}

/**
 * A group of filter chips, each with a count. Pressing a chip filters the list; the active chip is filled.
 * The count turns red when `danger` is set and it is above zero.
 */
export function FilterChips({ chips, value, onChange, label, heading }: { chips: FilterChip[]; value: string; onChange: (key: string) => void; label: string; heading?: string }) {
	return (
		<div className="filter-chips" role="group" aria-label={label}>
			{heading && <span className="filter-chips__heading">{heading}</span>}
			{chips.map((c) => (
				<button key={c.key} type="button" className={'fchip' + (value === c.key ? ' on' : '') + (c.danger && c.count ? ' fchip--danger' : '')} aria-pressed={value === c.key} onClick={() => onChange(c.key)}>
					{c.label}
					<span className="fchip__count num">{c.count}</span>
				</button>
			))}
		</div>
	);
}

/** Circular percentage, for the job header. */
export function Ring({ value, label }: { value: number; label: string }) {
	const v = Math.max(0, Math.min(100, Math.round(value)));
	const r = 38;
	const c = 2 * Math.PI * r;
	return (
		<svg className="ring" viewBox="0 0 92 92" role="img" aria-label={`${label} ${v} percent`}>
			<circle cx="46" cy="46" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
			<circle cx="46" cy="46" r={r} fill="none" stroke="var(--brand)" strokeWidth="9" strokeLinecap="butt" strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 46 46)" />
			<text className="ring-text" x="46" y="52" textAnchor="middle">
				{v}%
			</text>
		</svg>
	);
}

/** A date for people (4 Nov 2026), whatever way the server wrote it. Anything that is not a date is shown as it is. */
export function fmtDate(value: string | null | undefined): string {
	if (!value) return '-';
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (!m) return value;
	return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Showing N of N" directly under a table, outside its scroll area, so the count always sits at the table's bottom edge. */
export function TableFooter({ shown, total, children }: { shown: number; total?: number; children?: ReactNode }) {
	return <p className="grid-foot">Showing {shown} of {total ?? shown}{children}</p>;
}
