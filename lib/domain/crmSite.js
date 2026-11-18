'use strict';

/**
 * Site contact details read from the CRM site record (DS: "take the site contact from the zoho site").
 *
 * THE ONE SETTING TO FILL IN when the client sends the CRM field names: which CRM field holds each of our site contact
 * fields. Keys are our input names (the same ones the Sites form sends); values are the CRM field API names, for example
 * { contact_name: 'Site_Contact', phone: 'Site_Phone' }. While it is empty, nothing is read from the CRM.
 */
const CRM_SITE_MODULE = 'Sites';
const SITE_CONTACT_FIELDS = Object.freeze({});

/** Our site contact fields that may be filled from the CRM (they live in the site's contacts JSON). */
const ALLOWED = Object.freeze(['contact_name', 'phone', 'access_notes', 'business_hours', 'site_code', 'tenant_business', 'tenant_contact', 'tenant_phone', 'tenant_email', 'owner_name', 'owner_phone', 'owner_email']);

/** A CRM value as plain text: lookups ({ name }) give their name, numbers become text, empty or other shapes give ''. */
function crmText(v) {
	if (v === null || v === undefined) return '';
	if (typeof v === 'string') return v.trim().slice(0, 255);
	if (typeof v === 'number') return String(v);
	if (typeof v === 'object' && typeof v.name === 'string') return v.name.trim().slice(0, 255);
	return '';
}

/**
 * The site contact input for one CRM site record, using the given field map. Only mapped fields with a value are returned,
 * so an empty CRM field never wipes what the office typed in. Unknown keys in the map are ignored.
 */
function contactFromCrmSite(record, fields = SITE_CONTACT_FIELDS) {
	const out = {};
	if (!record) return out;
	for (const [ours, theirs] of Object.entries(fields || {})) {
		if (!ALLOWED.includes(ours) || typeof theirs !== 'string') continue;
		const text = crmText(record[theirs]);
		if (text) out[ours] = text;
	}
	return out;
}

const isMapped = (fields = SITE_CONTACT_FIELDS) => Object.keys(fields || {}).some((k) => ALLOWED.includes(k));

module.exports = { CRM_SITE_MODULE, SITE_CONTACT_FIELDS, ALLOWED, crmText, contactFromCrmSite, isMapped };
