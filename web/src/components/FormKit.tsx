import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from './ui';

/**
 * The one form layout for every "add" screen: a title, grouped fields in a grid, and Submit and Reset under them.
 * Required fields are starred, read-only fields look different from editable ones, and the buttons stay in view on long forms.
 */
export function FormPage({ eyebrow, title, subtitle, backTo, backLabel, onSubmit, onReset, submitLabel = 'Submit', busy = false, canSubmit = true, error, children }: {
	eyebrow?: string;
	title: string;
	subtitle?: string;
	backTo: string;
	backLabel: string;
	onSubmit: () => void;
	onReset: () => void;
	submitLabel?: string;
	busy?: boolean;
	canSubmit?: boolean;
	error?: string | null;
	children: ReactNode;
}) {
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (canSubmit && !busy) onSubmit();
	};
	return (
		<>
			<Link className="back-link" to={backTo}><ArrowLeft size={16} aria-hidden="true" /> {backLabel}</Link>
			<PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />
			<form className="form-page" onSubmit={submit} onReset={(e) => { e.preventDefault(); onReset(); }} noValidate={false}>
				{children}
				{error && <p role="alert" className="form-page__error">{error}</p>}
				<div className="form-actions">
					<button type="submit" className="btn" disabled={busy || !canSubmit}>{busy ? 'Saving…' : submitLabel}</button>
					<button type="reset" className="btn btn-ghost" disabled={busy}>Reset</button>
				</div>
			</form>
		</>
	);
}

/** A titled group of fields (two columns on a wide screen, one on a phone). */
export function FormSection({ title, children }: { title?: string; children: ReactNode }) {
	return (
		<fieldset className="form-section">
			{title && <legend>{title}</legend>}
			<div className="form-fields">{children}</div>
		</fieldset>
	);
}

/** One labelled field. `wide` spans both columns. Pass the input as children; use `htmlFor` to tie the label to it. */
export function Field({ label, required = false, hint, wide = false, htmlFor, children }: { label: string; required?: boolean; hint?: string; wide?: boolean; htmlFor?: string; children: ReactNode }) {
	return (
		<div className={'form-field' + (wide ? ' form-field--wide' : '')}>
			<label htmlFor={htmlFor}>{label}{required && <span className="form-field__req" aria-hidden="true"> *</span>}</label>
			{children}
			{hint && <small className="form-field__hint">{hint}</small>}
		</div>
	);
}

/** A value the system fills in, shown the way the old forms did: greyed, never typed into. */
export function ReadOnlyField({ label, value, hint, wide = false }: { label: string; value: ReactNode; hint?: string; wide?: boolean }) {
	return (
		<div className={'form-field' + (wide ? ' form-field--wide' : '')}>
			<span className="form-field__label">{label}</span>
			<div className="form-field__static">{value === '' || value === null || value === undefined ? '-' : value}</div>
			{hint && <small className="form-field__hint">{hint}</small>}
		</div>
	);
}
