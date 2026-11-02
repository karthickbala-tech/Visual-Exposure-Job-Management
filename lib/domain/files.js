'use strict';

/**
 * File upload rules. Pure, no I/O.
 * Assumptions (limits not stated in the FSD): photos up to 15 MB, PDFs up to 25 MB,
 * only the types below. Files are checked on the server before a signed link is issued.
 */
const MB = 1024 * 1024;

const TYPES = Object.freeze({
	'image/jpeg': { kind: 'photo', maxBytes: 15 * MB },
	'image/png': { kind: 'photo', maxBytes: 15 * MB },
	'image/webp': { kind: 'photo', maxBytes: 15 * MB },
	'image/heic': { kind: 'photo', maxBytes: 15 * MB },
	'application/pdf': { kind: 'document', maxBytes: 25 * MB },
});

const ENTITY_TYPES = Object.freeze(['task', 'checklist', 'issue']);

/** Check a file the user wants to upload. Returns { ok: true, kind } or { ok: false, reason }. */
function checkUpload({ mimeType, sizeBytes }) {
	const rule = TYPES[String(mimeType || '').toLowerCase()];
	if (!rule) return { ok: false, reason: 'This file type is not allowed. Use JPEG, PNG, WebP, HEIC or PDF' };
	if (!Number.isInteger(sizeBytes) || sizeBytes <= 0) return { ok: false, reason: 'The file is empty' };
	if (sizeBytes > rule.maxBytes) return { ok: false, reason: `The file is too large (limit ${Math.round(rule.maxBytes / MB)} MB)` };
	return { ok: true, kind: rule.kind };
}

/** A file name that is safe inside a storage key: no folders, no odd characters, bounded length. */
function safeName(name) {
	const base = String(name || 'file').split(/[\\/]/).pop();
	const cleaned = base.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '_').replace(/^\.+/, '');
	return (cleaned || 'file').slice(-80);
}

/** The storage key for one file: grouped by entity, unique per upload, never guessable from the name alone. */
const storageKey = (entityType, entityId, uniqueId, fileName) => `${entityType}/${entityId}/${uniqueId}-${safeName(fileName)}`;

module.exports = { TYPES, ENTITY_TYPES, checkUpload, safeName, storageKey };
