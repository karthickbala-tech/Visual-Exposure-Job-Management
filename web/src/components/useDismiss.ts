import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Close a popover when the user clicks outside it or presses Escape. */
export function useDismiss(open: boolean, box: RefObject<HTMLElement | null>, close: () => void) {
	useEffect(() => {
		if (!open) return;
		const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) close(); };
		const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
		document.addEventListener('mousedown', away);
		document.addEventListener('keydown', esc);
		return () => {
			document.removeEventListener('mousedown', away);
			document.removeEventListener('keydown', esc);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);
}
