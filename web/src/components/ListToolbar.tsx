import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

export interface ActiveChip {
	key: string;
	label: string;
	onRemove: () => void;
}

/** A toolbar button that opens a popover below it. Closes on outside click or Escape. */
export function ToolbarMenu({ label, count, children, align = 'left', ariaLabel }: {
	label: string;
	count?: number;
	children: ReactNode;
	align?: 'left' | 'right';
	ariaLabel?: string;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', esc);
		};
	}, [open]);
	return (
		<div className="lt-menu" ref={box}>
			<button type="button" className={'lt-btn' + (count ? ' is-on' : '')} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
				{label}
				{count ? <span className="lt-count num">{count}</span> : null}
				<ChevronDown size={13} aria-hidden="true" />
			</button>
			{open && (
				<div className={'lt-pop' + (align === 'right' ? ' lt-pop--right' : '')} role="group" aria-label={ariaLabel ?? label}>
					{children}
				</div>
			)}
		</div>
	);
}

/**
 * The toolbar buttons that sit in the page header next to Add: the search icon, the View menu and the page's actions.
 */
export function ListToolbarButtons({ searchOpen = false, onSearchOpen, searchActive = false, showSearch = true, viewOptions, actions }: {
	/** Leave out the search icon on pages that have no search or filters. */
	searchOpen?: boolean;
	onSearchOpen?: () => void;
	searchActive?: boolean;
	/** Set false on tabs with nothing to search or filter. */
	showSearch?: boolean;
	viewOptions?: ReactNode;
	actions?: ReactNode;
}) {
	return (
		<div className="lt-actions">
			{showSearch && onSearchOpen && <button
				type="button"
				className={'lt-icon-btn' + (searchActive ? ' is-on' : '')}
				aria-label="Search and filter"
				aria-expanded={searchOpen}
				aria-controls="lt-panel"
				onClick={onSearchOpen}
			>
				<Search size={16} aria-hidden="true" />
			</button>}
			{viewOptions && <ToolbarMenu label="View" ariaLabel="View options" align="right">{viewOptions}</ToolbarMenu>}
			{actions}
		</div>
	);
}

interface ListToolbarProps {
	/** Whether the search and filter panel is open. */
	searchOpen: boolean;
	panelTitle?: string;
	/** Panel contents (views, search field, operator, value, and filters). Only shown while the panel is open. */
	panelBody?: ReactNode;
	onPanelApply?: () => void;
	onPanelClear?: () => void;
	onPanelClose: () => void;
	/** Search and filters that are on, shown under the title as chips. */
	chips?: ActiveChip[];
	onClearAll?: () => void;
	label?: string;
}

/**
 * The list's search, view and filter panel, and the chips that show what is narrowing the list. The buttons that open it
 * are in the page header (ListToolbarButtons).
 */
export function ListToolbar({ searchOpen, panelTitle = 'Search', panelBody, onPanelApply, onPanelClear, onPanelClose, chips = [], onClearAll, label = 'List' }: ListToolbarProps) {
	// Escape closes the panel; clicks outside do not, so the list can still be used while it is open.
	useEffect(() => {
		if (!searchOpen) return;
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onPanelClose(); };
		document.addEventListener('keydown', esc);
		return () => document.removeEventListener('keydown', esc);
	}, [searchOpen, onPanelClose]);

	return (
		<div className="lt" aria-label={label}>
			{chips.length > 0 && (
				<div className="lt-chips" aria-label="Active search and filters">
					<span className="lt-chips__label">Showing</span>
					{chips.map((c) => (
						<span key={c.key} className="lt-chip">
							{c.label}
							<button type="button" aria-label={`Remove ${c.label}`} onClick={c.onRemove}><X size={12} aria-hidden="true" /></button>
						</span>
					))}
					{onClearAll && <button type="button" className="lt-clear" onClick={onClearAll}>Clear all</button>}
				</div>
			)}

			{searchOpen && (
				<aside id="lt-panel" className="lt-drawer" role="dialog" aria-label={panelTitle}>
					<h2 className="sr-only">{panelTitle}</h2>
					<div className="lt-drawer__body">{panelBody}</div>
					<footer className="lt-drawer__foot">
						{onPanelClear && <button type="button" className="btn btn-ghost" onClick={onPanelClear}>Clear</button>}
						{onPanelApply && <button type="button" className="btn" onClick={onPanelApply}>Search</button>}
						<button type="button" className="lt-icon-btn" aria-label="Close search" onClick={onPanelClose}><X size={16} aria-hidden="true" /></button>
					</footer>
				</aside>
			)}
		</div>
	);
}

/** A labelled part of the search panel that opens and closes with its arrow. */
export function PanelSection({ title, summary, defaultOpen = true, children }: { title: string; summary?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className="lt-section">
			<button type="button" className="lt-section__head" aria-expanded={open} onClick={() => setOpen(!open)}>
				<span className="lt-section__title">{title}</span>
				{!open && summary && <span className="lt-section__summary">{summary}</span>}
				<ChevronDown size={15} aria-hidden="true" className={'lt-section__chev' + (open ? ' is-open' : '')} />
			</button>
			{open && <div className="lt-section__body">{children}</div>}
		</div>
	);
}
