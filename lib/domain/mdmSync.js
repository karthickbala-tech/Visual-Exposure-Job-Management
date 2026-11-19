'use strict';

const { toDbDateTime } = require('../time');

/**
 * What one MDM sync writes (FSD 5.15 / section 6, EQP-4), worked out without any I/O:
 * - only devices whose MDM user is a person in the app with "In MDM" ticked (the device table needs a person);
 * - one row per serial number: new serials are inserted, known ones updated only when something changed;
 * - a device with no location from MDM keeps its row and its last known location (it is listed, not plotted);
 * - the last seen time never moves backwards.
 */
const MAX = { serial: 100, model: 100, os: 50 };
const cut = (v, n) => String(v || '').trim().slice(0, n);
const isTrue = (v) => v === true || v === 'true';
const sameNumber = (a, b) => (a === null || a === undefined || a === '' ? null : Number(a)) === (b === null || b === undefined || b === '' ? null : Number(b));

function modelOf(d) {
	const brand = cut(d.product_name, 40);
	const model = cut(d.model, 60) || cut(d.device_name, 60);
	if (brand && model && !model.toLowerCase().includes(brand.toLowerCase())) return cut(`${brand} ${model}`, MAX.model);
	return cut(model || brand, MAX.model);
}

function osOf(d) {
	const platform = { android: 'Android', ios: 'iOS', ipados: 'iPadOS', windows: 'Windows', macos: 'macOS', chrome: 'ChromeOS' }[String(d.platform_type || '').toLowerCase()] || cut(d.platform_type, 20);
	return cut([platform, d.os_version].filter(Boolean).join(' '), MAX.os);
}

/**
 * @param devices   MDM device objects (listDevices)
 * @param locations Map device_id -> { lat, lng, at } (lastLocations)
 * @param people    person rows (ROWID, email, mdm_enabled)
 * @param existing  device rows already stored (ROWID, serial_number, ...)
 */
function planMdmSync({ devices = [], locations = new Map(), people = [], existing = [] }) {
	const personByEmail = new Map();
	for (const p of people) if (p.email && !isTrue(p.is_deleted)) personByEmail.set(String(p.email).trim().toLowerCase(), p);
	const rowBySerial = new Map(existing.map((r) => [String(r.serial_number).trim().toLowerCase(), r]));

	const inserts = [];
	const updates = [];
	const skipped = { noSerial: 0, noUser: 0, notInApp: 0, notInMdm: 0, duplicate: 0 };
	const skippedUsers = new Set(); // emails that are not (yet) a person with In MDM ticked, so the admin can fix them
	const seen = new Set();
	let unchanged = 0;
	let located = 0;

	for (const d of devices) {
		if (d.is_removed === true) continue;
		const serial = cut(d.serial_number || d.udid, MAX.serial);
		if (!serial) {
			skipped.noSerial += 1;
			continue;
		}
		const key = serial.toLowerCase();
		if (seen.has(key)) {
			skipped.duplicate += 1;
			continue;
		}
		seen.add(key);
		const email = d.user && d.user.user_email ? String(d.user.user_email).trim().toLowerCase() : '';
		if (!email) {
			skipped.noUser += 1;
			continue;
		}
		const person = personByEmail.get(email);
		if (!person) {
			skipped.notInApp += 1;
			skippedUsers.add(email);
			continue;
		}
		if (!isTrue(person.mdm_enabled)) {
			skipped.notInMdm += 1;
			skippedUsers.add(email);
			continue;
		}

		const fields = { serial_number: serial, model: modelOf(d), os_name: osOf(d), person_id: String(person.ROWID) };
		const loc = locations.get(String(d.device_id));
		const old = rowBySerial.get(key);
		if (loc) {
			located += 1;
			const seenAt = loc.at ? toDbDateTime(loc.at) : null;
			const newer = !old || !old.last_seen_at || !seenAt || seenAt >= String(old.last_seen_at).slice(0, 19);
			if (newer) {
				fields.last_lat = loc.lat;
				fields.last_lng = loc.lng;
				if (seenAt) fields.last_seen_at = seenAt;
			}
		}

		if (!old) {
			inserts.push(fields);
			continue;
		}
		const changed = Object.entries(fields).filter(([k, v]) => (k === 'last_lat' || k === 'last_lng' ? !sameNumber(old[k], v) : String(old[k] ?? '').slice(0, 19) !== String(v ?? '')));
		if (!changed.length) {
			unchanged += 1;
			continue;
		}
		const row = { ROWID: old.ROWID };
		for (const [k, v] of changed) row[k] = v;
		// A new location makes the old street address wrong; it is cleared (the list then shows the coordinates).
		if (row.last_lat !== undefined || row.last_lng !== undefined) row.last_address = '';
		updates.push(row);
	}

	return {
		inserts,
		updates,
		counts: { fromMdm: devices.length, added: inserts.length, updated: updates.length, unchanged, located, ...skipped },
		skippedUsers: [...skippedUsers].sort().slice(0, 20),
	};
}

module.exports = { planMdmSync, modelOf, osOf };
