import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import { useDismiss } from './useDismiss';

export interface FilterView {
	key: string;
	label: string;
	count?: number;
}

/**
 * One Filters button for every list: the saved views (with their counts) sit at the top of the menu, and any extra
 * controls (stage, manager, department) go under them. The button shows which view is on, so nothing is hidden.
 */
export function FilterMenu({ views, view, onView, extra, extraCount = 0, onClear, label = 'Filters' }: {
	views: FilterView[];
	view: string;
	onView: (key: string) => void;
	extra?: ReactNode;
	extraCount?: number;
	onClear?: () => void;
	label?: string;
}) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const current = views.find((v) => v.key === view) ?? views[0];

	useDismiss(open, box, () => setOpen(false));

	return (
		<div className="filter-menu" ref={box}>
			<button type="button" className={'btn btn-ghost' + (extraCount ? ' has-filters' : '')} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
				<SlidersHorizontal size={15} aria-hidden="true" /> {label}
				{current && <span className="filter-menu__current">{current.label}</span>}
				{extraCount > 0 && <span className="tab-count num">{extraCount}</span>}
			</button>
			{open && (
				<div className="filter-pop" role="group" aria-label={label}>
					<p className="filter-pop__title">Show</p>
					<ul className="filter-pop__views">
						{views.map((v) => (
							<li key={v.key}>
								<button type="button" className={view === v.key ? 'on' : ''} aria-pressed={view === v.key} onClick={() => { onView(v.key); if (!extra) setOpen(false); }}>
									<span className="filter-pop__tick">{view === v.key && <Check size={14} aria-hidden="true" />}</span>
									<span>{v.label}</span>
									{v.count !== undefined && <span className="tab-count num">{v.count}</span>}
								</button>
							</li>
						))}
					</ul>
					{extra && (
						<>
							<p className="filter-pop__title">Narrow down</p>
							<div className="filter-pop__extra">{extra}</div>
						</>
					)}
					{onClear && extraCount > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>Clear filters</button>}
				</div>
			)}
		</div>
	);
}
