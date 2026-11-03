'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const people = require('../lib/services/people');
const compliance = require('../lib/services/compliance');
const { runComplianceDue, optedOut } = require('../lib/services/complianceJob');
const { run } = require('../lib/jobs/registry');
const { TYPES } = require('../lib/seed/complianceTypes');

const ME = '105747000000900001';

function addType(w, over = {}) {
	const t = { ROWID: '105747000001500001', name: 'Working at Heights', compliance_kind: 'ticket', requires_expiry: 'true', reminder_offsets: '[30,14,7,0]', ...over };
	w.db.ctypes.push(t);
	return t;
}

test('seeded compliance types are valid and the seed can be repeated', async () => {
	for (const t of TYPES) assert.ok(t.name && ['ticket', 'induction', 'document'].includes(t.compliance_kind), t.name);
	const w = makeWorld();
	const a = await compliance.seedComplianceTypes(w.ctx);
	assert.equal(a.added.length, TYPES.length);
	const b = await compliance.seedComplianceTypes(w.ctx);
	assert.equal(b.added.length, 0);
	assert.equal(w.db.ctypes[1].requires_expiry, 'true', 'booleans go to Catalyst as strings');
	await rejects(compliance.seedComplianceTypes(w.as(['project_manager'])), 403);
});

test('people: managers list them and never see pay rates; only admins create or edit', async () => {
	const w = makeWorld();
	w.db.people[0].hourly_rate = 40;
	w.db.people[0].profile_private = 'secret';
	const pm = w.as(['project_manager'], '105747000000900002');
	const seen = (await people.listPeople(pm)).items[0];
	assert.equal('hourly_rate' in seen, false);
	assert.equal('profile_private' in seen, false);
	assert.equal((await people.listPeople(w.ctx)).items[0].hourly_rate, 40, 'admin sees the rate');

	await rejects(people.createPerson(pm, { first_name: 'X' }), 403);
	await rejects(people.listPeople(w.as(['installer'])), 403);

	const { person } = await people.createPerson(w.ctx, { first_name: 'Jo', email: 'Jo@Example.com', roles: ['installer'], hourly_rate: 35 });
	assert.equal(w.db.people.find((p) => p.ROWID === person.ROWID).email, 'jo@example.com', 'email is lower-cased');
	assert.equal(w.db.people.find((p) => p.ROWID === person.ROWID).roles, '["installer"]');
	await rejects(people.createPerson(w.ctx, { first_name: 'Dup', email: 'jo@example.com' }), 409, 'email_in_use');
	await rejects(people.createPerson(w.ctx, { first_name: 'Bad', roles: ['boss'] }), 400);
	await rejects(people.updatePerson(pm, person.ROWID, { job_title: 'x' }), 403);
	const u = await people.updatePerson(w.ctx, person.ROWID, { is_active: false, job_title: 'Installer' });
	assert.equal(u.person.job_title, 'Installer');
	assert.equal(u.person.is_active, false);
	await rejects(people.updatePerson(w.ctx, '105747000001999999', { job_title: 'x' }), 404);
});

test('items: expiry is required for types that expire, dates are checked, status is derived', async () => {
	const w = makeWorld();
	const type = addType(w);
	const body = { type_id: type.ROWID, person_id: ME };
	await rejects(compliance.createItem(w.ctx, body), 400);
	await rejects(compliance.createItem(w.ctx, { ...body, issue_date: '2026-05-01', expiry_date: '2026-04-01' }), 400);
	await rejects(compliance.createItem(w.ctx, { ...body, expiry_date: '2026-12-01', type_id: '105747000001999999' }), 404);

	const { item } = await compliance.createItem(w.ctx, { ...body, reference_no: 'WAH-1', expiry_date: '2026-11-20' });
	assert.equal(item.status, 'Expiring');
	assert.equal(item.daysLeft, 18);
	assert.equal(item.personName, 'Test User');
	assert.equal(w.db.citems[0].next_reminder_at, '2026-10-21 00:00:00', 'first reminder is 30 days before expiry');

	const noExpiry = addType(w, { ROWID: '105747000001500002', name: 'White Card', requires_expiry: 'false' });
	const white = await compliance.createItem(w.ctx, { type_id: noExpiry.ROWID, person_id: ME });
	assert.equal(white.item.status, 'No expiry');
	assert.equal(w.db.citems[1].next_reminder_at, null);

	const list = await compliance.listItems(w.ctx, { status: 'Expiring' });
	assert.deepEqual(list.items.map((i) => i.referenceNo), ['WAH-1']);
});

test('crew see only their own items; managers see everyone', async () => {
	const w = makeWorld();
	const type = addType(w);
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2027-01-01' });
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: '105747000000900003', expiry_date: '2027-01-01' }).catch(() => {});
	w.db.people.push({ ROWID: '105747000000900003', first_name: 'Other' });
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: '105747000000900003', expiry_date: '2027-02-01' });

	assert.equal((await compliance.listItems(w.as(['project_manager'], '105747000000900002'))).items.length, 2);
	const mine = await compliance.listItems(w.as(['installer'], ME));
	assert.equal(mine.items.length, 1);
	assert.equal(mine.items[0].personId, ME);
	await rejects(compliance.listItems(w.as(['installer'], ME), { person_id: '105747000000900003' }), 404);
	await rejects(compliance.createItem(w.as(['installer'], ME), { type_id: type.ROWID, person_id: ME, expiry_date: '2027-01-01' }), 403);
});

test('renewing (a new expiry date) restarts the reminders', async () => {
	const w = makeWorld();
	const type = addType(w);
	const { item } = await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-11-20' });
	w.db.citems[0].meta = '{"lastSent":14}';
	const r = await compliance.updateItem(w.ctx, item.id, { expiry_date: '2028-01-31' });
	assert.equal(r.item.status, 'Valid');
	assert.equal(w.db.citems[0].meta, '{}');
	assert.equal(w.db.citems[0].next_reminder_at, '2028-01-01 00:00:00');
	await rejects(compliance.updateItem(w.ctx, '105747000001999999', {}), 404);
});

// ---- the scheduled job ----

function jobSetup(now = '2026-11-02T01:00:00Z') {
	const w = makeWorld();
	w.db.people[0].email = 'worker@x.com';
	w.db.people.push({ ROWID: '105747000000900002', first_name: 'Pat', email: 'pm@x.com', roles: ['project_manager'] });
	const type = addType(w);
	const sent = [];
	const ctx = {
		repos: w.ctx.repos,
		log: { info() {}, warn() {}, error() {} },
		now: () => new Date(now),
		mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) },
	};
	return { w, type, sent, ctx };
}

test('reminders: one email on the day an offset is due, none on a rerun, the next on its own day', async () => {
	const { w, type, sent, ctx } = jobSetup();
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-12-02' }); // first reminder 2026-11-02

	const r1 = await runComplianceDue(ctx);
	assert.deepEqual(r1, { checked: 1, sent: 1, skipped: 0, failed: 0 });
	assert.deepEqual(sent[0].to.sort(), ['pm@x.com', 'worker@x.com']);
	assert.match(sent[0].subject, /Working at Heights expires in 30 days/);
	assert.equal(w.db.citems[0].meta, '{"lastSent":30}');
	assert.equal(w.db.citems[0].next_reminder_at, '2026-11-18 00:00:00');

	const r2 = await runComplianceDue(ctx); // same day again
	assert.equal(r2.checked, 0);
	assert.equal(sent.length, 1);

	ctx.now = () => new Date('2026-11-18T01:00:00Z');
	assert.equal((await runComplianceDue(ctx)).sent, 1);
	assert.match(sent[1].subject, /expires in 14 days/);
});

test('reminders: with no email set up nothing is marked sent, so they go out later', async () => {
	const { w, type, ctx } = jobSetup();
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-12-02' });
	ctx.mailer = { send: async () => ({ sent: false, reason: 'no_sender' }) };
	const r = await runComplianceDue(ctx);
	assert.deepEqual(r, { checked: 1, sent: 0, skipped: 1, failed: 0 });
	assert.equal(w.db.citems[0].meta, '{}', 'not recorded as sent');
	assert.equal(w.db.citems[0].next_reminder_at, '2026-11-02 00:00:00', 'still due');
});

test('reminders: one failing item does not stop the others; opted-out people are not emailed', async () => {
	const { w, type, sent, ctx } = jobSetup();
	w.db.people.push({ ROWID: '105747000000900009', first_name: 'Optout', email: 'optout@x.com' });
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-12-02' });
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: '105747000000900009', expiry_date: '2026-12-02' });
	w.db.citems[1].do_not_contact = 'phone and email';

	let n = 0;
	ctx.mailer = { send: async (m) => { if (++n === 1) throw new Error('boom'); sent.push(m); return { sent: true, count: m.to.length }; } };
	const r = await runComplianceDue(ctx);
	assert.equal(r.failed, 1);
	assert.equal(r.sent, 1);
	assert.ok(!sent[0].to.includes('optout@x.com'), 'opted out of email');
	assert.ok(sent[0].to.includes('pm@x.com'), 'managers still hear about it');
	assert.equal(optedOut('false'), false);
	assert.equal(optedOut(''), false);
	assert.equal(optedOut('email'), true);
});

test('reminders: a renewed or expired item just moves its date on without emailing', async () => {
	const { w, type, sent, ctx } = jobSetup();
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-12-02' });
	w.db.citems[0].expiry_date = '2026-10-01'; // expired before the job saw it
	const r = await runComplianceDue(ctx);
	assert.equal(r.sent, 0);
	assert.equal(sent.length, 0);
	assert.equal(w.db.citems[0].next_reminder_at, null, 'an expired item leaves the daily check');
	assert.equal((await runComplianceDue(ctx)).checked, 0, 'and is not looked at again');
});

test('the job runner calls the compliance job with injected parts', async () => {
	const { w, type, sent, ctx } = jobSetup();
	await compliance.createItem(w.ctx, { type_id: type.ROWID, person_id: ME, expiry_date: '2026-12-02' });
	const out = await run('compliance-due', {}, ctx);
	assert.deepEqual(out, { ran: true });
	assert.equal(sent.length, 1);
});
