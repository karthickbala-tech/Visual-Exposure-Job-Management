import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Dialog } from './Dialog';

/**
 * Message dialogs for the DS "Alert" and "Awaiting Submission" screens, and the replacement for window.confirm.
 * Built on Dialog, so focus, Escape and the dimmed background behave the same as every other popup.
 * One dialog is open at a time: opening a second one cancels the first (its promise resolves false).
 */

export type MessageKind = 'ok' | 'warn' | 'error' | 'info';

export interface ConfirmOptions {
	title?: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** Use the red button for destructive actions such as removing someone. */
	danger?: boolean;
}

export interface MessageOptions {
	kind?: MessageKind;
	title: string;
	message?: string;
	actionLabel?: string;
}

interface Pending {
	kind: 'confirm' | 'message';
	title: string;
	message: string;
	messageKind: MessageKind;
	confirmLabel: string;
	cancelLabel?: string;
	danger: boolean;
	resolve: (value: boolean) => void;
}

interface MessageApi {
	confirm: (opts: ConfirmOptions) => Promise<boolean>;
	message: (opts: MessageOptions) => Promise<void>;
}

// Without a provider (for example in a test), confirm falls back to the browser prompt so nothing is silently skipped.
const MessageContext = createContext<MessageApi>({
	confirm: async (opts) => window.confirm(opts.message),
	message: async () => {},
});

const ICONS: Record<MessageKind, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, error: AlertCircle, info: Info };

export function MessageProvider({ children }: { children: ReactNode }) {
	const [pending, setPending] = useState<Pending | null>(null);
	// The resolver is kept in a ref so opening a second dialog can settle the first one without a state update inside a state update.
	const current = useRef<Pending | null>(null);

	const open = useCallback((next: Pending) => {
		current.current?.resolve(false);
		current.current = next;
		setPending(next);
	}, []);

	const finish = useCallback((value: boolean) => {
		const p = current.current;
		current.current = null;
		setPending(null);
		p?.resolve(value);
	}, []);

	const api = useMemo<MessageApi>(() => ({
		confirm: (opts) => new Promise<boolean>((resolve) => open({
			kind: 'confirm',
			title: opts.title ?? 'Please confirm',
			message: opts.message,
			messageKind: 'warn',
			confirmLabel: opts.confirmLabel ?? 'Continue',
			cancelLabel: opts.cancelLabel ?? 'Cancel',
			danger: opts.danger ?? false,
			resolve,
		})),
		message: (opts) => new Promise<void>((resolve) => open({
			kind: 'message',
			title: opts.title,
			message: opts.message ?? '',
			messageKind: opts.kind ?? 'info',
			confirmLabel: opts.actionLabel ?? 'OK',
			danger: false,
			resolve: () => resolve(),
		})),
	}), [open]);

	const Icon = pending ? ICONS[pending.messageKind] : null;

	return (
		<MessageContext.Provider value={api}>
			{children}
			{pending && Icon && (
				<Dialog title={pending.title} onClose={() => finish(false)}>
					<div className={`msg msg--${pending.messageKind}`}>
						<Icon size={20} aria-hidden="true" />
						<p>{pending.message}</p>
					</div>
					<div className="msg-actions">
						{pending.kind === 'confirm' && (
							<button type="button" className="btn btn-ghost" onClick={() => finish(false)}>{pending.cancelLabel}</button>
						)}
						<button type="button" className={'btn ' + (pending.danger ? 'btn-danger' : 'btn-primary')} onClick={() => finish(true)}>
							{pending.confirmLabel}
						</button>
					</div>
				</Dialog>
			)}
		</MessageContext.Provider>
	);
}

/** Returns a promise that resolves true when the person confirms, false when they cancel or press Escape. */
export const useConfirm = () => useContext(MessageContext).confirm;

/** Shows a message the person must acknowledge. Resolves when they press the button. */
export const useMessage = () => useContext(MessageContext).message;
