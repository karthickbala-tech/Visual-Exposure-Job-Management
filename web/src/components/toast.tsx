import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface ToastState {
	msg: string;
	kind: 'ok' | 'error';
}

const ToastContext = createContext<{ notify: (msg: string, kind?: 'ok' | 'error') => void }>({ notify: () => {} });

/** A short message in the corner after an action, so people know it worked. Announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastState | null>(null);
	const notify = useCallback((msg: string, kind: 'ok' | 'error' = 'ok') => setToast({ msg, kind }), []);

	useEffect(() => {
		if (!toast) return undefined;
		const t = setTimeout(() => setToast(null), 3200);
		return () => clearTimeout(t);
	}, [toast]);

	const value = useMemo(() => ({ notify }), [notify]);
	return (
		<ToastContext.Provider value={value}>
			{children}
			{toast && (
				<div className={'toast' + (toast.kind === 'error' ? ' toast--error' : '')} role="status">
					{toast.kind === 'error' ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
					{toast.msg}
				</div>
			)}
		</ToastContext.Provider>
	);
}

export const useToast = () => useContext(ToastContext);
