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

/** PPE ticks are only ever added (never removed) by edits and by automatic rules. */
const mergePpe = (existing = [], incoming = []) => [...new Set([...existing, ...incoming])];

/** INS-4: the team leader cannot finish the pre-job checklist until the SWMS is signed (or not needed). */
const allowsPreJobChecklist = (status) => status === STATUS.TL_SIGNED || status === STATUS.NOT_REQUIRED;

module.exports = { STATUS, NO_OWN_SWMS_KINDS, PM_SIGNERS, needsSwms, checkSign, mergePpe, allowsPreJobChecklist };
