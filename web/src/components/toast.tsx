import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type ToastKind = 'ok' | 'error' | 'warn' | 'info';

interface ToastState {
	msg: string;
	kind: ToastKind;
}

const ToastContext = createContext<{ notify: (msg: string, kind?: ToastKind) => void }>({ notify: () => {} });

const ICONS: Record<ToastKind, typeof CheckCircle2> = { ok: CheckCircle2, error: AlertCircle, warn: AlertTriangle, info: Info };

/** A short message in the corner after an action, so people know it worked. Errors and warnings are announced at once; the others politely. */
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastState | null>(null);
	const notify = useCallback((msg: string, kind: ToastKind = 'ok') => setToast({ msg, kind }), []);

	useEffect(() => {
		if (!toast) return undefined;
		const t = setTimeout(() => setToast(null), 3200);
		return () => clearTimeout(t);
	}, [toast]);

	const Icon = toast ? ICONS[toast.kind] : null;
	const value = useMemo(() => ({ notify }), [notify]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast && Icon && (
				<div className={'toast' + (toast.kind === 'ok' ? '' : ` toast--${toast.kind}`)} role={toast.kind === 'error' || toast.kind === 'warn' ? 'alert' : 'status'}>
					<Icon size={16} aria-hidden="true" />
					{toast.msg}
				</div>
			)}
		</ToastContext.Provider>
	);
}

export const useToast = () => useContext(ToastContext);
