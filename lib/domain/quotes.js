'use strict';

/**
 * Turning a Zoho CRM quote into a sign group (a priced group of line items on a job). Pure, no I/O.
 * A CRM quote has a "Quoted_Items" list; each item has a product, quantity, list price and totals.
 * The plan also wants cost and margin per line, but the standard Quotes module has no cost field, so they are left out
 * until the client says where cost lives.
 */
const MAX_JSON = 9000; // the column holds 10,000 characters

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const text = (v, max) => String(v === undefined || v === null ? '' : v).slice(0, max);
const nameOf = (v) => (v && typeof v === 'object' ? v.name : v);

/** One CRM quote record -> the fields we keep. Tolerates missing fields. */
function normaliseQuote(q) {
	const items = (Array.isArray(q.Quoted_Items) ? q.Quoted_Items : []).map((i) => ({
		product: text(nameOf(i.Product_Name) || i.Description || 'Item', 200),
		description: text(i.Description, 500),
		qty: num(i.Quantity),
		unitPrice: num(i.List_Price),
		discount: num(i.Discount),
		total: num(i.Net_Total !== undefined ? i.Net_Total : i.Total),
	}));
	return {
		crmQuoteId: String(q.id),
		number: text(q.Quote_Number, 40),
		subject: text(q.Subject, 200),
		stage: text(q.Quote_Stage, 60),
		validTill: q.Valid_Till || null,
		totals: { subTotal: num(q.Sub_Total), discount: num(q.Discount), tax: num(q.Tax), adjustment: num(q.Adjustment), grandTotal: num(q.Grand_Total) },
		items,
	};
}

/** Room kept for the wrapper around the items (discount, stage and so on) inside the 10,000 character column. */
const WRAPPER_ROOM = 400;

/** The items list as JSON that fits the column: long text goes first, then the last items, and the cut is marked. */
function fitItems(items, max = MAX_JSON - WRAPPER_ROOM) {
	let list = items;
	let json = JSON.stringify(list);
	if (json.length <= max) return { items: list, truncated: false };
	list = items.map((i) => ({ ...i, description: '' }));
	json = JSON.stringify(list);
	while (json.length > max && list.length > 0) {
		list = list.slice(0, -1);
		json = JSON.stringify(list);
	}
	return { items: list, truncated: true };
}

/** What marks a sign group as coming from a CRM quote. legacy_id is unique, so a rerun updates instead of duplicating. */
const crmKey = (crmQuoteId) => `crm:${crmQuoteId}`;

/**
 * The sign_group row for a quote on a job. The table has number columns for sub_total, tax and grand_total;
 * everything else (items, discount, adjustment, stage) lives in line_items as one JSON object.
 */
function toSignGroupRow(jobId, quote) {
	const { items, truncated } = fitItems(quote.items);
	const label = [quote.number && `#${quote.number}`, quote.subject].filter(Boolean).join(' ') || 'CRM quote';
	return {
		job_id: jobId,
		name: label.slice(0, 200),
		description: text(`CRM quote ${quote.number || quote.crmQuoteId}${quote.stage ? ` (${quote.stage})` : ''}${quote.validTill ? `, valid until ${quote.validTill}` : ''}`, 500),
		line_items: JSON.stringify({ items, discount: quote.totals.discount, adjustment: quote.totals.adjustment, stage: quote.stage, validTill: quote.validTill, truncated }),
		sub_total: quote.totals.subTotal,
		tax: quote.totals.tax,
		grand_total: quote.totals.grandTotal,
		legacy_id: crmKey(quote.crmQuoteId),
	};
}

/** Did the CRM change since we last saved this group? Numbers come back from the database as text, so compare as numbers. */
function sameAsStored(row, next) {
	return (
		row.name === next.name &&
		row.description === next.description &&
		row.line_items === next.line_items &&
		Number(row.sub_total) === Number(next.sub_total) &&
		Number(row.tax) === Number(next.tax) &&
		Number(row.grand_total) === Number(next.grand_total)
	);
}

module.exports = { normaliseQuote, fitItems, toSignGroupRow, sameAsStored, crmKey, MAX_JSON };
