'use strict';

/**
 * Fabrication rules (FSD FAB-1 to FAB-5, WORKFLOWS section 5). Pure, no I/O. Dates are YYYY-MM-DD strings.
 * ASSUMPTIONS (the spec does not list the fields): the spec panels for CCV, CNC and CLB below.
 */
const { addDays } = require('./reminders');

/** Fab_Type values from WORKFLOWS section 5. */
// The Fab Type names of the old Creator form come first; 'CNC' and 'General/Pack' stay valid for tasks made before.
const FAB_KINDS = Object.freeze(['CCV', 'CNC Laser', 'CNC Router', 'CLB', 'General', 'Metal', 'Paint', 'LED', 'Pack', 'Workshop', 'Maintenance', 'CNC', 'General/Pack']);
const MAX_SPEC_CHARS = 4000;

/** Spec fields per type: name -> 'number' or 'text'. CCV is vinyl, CNC is routed work, CLB is channel letters and light boxes. */
const SPEC_FIELDS = Object.freeze({
	CCV: { material: 'text', colour: 'text', width_mm: 'number', height_mm: 'number', quantity: 'number' },
	CNC: { material: 'text', thickness_mm: 'number', width_mm: 'number', height_mm: 'number', quantity: 'number' },
	CLB: { letter_height_mm: 'number', depth_mm: 'number', illumination: 'text', quantity: 'number' },
});

/**
 * Check and clean the spec of a fabrication task. CCV, CNC and CLB accept only their own fields (numbers must be zero or more);
 * other types keep a free-form object of text and numbers. Returns { spec } or { error }.
 */
function normaliseFabSpec(kind, spec) {
	if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) return { error: 'The spec must be an object of fields.' };
	const allowed = SPEC_FIELDS[kind] || (/^CNC/.test(kind || '') ? SPEC_FIELDS.CNC : undefined);
	const out = {};
	for (const [key, value] of Object.entries(spec)) {
		if (value === null || value === '') continue;
		const type = allowed ? allowed[key] : typeof value === 'number' ? 'number' : 'text';
		if (!type) return { error: `${kind} tasks have no spec field "${key}".` };
		if (type === 'number') {
			if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000000) return { error: `Spec field "${key}" must be a number from 0 to 1,000,000.` };
			out[key] = value;
		} else {
			if (typeof value !== 'string' || value.length > 200) return { error: `Spec field "${key}" must be text of 200 characters or fewer.` };
			out[key] = value.trim();
		}
	}
	if (JSON.stringify(out).length > MAX_SPEC_CHARS) return { error: 'The spec is too large.' };
	return { spec: out };
}

// Repeating tasks: Days = count, Weeks x 7, Months x 30 (WORKFLOWS section 10).
const UNIT_DAYS = Object.freeze({ days: 1, weeks: 7, months: 30 });

/** Clean a repeat rule { every, unit } or return null for "does not repeat". Throws a plain message for a bad one. */
function normaliseRepeat(r) {
	if (r === null || r === undefined) return null;
	const every = Number(r.every);
	if (!Number.isInteger(every) || every < 1 || every > 365) throw new Error('Repeat every must be a whole number from 1 to 365.');
	if (!UNIT_DAYS[r.unit]) throw new Error('Choose days, weeks or months.');
	return { every, unit: r.unit };
}

const nextRepeatDate = (date, repeat) => addDays(date, repeat.every * UNIT_DAYS[repeat.unit]);

/** Only workshop tasks repeat, once per task, when completed. */
const shouldRepeat = (task, repeat) => task.kind === 'Workshop' && !!repeat && !repeat.spawned && task.stage === 'Completed';

/** Order for lists (FAB-2): each root parent followed by its subtasks; roots by stage in this custom order, then scheduled date. */
const STAGE_RANK = Object.freeze(['Rejected', 'Reopen', 'In Progress', 'Manager Review', 'Scheduled', 'Awaiting Scheduling', 'On Hold', 'Completed', 'Complete - Not Used', 'Cancelled']);
const rank = (stage) => {
	const i = STAGE_RANK.indexOf(stage);
	return i === -1 ? STAGE_RANK.length : i;
};
const byStageThenDate = (a, b) => rank(a.stage) - rank(b.stage) || String(a.scheduled_date || '9999').localeCompare(String(b.scheduled_date || '9999'));

/** Returns the same tasks, grouped under their root parent, each with `depth` 0 (root) or 1 (subtask). */
function groupAndSort(tasks) {
	const ids = new Set(tasks.map((t) => String(t.ROWID)));
	const children = new Map();
	const roots = [];
	for (const t of tasks) {
		const parent = t.parent_id ? String(t.parent_id) : null;
		if (parent && ids.has(parent)) children.set(parent, [...(children.get(parent) || []), t]);
		else roots.push(t); // a root, or a subtask whose parent is not in this list
	}
	const out = [];
	for (const root of roots.sort(byStageThenDate)) {
		out.push({ ...root, depth: 0 });
		for (const sub of (children.get(String(root.ROWID)) || []).sort(byStageThenDate)) out.push({ ...sub, depth: 1 });
	}
	return out;
}

/** Equipment due for a maintenance task: in service, has a schedule, and its next due date is today or earlier. */
function dueForMaintenance(items, today) {
	return items.filter((e) => {
		if (e.status !== 'In service') return false;
		const plan = e.plan || {};
		if (!plan.frequency_days || plan.create_task === false) return false;
		if (!plan.last_checked) return true; // never checked, but it has a schedule: due now
		return addDays(plan.last_checked, Number(plan.frequency_days)) <= today;
	});
}

const maintenanceName = (e) => `Maintenance: ${e.name} (${e.code})`.slice(0, 200);

module.exports = { FAB_KINDS, SPEC_FIELDS, normaliseFabSpec, normaliseRepeat, nextRepeatDate, shouldRepeat, STAGE_RANK, groupAndSort, dueForMaintenance, maintenanceName };
