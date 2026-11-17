/**
 * Pay-hour split for one shift, for the live preview on the Add shift form.
 * A copy of `splitPayHours` in lib/domain/payRules.js: the server works the split out again when it saves the shift,
 * so this copy only shows the person what will be saved. Keep the two in step if the pay rules change.
 *
 *  - Mon-Fri, inside 06:00-18:00: first 8 h single, next 2 h x1.5, the rest x2.
 *  - Mon-Fri, outside that window: x2.
 *  - Saturday: first 2 h x1.5, then x2.
 *  - Sunday: x2.
 *  - Breaks come off double time first, then x1.5, then single.
 */
export interface PaySplit {
	single: number;
	x1_5: number;
	x2: number;
	total: number;
}

const WINDOW_START = 6 * 60;
const WINDOW_END = 18 * 60;
const SINGLE_CAP = 8 * 60;
const T_AND_HALF_CAP = 2 * 60;

const toMinutes = (hhmm: string): number | null => {
	const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const dayOfWeek = (isoDate: string) => {
	const [y, m, d] = isoDate.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const toHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** The split, or a message saying why the times cannot be split (the same rules the server applies). */
export function splitPayHours(date: string, start: string, end: string, breakMinutes = 0): PaySplit | { error: string } {
	const s = toMinutes(start);
	const e = toMinutes(end);
	if (s === null || e === null) return { error: 'Give both the start and the end time.' };
	if (e <= s) return { error: 'The end time must be after the start time.' };
	if (!Number.isInteger(breakMinutes) || breakMinutes < 0) return { error: 'The break must be whole minutes, 0 or more.' };
	if (breakMinutes > e - s) return { error: 'The break is longer than the shift.' };

	const dow = dayOfWeek(date);
	let single = 0;
	let tAndHalf = 0;
	let double = 0;
	if (dow === 0) {
		double = e - s;
	} else if (dow === 6) {
		tAndHalf = Math.min(e - s, T_AND_HALF_CAP);
		double = e - s - tAndHalf;
	} else {
		const inside = Math.max(0, Math.min(e, WINDOW_END) - Math.max(s, WINDOW_START));
		single = Math.min(inside, SINGLE_CAP);
		tAndHalf = Math.min(inside - single, T_AND_HALF_CAP);
		double = e - s - single - tAndHalf;
	}

	let left = breakMinutes;
	const fromDouble = Math.min(left, double);
	double -= fromDouble;
	left -= fromDouble;
	const fromHalf = Math.min(left, tAndHalf);
	tAndHalf -= fromHalf;
	left -= fromHalf;
	single -= left;

	return { single: toHours(single), x1_5: toHours(tAndHalf), x2: toHours(double), total: toHours(single + tAndHalf + double) };
}
