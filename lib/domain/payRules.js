'use strict';

/**
 * Pay-hour split for one shift. Pure: no I/O, no clock.
 *
 * Rules (WORKFLOWS.md, "Timesheet pay hours"):
 *  - Mon-Fri, inside 06:00-18:00: first 8 h single, next 2 h x1.5, the rest x2.
 *  - Mon-Fri, outside that window: x2.
 *  - Saturday: first 2 h x1.5, then x2.
 *  - Sunday: x2.
 *  - Breaks come off double time first, then x1.5, then single.
 * Assumption (business rule not stated): a public holiday pays x2 all day.
 *
 * Works in whole minutes so results never carry float drift; hours are rounded to 2 dp at the end.
 */
const WINDOW_START = 6 * 60;
const WINDOW_END = 18 * 60;
const SINGLE_CAP = 8 * 60;
const T_AND_HALF_CAP = 2 * 60;

/** "HH:MM" -> minutes since midnight, or null when malformed. */
function toMinutes(hhmm) {
	const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || ''));
	return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Day of week (0 = Sunday) for a YYYY-MM-DD date, independent of the machine time zone. */
function dayOfWeek(isoDate) {
	const [y, m, d] = String(isoDate).split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const toHours = (minutes) => Math.round((minutes / 60) * 100) / 100;

/**
 * @param {{ date: string, start: string, end: string, breakMinutes?: number, isPublicHoliday?: boolean }} shift
 * @returns {{ single: number, x1_5: number, x2: number, total: number }} hours
 */
function splitPayHours({ date, start, end, breakMinutes = 0, isPublicHoliday = false }) {
	const s = toMinutes(start);
	const e = toMinutes(end);
	if (s === null || e === null) throw new RangeError('Start and end must be HH:MM');
	if (e <= s) throw new RangeError('End must be after start');
	if (!Number.isInteger(breakMinutes) || breakMinutes < 0) throw new RangeError('Break must be whole minutes, 0 or more');
	if (breakMinutes > e - s) throw new RangeError('Break is longer than the shift');

	const dow = dayOfWeek(date);
	let single = 0;
	let tAndHalf = 0;
	let double = 0;

	if (isPublicHoliday || dow === 0) {
		double = e - s;
	} else if (dow === 6) {
		tAndHalf = Math.min(e - s, T_AND_HALF_CAP);
		double = e - s - tAndHalf;
	} else {
		// Minutes inside the 06:00-18:00 window count towards the 8 h / 2 h bands; the rest is double.
		const inside = Math.max(0, Math.min(e, WINDOW_END) - Math.max(s, WINDOW_START));
		single = Math.min(inside, SINGLE_CAP);
		tAndHalf = Math.min(inside - single, T_AND_HALF_CAP);
		double = e - s - single - tAndHalf;
	}

	// Breaks reduce the dearest rate first.
	let left = breakMinutes;
	const takeFromDouble = Math.min(left, double);
	double -= takeFromDouble;
	left -= takeFromDouble;
	const takeFromHalf = Math.min(left, tAndHalf);
	tAndHalf -= takeFromHalf;
	left -= takeFromHalf;
	single -= left;

	return {
		single: toHours(single),
		x1_5: toHours(tAndHalf),
		x2: toHours(double),
		total: toHours(single + tAndHalf + double),
	};
}

module.exports = { splitPayHours, toMinutes, dayOfWeek };
