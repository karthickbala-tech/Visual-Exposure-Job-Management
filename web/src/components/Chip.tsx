import './Chip.css';

/** Status chip. The label is always shown; colour never carries meaning alone. */
export function Chip({ status }: { status: string }) {
	return (
		<span className="chip" data-status={status}>
			{status}
		</span>
	);
}

/** Thin progress bar with a text value for screen readers and colour-blind users. */
export function Progress({ label, value }: { label: string; value: number }) {
	const v = Math.max(0, Math.min(100, Math.round(value)));
	return (
		<div className="progress" role="img" aria-label={`${label} ${v} percent`}>
			<span className="progress__label">{label}</span>
			<span className="progress__track">
				<span className="progress__fill" style={{ width: `${v}%` }} />
			</span>
			<span className="progress__value num">{v}%</span>
		</div>
	);
}
