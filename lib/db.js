'use strict';

const { ZCQL_MAX_ROWS, SOFT_DELETE_TABLES } = require('./config');
const { AppError } = require('./errors');

/** SQL fragment for "not soft-deleted". Inserts always write is_deleted = 'false'. */
const NOT_DELETED = "is_deleted = 'false'";

/** Escape a value for use inside a single-quoted ZCQL string. */
function esc(value) {
	return String(value).replace(/\\/g, '\\\\').replace(/'/g, "''");
}

/** Catalyst `text` columns hold at most 10,000 characters; `varchar` at most 255. */
const TEXT_MAX = 10000;

/**
 * Reject rows whose string values could not be stored. Fails loudly instead of
 * letting Catalyst truncate or reject with an unclear message. JSON columns are
 * the usual cause: split large documents or keep them in Stratus.
 */
function assertFits(rows, table) {
	for (const row of rows) {
		for (const [col, val] of Object.entries(row)) {
			if (typeof val === 'string' && val.length > TEXT_MAX) {
				throw new AppError(
					413,
					'value_too_large',
					`${table}.${col} is ${val.length} characters; the limit is ${TEXT_MAX}`
				);
			}
		}
	}
}

/** Only allow plain identifiers (table and column names) into SQL text. */
function ident(name) {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name))) {
		throw new Error(`Invalid identifier: ${name}`);
	}
	return name;
}

/** Catalyst returns booleans as the strings "true" / "false". */
function toBool(value) {
	return value === true || value === 'true';
}

/** Convert the listed boolean columns of a row, in place of a copy. */
function withBooleans(row, columns = []) {
	const copy = { ...row };
	for (const col of columns) {
		if (col in copy) copy[col] = toBool(copy[col]);
	}
	return copy;
}

/** ZCQL wraps each row as { tableName: { ...columns } }. Unwrap to plain rows. */
function unwrap(rows, table) {
	return (rows || []).map((r) => r[table]).filter(Boolean);
}

/** Build a safe `IN ('1','2')` list. Returns null for an empty list. */
function inList(values) {
	const list = [...new Set((values || []).map((v) => String(v)))];
	if (list.length === 0) return null;
	return `(${list.map((v) => `'${esc(v)}'`).join(', ')})`;
}

/**
 * Small data-access helper bound to one Catalyst app (use an admin-scope app:
 * tables are closed to browser roles by design).
 */
function createDb(app) {
	const zcql = () => app.zcql();

	async function run(sql) {
		return zcql().executeZCQLQuery(sql);
	}

	/**
	 * SELECT * FROM table [WHERE ...] [ORDER BY ...] with a hard row cap.
	 * `where` must be built with esc()/inList(); never concatenate user input.
	 */
	async function select(table, { where, orderBy, limit = 50, offset = 0 } = {}) {
		const t = ident(table);
		const count = Math.min(Math.max(Number(limit) || 50, 1), ZCQL_MAX_ROWS);
		const start = Math.max(Number(offset) || 0, 0);
		let sql = `SELECT * FROM ${t}`;
		if (where) sql += ` WHERE ${where}`;
		if (orderBy) sql += ` ORDER BY ${orderBy}`;
		sql += ` LIMIT ${start}, ${count}`;
		return unwrap(await run(sql), t);
	}

	async function selectOne(table, where) {
		const rows = await select(table, { where, limit: 1 });
		return rows[0] || null;
	}

	async function insert(table, rows) {
		const list = (Array.isArray(rows) ? rows : [rows]).map((r) =>
			SOFT_DELETE_TABLES.includes(table) && r.is_deleted === undefined
				? { ...r, is_deleted: 'false' }
				: r
		);
		assertFits(list, table);
		return app.datastore().table(ident(table)).insertRows(list);
	}

	async function update(table, rows) {
		const list = Array.isArray(rows) ? rows : [rows];
		assertFits(list, table);
		return app.datastore().table(ident(table)).updateRows(list);
	}

	async function remove(table, ids) {
		const list = (ids || []).map(String);
		if (list.length === 0) return [];
		return app.datastore().table(ident(table)).deleteRows(list);
	}

	return { run, select, selectOne, insert, update, remove };
}

module.exports = { TEXT_MAX, assertFits, NOT_DELETED, esc, ident, toBool, withBooleans, unwrap, inList, createDb };
