import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The popup used for every "add" action in the app. It sits over the page, takes focus, closes with the × button,
 * Escape or a click on the dimmed background, and gives focus back to the button that opened it.
 */
export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
	const panel = useRef<HTMLDivElement>(null);
	// keep the latest close handler without re-running the setup (which would move focus again)
	const close = useRef(onClose);
	useEffect(() => { close.current = onClose; });

	useEffect(() => {
		const opener = document.activeElement as HTMLElement | null;
		document.body.classList.add('dialog-open');
		panel.current?.querySelector<HTMLElement>('input:not([type=hidden]), select, textarea, button')?.focus();
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close.current(); };
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('keydown', esc);
			document.body.classList.remove('dialog-open');
			opener?.focus?.();
		};
	}, []);

	return createPortal(
		<div className="dialog-layer" onMouseDown={(e) => { if (e.target === e.currentTarget) close.current(); }}>
			<div ref={panel} className={'dialog' + (wide ? ' dialog--wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
				<header className="dialog__head">
					<h2>{title}</h2>
					<button type="button" className="icon-btn" aria-label="Close" onClick={() => close.current()}>
						<X size={18} aria-hidden="true" />
					</button>
				</header>
				<div className="dialog__body">{children}</div>
			</div>
		</div>,
		document.body,
	);
}
