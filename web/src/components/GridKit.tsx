import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';

/** How tall each row is: Compact fits many rows on screen, Tall gives room to read wrapped text. */
export type RowMode = 'compact' | 'normal' | 'tall';
const ROW_MODES: { key: RowMode; label: string }[] = [
	{ key: 'compact', label: 'Compact' },
	{ key: 'normal', label: 'Normal' },
	{ key: 'tall', label: 'Tall' },
];

const MIN_WIDTH = 60;
const MAX_WIDTH = 720;

interface Saved {
	widths: Record<string, number>;
	rows: RowMode;
}

function load(storageKey: string): Partial<Saved> {
	try {
		const v = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
		return v && typeof v === 'object' ? v : {};
	} catch {
		return {};
	}
}

/**
 * Excel-style grid state for one table: column widths (dragged with the handle in each header, or with the arrow keys)
 * and the row height. Both are remembered per table in this browser. Nothing here calls the server.
 */
export function useGridLayout(storageKey: string, defaults: Record<string, number>) {
	const [state, setState] = useState<Saved>(() => {
		const saved = load(storageKey);
		const widths: Record<string, number> = { ...defaults };
		for (const [k, w] of Object.entries(saved.widths ?? {})) {
			if (k in defaults && typeof w === 'number') widths[k] = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
		}
		const rows: RowMode = saved.rows === 'compact' || saved.rows === 'tall' ? saved.rows : 'normal';
		return { widths, rows };
	});

	useEffect(() => {
		try {
			localStorage.setItem(storageKey, JSON.stringify(state));
		} catch {
			/* not saved: the grid still works for this visit */
		}
	}, [storageKey, state]);

	const setWidth = useCallback((key: string, px: number) => {
		setState((s) => ({ ...s, widths: { ...s.widths, [key]: Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, px))) } }));
	}, []);

	const setRows = useCallback((rows: RowMode) => setState((s) => ({ ...s, rows })), []);

	const reset = useCallback(() => setState((s) => ({ ...s, widths: { ...defaults } })), [defaults]);

	/** Start dragging the right edge of a column. The width follows the pointer until it is released. */
	const startResize = useCallback((key: string, e: ReactPointerEvent) => {
		e.preventDefault();
		const startX = e.clientX;
		const startW = state.widths[key] ?? defaults[key] ?? 120;
		document.body.classList.add('col-resizing');
		const move = (ev: PointerEvent) => setWidth(key, startW + ev.clientX - startX);
		const up = () => {
			document.body.classList.remove('col-resizing');
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', up);
	}, [defaults, setWidth, state.widths]);

	return { widths: state.widths, rows: state.rows, setRows, setWidth, startResize, reset };
}

/** The thin handle on the right edge of a header cell. Drag it, double-click to reset, or use the arrow keys. */
export function ColResizeHandle({ label, width, defaultWidth, onStart, onKey, onReset }: {
	label: string;
	width: number;
	defaultWidth: number;
	onStart: (e: ReactPointerEvent) => void;
	onKey: (delta: number) => void;
	onReset: () => void;
}) {
	const onKeyDown = (e: ReactKeyboardEvent) => {
		if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			onKey((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 40 : 8));
		}
	};
	return (
		<span
			className="col-resize"
			role="separator"
			aria-orientation="vertical"
			aria-label={`Resize ${label} column`}
			aria-valuenow={width}
			aria-valuemin={MIN_WIDTH}
			aria-valuemax={MAX_WIDTH}
			title={`Drag to resize. Double-click to reset (${defaultWidth}px)`}
			tabIndex={0}
			onPointerDown={onStart}
			onDoubleClick={onReset}
			onKeyDown={onKeyDown}
		/>
	);
}

/** Compact / Normal / Tall switch for the row height. */
export function RowHeightPicker({ value, onChange }: { value: RowMode; onChange: (m: RowMode) => void }) {
	return (
		<div className="segmented grid-rows" role="group" aria-label="Row height">
			{ROW_MODES.map((m) => (
				<button key={m.key} type="button" className={value === m.key ? 'on' : ''} aria-pressed={value === m.key} onClick={() => onChange(m.key)}>
					{m.label}
				</button>
			))}
		</div>
	);
}

/**
 * Status bar pinned to the bottom of the screen under a wide table: the record count. The table scrolls sideways inside its
 * own box. Render it as a direct child of the page so it sticks to the bottom of the screen while the page scrolls.
 */
export function GridStatusBar({ text, pager }: { text: ReactNode; pager?: ReactNode }) {
	return (
		<div className="grid-status">
			<p className="grid-status__text">{text}</p>
			{pager}
		</div>
	);
}

/** Page numbers to show: all of them when there are few, otherwise the first, the last and the ones around the current page. */
function pageItems(page: number, count: number): (number | '…')[] {
	if (count <= 7) return Array.from({ length: count }, (_, i) => i);
	const nums = [...new Set([0, count - 1, page - 1, page, page + 1])].filter((n) => n >= 0 && n < count).sort((a, b) => a - b);
	const out: (number | '…')[] = [];
	nums.forEach((n, i) => {
		if (i > 0 && n - nums[i - 1] > 1) out.push('…');
		out.push(n);
	});
	return out;
}

/** Previous / numbered pages / Next. `page` starts at 0. Render nothing when everything fits on one page. */
export function Pagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
	if (pageCount <= 1) return null;
	return (
		<nav className="pager" aria-label="Pages">
			<button type="button" className="pager__btn" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={14} aria-hidden="true" /></button>
			{pageItems(page, pageCount).map((p, i) =>
				p === '…' ? <span key={'gap' + i} className="pager__gap" aria-hidden="true">…</span> : (
					<button key={p} type="button" className="pager__btn" aria-label={'Page ' + (p + 1)} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>{p + 1}</button>
				),
			)}
			<button type="button" className="pager__btn" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}><ChevronRight size={14} aria-hidden="true" /></button>
		</nav>
	);
}

export interface GridColumn<T> {
	key: string;
	label: string;
	width: number;
	/** Key the width is saved under, when columns share one width (for example every day column). Defaults to `key`. */
	widthKey?: string;
	right?: boolean;
	cell: (row: T) => ReactNode;
}

/** Default widths for a column list, for useGridLayout. Keep the result at module level so it stays the same between renders. */
export function gridWidths(columns: { key: string; width: number }[]): Record<string, number> {
	return Object.fromEntries(columns.map((c) => [c.key, c.width]));
}

export type GridLayout = ReturnType<typeof useGridLayout>;
const CHECK_WIDTH = 36;

/**
 * The shared list table: resizable columns (drag the header edge), a row height set by the layout, cells that clip, and
 * optional row checkboxes. The table scrolls sideways and up and down inside its own box, only when it overflows.
 * Put the GridStatusBar after the card that holds it, so the count stays at the bottom of the screen.
 */
export function ResizableGrid<T>({ layout, columns, rows, rowKey, label, picked, onPick, rowClass, empty = 'Nothing to show.', footer, groupOf }: {
	layout: GridLayout;
	columns: GridColumn<T>[];
	rows: T[];
	rowKey: (row: T) => string;
	label: string;
	/** Optional row checkboxes: the picked keys and how to change them. */
	picked?: string[];
	onPick?: (keys: string[]) => void;
	rowClass?: (row: T) => string | undefined;
	empty?: ReactNode;
	/** Optional totals row: one entry per column, in the same order. */
	footer?: ReactNode[];
	/** Optional group header: return content to draw a full-width heading row before that row, or undefined for none. */
	groupOf?: (row: T, index: number, rows: T[]) => ReactNode | undefined;
}) {
	if (rows.length === 0) return <p className="table-empty">{empty}</p>;
	const checks = !!picked && !!onPick;
	const wk = (c: GridColumn<T>) => c.widthKey ?? c.key;
	const width = (c: GridColumn<T>) => layout.widths[wk(c)] ?? c.width;
	const total = (checks ? CHECK_WIDTH : 0) + columns.reduce((n, c) => n + width(c), 0);
	const allPicked = checks && rows.every((r) => picked.includes(rowKey(r)));
	const firstLeft = checks ? CHECK_WIDTH : 0;
	return (
		<div className="grid-wrap" data-rows={layout.rows}>
			<table className="grid-table" style={{ width: total }}>
				<caption className="sr-only">{label}</caption>
				<colgroup>
					{checks && <col style={{ width: CHECK_WIDTH }} />}
					{columns.map((c) => <col key={c.key} style={{ width: width(c) }} />)}
				</colgroup>
				<thead>
					<tr>
						{checks && (
							<th scope="col" className="col-check">
								<input type="checkbox" aria-label={`Select all ${label.toLowerCase()} shown`} checked={allPicked} onChange={(e) => onPick(e.target.checked ? rows.map(rowKey) : [])} />
							</th>
						)}
						{columns.map((c, i) => (
							<th key={c.key} scope="col" className={(i === 0 ? 'sticky-col ' : '') + (c.right ? 'num' : '')} style={i === 0 ? { left: firstLeft } : undefined}>
								<span className="th-label" title={c.label}>{c.label}</span>
								<ColResizeHandle
									label={c.label}
									width={width(c)}
									defaultWidth={c.width}
									onStart={(e) => layout.startResize(wk(c), e)}
									onKey={(d) => layout.setWidth(wk(c), width(c) + d)}
									onReset={() => layout.setWidth(wk(c), c.width)}
								/>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((r, idx) => {
						const k = rowKey(r);
						const on = checks && picked.includes(k);
						const heading = groupOf?.(r, idx, rows);
						return (
							<Fragment key={k}>
							{heading != null && <tr className="grid-group"><td colSpan={columns.length + (checks ? 1 : 0)}>{heading}</td></tr>}
							<tr className={(on ? 'row-picked ' : '') + (rowClass?.(r) ?? '')}>
								{checks && (
									<td className="col-check">
										<input type="checkbox" aria-label={`Select row ${k}`} checked={on} onChange={(e) => onPick(e.target.checked ? [...picked, k] : picked.filter((x) => x !== k))} />
									</td>
								)}
								{columns.map((c, i) => (
									<td key={c.key} className={(i === 0 ? 'sticky-col ' : '') + (c.right ? 'num' : '')} style={i === 0 ? { left: firstLeft } : undefined}>
										<div className="cell-clip">{c.cell(r)}</div>
									</td>
								))}
							</tr>
							</Fragment>
						);
					})}
				</tbody>
				{footer && (
					<tfoot>
						<tr className="grid-total">
							{checks && <td className="col-check" />}
							{footer.map((c, i) => (
								<td key={i} className={(i === 0 ? 'sticky-col ' : '') + (columns[i]?.right ? 'num' : '')} style={i === 0 ? { left: firstLeft } : undefined}>{c}</td>
							))}
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}
