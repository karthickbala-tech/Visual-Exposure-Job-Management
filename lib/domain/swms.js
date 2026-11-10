'use strict';

/**
 * SWMS (safe work method statement) rules. Pure, no I/O.
 * Source: WORKFLOWS section 8 and FSD SW-1..SW-4, INS-1, INS-4.
 */
const STATUS = Object.freeze({
	CREATED: 'Created',
	PM_SIGNED: 'PM Signed',
	TL_SIGNED: 'TL Signed',
	NOT_REQUIRED: 'Not Required',
});

/** Install types that do not get their own SWMS (subtasks follow the parent; external work has none). */
const NO_OWN_SWMS_KINDS = Object.freeze(['VE Subtask', 'Minor Task', 'External Install', 'Print Only']);

const PM_SIGNERS = Object.freeze(['admin', 'project_manager', 'install_coordinator']);

/** Does this task get a SWMS created with it? */
const needsSwms = (taskType, kind) => taskType === 'install' && !NO_OWN_SWMS_KINDS.includes(kind);

/**
 * Can `who` ('pm' or 'tl') sign a SWMS in `status`?
 * Returns { ok: true, to } or { ok: false, code, reason }.
 */
function checkSign(status, who, { roles = [], isLead = false } = {}) {
	if (who === 'pm') {
		if (!roles.some((r) => PM_SIGNERS.includes(r))) return { ok: false, code: 'not_allowed', reason: 'Only a project manager can sign as work manager' };
		if (status !== STATUS.CREATED) return { ok: false, code: 'invalid_state', reason: `Already ${status}` };
		return { ok: true, to: STATUS.PM_SIGNED };
	}
	if (who === 'tl') {
		if (!isLead) return { ok: false, code: 'not_allowed', reason: 'Only the team leader on this task can sign as team leader' };
		if (status !== STATUS.PM_SIGNED) {
			return { ok: false, code: 'invalid_state', reason: status === STATUS.CREATED ? 'The project manager must sign first' : `Already ${status}` };
		}
		return { ok: true, to: STATUS.TL_SIGNED };
	}
	return { ok: false, code: 'invalid_state', reason: 'Unknown signer' };
}


/**
 * High-risk work categories a SWMS can flag (the standard WHS list of high-risk construction work, plus hot works, lifting and dust).
 * ASSUMPTION: the client has not confirmed the wording; it is a list here so it can change without touching the screens.
 */
const HAZARDS = Object.freeze([
	{ key: 'falls', label: 'Risk of a person falling more than 2m' },
	{ key: 'telecom_tower', label: 'Work near telecommunication towers' },
	{ key: 'demolition', label: 'Work involving demolition' },
	{ key: 'asbestos', label: 'Work involves removal or likely disturbance of asbestos' },
	{ key: 'temporary_support', label: 'There are structural alterations that require temporary support to prevent collapse' },
	{ key: 'confined_space', label: 'Work involves a confined space' },
	{ key: 'excavation', label: 'Excavation deeper than 1.5 metres' },
	{ key: 'trench_tunnel', label: 'Shaft, trench deeper than 1.5 metres, or tunnel' },
	{ key: 'explosives', label: 'Use of explosives' },
	{ key: 'gas_mains', label: 'Work is on or near pressurised gas distribution mains or piping' },
	{ key: 'chemical_lines', label: 'Work is on or near chemical, fuel or refrigerant lines' },
	{ key: 'electrical', label: 'Work is on or near energised electrical installations or services (power lines)' },
	{ key: 'extreme_temperature', label: 'Work is in an area where there are artificial extremes of temperature' },
	{ key: 'water', label: 'Work is in, over or adjacent to water or other liquids where there is a risk of drowning' },
	{ key: 'roads_rail', label: 'Work is on or adjacent to roadways or railways used by road or rail traffic' },
	{ key: 'mobile_plant', label: 'There is movement of powered mobile plant (EWP, cranes, excavators, etc.)' },
	{ key: 'tilt_precast', label: 'Work involves tilt-up or precast concrete' },
	{ key: 'hot_works', label: 'Hot works' },
	{ key: 'lifting', label: 'Crane or lifting operations' },
	{ key: 'dust', label: 'Dust producing activities' },
	{ key: 'hazardous_substances', label: 'Use, storage and disposal of hazardous substances and dangerous goods' },
	{ key: 'flammable_atmosphere', label: 'Work is in an area that may have a contaminated or flammable atmosphere' },
	{ key: 'public_access', label: 'Work near the public or an occupied area' },
]);
const HAZARD_KEYS = HAZARDS.map((h) => h.key);

/** Protective equipment (PPE) a SWMS can list. */
const PPE_ITEMS = Object.freeze(['Hard hat', 'Hi-vis vest', 'Safety boots', 'Safety glasses', 'Gloves', 'Hearing protection', 'Dust mask or respirator', 'Harness and fall arrest', 'Sun protection', 'Welding mask or face shield', 'Long sleeves and pants', 'Breathing apparatus', 'Full face shield']);

/** Ticking a hazard ticks the PPE it normally needs. Only ever adds: unticking a hazard never removes PPE. */
const PPE_FOR = Object.freeze({
	falls: ['Harness and fall arrest', 'Hard hat', 'Safety boots'],
	telecom_tower: ['Harness and fall arrest', 'Hard hat'],
	demolition: ['Hard hat', 'Dust mask or respirator', 'Safety glasses', 'Hearing protection'],
	asbestos: ['Dust mask or respirator', 'Gloves', 'Long sleeves and pants'],
	confined_space: ['Hard hat', 'Dust mask or respirator'],
	electrical: ['Gloves', 'Safety glasses'],
	roads_rail: ['Hi-vis vest', 'Hard hat', 'Safety boots'],
	mobile_plant: ['Hi-vis vest', 'Hard hat', 'Safety boots'],
	hot_works: ['Welding mask or face shield', 'Gloves', 'Long sleeves and pants', 'Safety glasses'],
	lifting: ['Hard hat', 'Gloves', 'Safety boots'],
	dust: ['Dust mask or respirator', 'Safety glasses'],
});
const autoPpe = (hazards = []) => [...new Set(hazards.flatMap((h) => PPE_FOR[h] || []))];

/** PPE ticks are only ever added (never removed) by edits and by automatic rules. */
const mergePpe = (existing = [], incoming = []) => [...new Set([...existing, ...incoming])];

/** INS-4: the team leader cannot finish the pre-job checklist until the SWMS is signed (or not needed). */
const allowsPreJobChecklist = (status) => status === STATUS.TL_SIGNED || status === STATUS.NOT_REQUIRED;

module.exports = { STATUS, NO_OWN_SWMS_KINDS, PM_SIGNERS, needsSwms, checkSign, mergePpe, allowsPreJobChecklist, HAZARDS, HAZARD_KEYS, PPE_ITEMS, PPE_FOR, autoPpe };
