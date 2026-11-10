import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

export type NoticeKind = 'ok' | 'info' | 'warn' | 'error';

const ICONS: Record<NoticeKind, typeof Info> = { ok: CheckCircle2, info: Info, warn: AlertTriangle, error: AlertCircle };

/**
 * A message that stays on the page, such as a failed save or a rule the person must read before continuing.
 * Errors are announced at once (role alert); the others politely (role status). Use toasts for short confirmations.
 */
export function Notice({ kind = 'info', title, children }: { kind?: NoticeKind; title?: string; children: ReactNode }) {
	const Icon = ICONS[kind];
	return (
		<div className={`notice notice--${kind}`} role={kind === 'error' || kind === 'warn' ? 'alert' : 'status'}>
			<Icon size={18} aria-hidden="true" />
			<div className="notice__body">
				{title && <strong className="notice__title">{title}</strong>}
				<div>{children}</div>
			</div>
		</div>
	);
}
