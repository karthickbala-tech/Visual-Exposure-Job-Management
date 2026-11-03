'use strict';

const { randomUUID } = require('node:crypto');
const { AppError, notFound, badRequest } = require('../errors');
const { withBooleans } = require('../db');
const { z, parse, schemas } = require('../validate');
const { ENTITY_TYPES, checkUpload, storageKey } = require('../domain/files');
const { requireGrant, taskAccess } = require('./access');

const rowId = schemas.rowId;
const uploadInput = z.object({
	entity_type: z.enum(ENTITY_TYPES),
	entity_id: rowId,
	file_name: z.string().trim().min(1).max(200),
	mime_type: z.string().trim().min(1).max(100),
	size_bytes: z.number().int(),
});
const listQuery = z.object({ entity_type: z.enum(ENTITY_TYPES), entity_id: rowId });

const actorId = (ctx) => (ctx.actor.person ? String(ctx.actor.person.ROWID) : null);
const present = (row) => {
	const r = withBooleans(row, ['is_deleted', 'is_uploaded']);
	return {
		id: String(r.ROWID),
		entityType: r.entity_type,
		entityId: String(r.entity_id),
		kind: r.file_kind,
		name: r.file_name,
		mimeType: r.mime_type,
		sizeBytes: Number(r.size_bytes),
		uploadedBy: r.uploaded_by ? String(r.uploaded_by) : null,
		uploaded: r.is_uploaded === true,
	};
};

/**
 * Who may attach to / see files of an entity. Files follow the entity's own access:
 * a task (assigned crew or managers), a checklist (its owner to add, task viewers to see),
 * an issue (its reporter or managers).
 */
async function checkEntityAccess(ctx, type, id, verb) {
	if (type === 'task' || type === 'checklist') {
		let task;
		if (type === 'task') {
			task = await ctx.repos.tasks.findById(id);
		} else {
			const checklist = await ctx.repos.checklists.findById(id);
			if (!checklist) throw notFound('Not found');
			if (verb === 'add' && String(checklist.assignee_id) !== actorId(ctx)) throw notFound('Not found');
			task = await ctx.repos.tasks.findById(checklist.task_id);
		}
		if (!task) throw notFound('Not found');
		await taskAccess(ctx, task, verb === 'add' ? 'edit' : 'view');
		return;
	}
	// Attaching a file is a write: it needs the create permission (reporters keep it for their own
	// issues); only looking at files needs view. A read-only role must not be able to add files.
	const grant = requireGrant(ctx.actor, 'issues', verb === 'add' ? 'create' : 'view');
	const issue = await ctx.repos.issues.findById(id);
	const own = grant.scope === 'own' || grant.scope === 'assigned';
	if (!issue || (own && String(issue.reported_by_id) !== actorId(ctx))) throw notFound('Not found');
}

/** Step 1: check the file, record it, and hand back a short-lived link the browser uploads to. */
async function requestUpload(ctx, raw) {
	const input = parse(uploadInput, raw);
	const check = checkUpload({ mimeType: input.mime_type, sizeBytes: input.size_bytes });
	if (!check.ok) throw badRequest(check.reason);
	await checkEntityAccess(ctx, input.entity_type, input.entity_id, 'add');

	const key = storageKey(input.entity_type, input.entity_id, randomUUID().slice(0, 8), input.file_name);
	const row = await ctx.repos.files.insert({
		entity_type: input.entity_type,
		entity_id: input.entity_id,
		file_kind: check.kind,
		storage_key: key,
		file_name: input.file_name.slice(0, 255),
		mime_type: input.mime_type.toLowerCase(),
		size_bytes: input.size_bytes,
		uploaded_by: actorId(ctx) || undefined,
		is_uploaded: 'false',
	});
	const uploadUrl = await ctx.storage.signedPut(key, 300);
	return { file: present(row), uploadUrl, headers: { 'content-type': input.mime_type.toLowerCase() } };
}

async function loadFile(ctx, id) {
	parse(rowId, id);
	const row = await ctx.repos.files.findById(id);
	if (!row) throw notFound('File not found');
	return row;
}

/** Step 2: the browser says the upload finished. Only the person who started it can confirm. */
async function confirmUpload(ctx, id) {
	const row = await loadFile(ctx, id);
	if (String(row.uploaded_by) !== actorId(ctx)) throw notFound('File not found');
	if (withBooleans(row, ['is_uploaded']).is_uploaded !== true) {
		await ctx.repos.files.update({ ROWID: row.ROWID, is_uploaded: 'true' });
		await ctx.publish('file.uploaded', { fileId: String(row.ROWID), entityType: row.entity_type, entityId: String(row.entity_id) });
	}
	return { file: present({ ...row, is_uploaded: 'true' }) };
}

/** Files on one entity (finished uploads only), newest first. */
async function listFiles(ctx, rawQuery) {
	const q = parse(listQuery, rawQuery);
	await checkEntityAccess(ctx, q.entity_type, q.entity_id, 'view');
	const rows = await ctx.repos.files.listForEntity(q.entity_type, q.entity_id);
	return { items: rows.map(present).filter((f) => f.uploaded) };
}

/** A short-lived download link, only after the same access check as the entity itself. */
async function downloadUrl(ctx, id) {
	const row = await loadFile(ctx, id);
	if (withBooleans(row, ['is_uploaded']).is_uploaded !== true) throw new AppError(409, 'not_uploaded', 'This file has not finished uploading');
	await checkEntityAccess(ctx, row.entity_type, row.entity_id, 'view');
	return { url: await ctx.storage.signedGet(row.storage_key, 300), name: row.file_name };
}

module.exports = { requestUpload, confirmUpload, listFiles, downloadUrl };
