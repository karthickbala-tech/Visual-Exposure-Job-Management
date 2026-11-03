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

/** A JSON string no longer than the column allows: long text goes first, then the last items, and the cut is marked. */
function fitItems(items, max = MAX_JSON) {
	let list = items;
	let json = JSON.stringify(list);
	if (json.length <= max) return { json, truncated: false };
	list = items.map((i) => ({ ...i, description: '' }));
	json = JSON.stringify(list);
	while (json.length > max && list.length > 0) {
		list = list.slice(0, -1);
		json = JSON.stringify(list);
	}
	return { json, truncated: true };
}

/** The sign_group row for a quote on a job. The CRM quote id is kept inside `totals`, so a rerun updates, not duplicates. */
function toSignGroupRow(jobId, quote) {
	const { json, truncated } = fitItems(quote.items);
	const label = [quote.number && `#${quote.number}`, quote.subject].filter(Boolean).join(' ') || 'CRM quote';
	return {
		job_id: jobId,
		name: label.slice(0, 200),
		description: text(`CRM quote ${quote.number || quote.crmQuoteId}${quote.stage ? ` (${quote.stage})` : ''}${quote.validTill ? `, valid until ${quote.validTill}` : ''}`, 500),
		line_items: json,
		totals: JSON.stringify({ ...quote.totals, crm_quote_id: quote.crmQuoteId, stage: quote.stage, truncated }),
	};
}

/** Did the CRM change since we last saved this group? Compares only what we store. */
function sameAsStored(row, next) {
	return row.name === next.name && row.description === next.description && row.line_items === next.line_items && row.totals === next.totals;
}

module.exports = { normaliseQuote, fitItems, toSignGroupRow, sameAsStored, MAX_JSON };
