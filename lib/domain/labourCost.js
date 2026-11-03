'use strict';

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Labour cost = hours worked x the person's hourly rate (FSD TSK-4).
 * Overtime multipliers are NOT applied to cost: they change what is paid in the timesheet,
 * while variance uses `effectiveHours` below. Revisit if finance wants loaded cost.
 */
function labourCost(hours, hourlyRate) {
	const h = Number(hours);
	const r = Number(hourlyRate);
	if (!Number.isFinite(h) || !Number.isFinite(r) || h < 0 || r < 0) return 0;
	return round2(h * r);
}

/** Hours weighted by pay multiplier; used for fabrication variance (quoted minus effective). */
function effectiveHours({ single = 0, x1_5 = 0, x2 = 0 }) {
	return round2(single + 1.5 * x1_5 + 2 * x2);
}

function variance(quotedHours, pay) {
	return round2(Number(quotedHours || 0) - effectiveHours(pay));
}

module.exports = { labourCost, effectiveHours, variance };
