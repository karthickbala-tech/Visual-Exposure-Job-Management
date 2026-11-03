'use strict';

/**
 * First compliance types. PLACEHOLDER LIST: replace with the real ticket, induction and document
 * types from the Creator export. Offsets are days before expiry.
 */
const TYPES = [
	{ compliance_kind: 'ticket', name: 'White Card (construction induction)', requires_expiry: false, is_mandatory_type: true, reminder_offsets: [] },
	{ compliance_kind: 'ticket', name: 'Working at Heights', requires_expiry: true, is_mandatory_type: true, reminder_offsets: [60, 30, 14, 0] },
	{ compliance_kind: 'ticket', name: 'Elevated Work Platform (EWP) licence', requires_expiry: true, is_mandatory_type: false, reminder_offsets: [60, 30, 14, 0] },
	{ compliance_kind: 'ticket', name: 'Driver licence', requires_expiry: true, is_mandatory_type: false, reminder_offsets: [30, 14, 7, 0] },
	{ compliance_kind: 'induction', name: 'Company safety induction', requires_expiry: true, is_mandatory_type: true, reminder_offsets: [30, 14, 7, 0] },
	{ compliance_kind: 'document', name: 'Public liability insurance', requires_expiry: true, is_mandatory_type: true, reminder_offsets: [60, 30, 14, 0] },
];

module.exports = { TYPES };
