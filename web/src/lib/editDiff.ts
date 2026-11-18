/**
 * Edits send only what changed, with the values the form first showed (`expected`). The server refuses the save (409)
 * when someone else changed one of those same fields since; fields this form did not change are left as they are.
 * The comparison matches the server's (lib/domain/concurrency.js): '' and null are equal, 5 equals '5.00', and a date
 * equals the same date with a time.
 */
const blank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

export function sameValue(a: unknown, b: unknown): boolean {
	if (blank(a) && blank(b)) return true;
	if (blank(a) || blank(b)) return false;
	if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
	const x = String(a).trim();
	const y = String(b).trim();
	if (x === y) return true;
	if (!Number.isNaN(Number(x)) && !Number.isNaN(Number(y))) return Number(x) === Number(y);
	const date = /^\d{4}-\d{2}-\d{2}/;
	if (date.test(x) && date.test(y) && (x.length === 10 || y.length === 10)) return x.slice(0, 10) === y.slice(0, 10);
	return false;
}

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * The part of `body` that differs from `original`, plus `expected` (the original values of those fields). A plain-object
 * field (a task's spec) is compared key by key: `original[k]` is that object as first shown. Keys in `always` are sent
 * as they are and never compared (for example a list the server keeps elsewhere). Returns null when nothing changed.
 */
export function editDiff(original: Record<string, unknown>, body: Record<string, unknown>, always: string[] = []): Record<string, unknown> | null {
	const out: Record<string, unknown> = {};
	const expected: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(body)) {
		if (always.includes(k)) {
			out[k] = v;
			continue;
		}
		if (isPlain(v)) {
			const was = isPlain(original[k]) ? original[k] : {};
			const changed = Object.keys(v).filter((sub) => !sameValue(was[sub], v[sub]));
			if (changed.length) {
				out[k] = Object.fromEntries(changed.map((sub) => [sub, v[sub]]));
				expected[k] = Object.fromEntries(changed.map((sub) => [sub, was[sub] ?? null]));
			}
		} else if (!sameValue(original[k], v)) {
			out[k] = v;
			expected[k] = original[k] ?? null;
		}
	}
	if (Object.keys(out).length === 0) return null;
	if (Object.keys(expected).length) out.expected = expected;
	return out;
}

/** The snapshot a form compares against, moved on after its own save went through (so a second save is not refused). */
export function afterSave(seen: Record<string, unknown>, sent: Record<string, unknown>): Record<string, unknown> {
	const next = { ...seen };
	for (const [k, v] of Object.entries(sent)) {
		if (k === 'expected') continue;
		next[k] = isPlain(v) ? { ...(isPlain(seen[k]) ? seen[k] : {}), ...v } : v;
	}
	return next;
}
