/**
 * How long a ticket, induction or document normally lasts, by type name (from the colleague's demo; the client can change these).
 * Used by the "Set expiry N years after issue" button. A name that is not listed has no suggestion.
 */
const YEARS: [RegExp, number][] = [
	[/working at heights/i, 2],
	[/\bewp\b|elevated work/i, 5],
	[/first aid/i, 3],
	[/dogging/i, 5],
	[/insurance|workcover/i, 1],
	[/subcontractor agreement/i, 3],
];

export const validityYears = (typeName: string | null | undefined): number | null => {
	const hit = YEARS.find(([re]) => re.test(typeName ?? ''));
	return hit ? hit[1] : null;
};

/** The date `years` years after an ISO date (YYYY-MM-DD), staying on the same day where it exists. */
export function addYears(iso: string, years: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const dt = new Date(Date.UTC(y + years, m - 1, d));
	if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0); // 29 Feb in a year without one
	return dt.toISOString().slice(0, 10);
}
