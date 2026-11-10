import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface MenuItem {
	label: string;
	onSelect: () => void;
}

/** A right-click menu at the pointer. It closes after an item is picked, on a click outside, Escape, scrolling or resizing. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
	const box = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) onClose(); };
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', esc);
		window.addEventListener('scroll', onClose, true);
		window.addEventListener('resize', onClose);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', esc);
			window.removeEventListener('scroll', onClose, true);
			window.removeEventListener('resize', onClose);
		};
	}, [onClose]);
	const left = Math.max(8, Math.min(x, window.innerWidth - 220));
	const top = Math.max(8, Math.min(y, window.innerHeight - items.length * 38 - 16));
	return createPortal(
		<div ref={box} className="ctx-menu" role="menu" style={{ left, top }}>
			{items.map((i) => (
				<button key={i.label} type="button" role="menuitem" className="ctx-menu__item" onClick={() => { onClose(); i.onSelect(); }}>
					{i.label}
				</button>
			))}
		</div>,
		document.body,
	);
}
