'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const R = require('../lib/domain/registers');
const reg = require('../lib/services/registers');

test('next due date, overdue and tool codes', () => {
	const plan = { last_checked: '2026-10-01', frequency_days: 30 };
	assert.equal(R.nextDue(plan), '2026-10-31');
	assert.equal(R.nextDue({}), null);
	assert.equal(R.isOverdue({ status: 'In service', plan }, '2026-11-02'), true);
	assert.equal(R.daysOverdue({ plan }, '2026-11-02'), 2);
	assert.equal(R.isOverdue({ status: 'Off hire', plan }, '2026-11-02'), false);
	assert.equal(R.nextToolCode([]), 'VE - 101');
	assert.equal(R.nextToolCode(['VE - 101', 'VE - 250', 'x']), 'VE - 251');
});

test('only web addresses are accepted as SDS links', () => {
	assert.equal(R.isWebUrl('https://example.com/sds.pdf'), true);
	assert.equal(R.isWebUrl('javascript:alert(1)'), false);
	assert.equal(R.isWebUrl('ftp://x.com/a'), false);
	assert.equal(R.sdsMissing({}), true);
	assert.equal(R.sdsReviewDue({ review_date: '2026-01-01' }, '2026-11-02'), true);
});

test('off hire applies only to in-service equipment flagged for it', () => {
	const list = [
		{ kind: 'equipment', off_hire_required: true, status: 'In service' },
		{ kind: 'equipment', off_hire_required: false, status: 'In service' },
		{ kind: 'equipment', off_hire_required: true, status: 'Off hire' },
	];
	assert.equal(R.offHireOnFinish(list).length, 1);
});

test('equipment: create gets the next code, mark checked moves the due date, a viewer cannot write', async () => {
	const w = makeWorld();
	const a = await reg.createEquipment(w.ctx, { name: 'Scissor lift', frequency_days: 30, last_checked: '2026-09-01' });
	assert.equal(a.item.code, 'VE - 101');
	assert.equal(a.item.overdue, true);
	const b = await reg.createEquipment(w.ctx, { name: 'Drill' });
	assert.equal(b.item.code, 'VE - 102');
	const checked = await reg.markChecked(w.ctx, a.item.id);
	assert.equal(checked.item.lastChecked, '2026-11-02');
	assert.equal(checked.item.overdue, false);
	assert.equal((await reg.listEquipment(w.ctx)).count, 2);
	await rejects(reg.createEquipment(w.as(['viewer']), { name: 'x' }), 403);
	await rejects(reg.updateEquipment(w.ctx, '105747000009999999', { name: 'x' }), 404);
});

test('chemicals: a bad SDS link is refused, missing SDS is flagged', async () => {
	const w = makeWorld();
	await rejects(reg.createChemical(w.ctx, { name: 'Acetone', sds_url: 'javascript:alert(1)' }), 400);
	const c = await reg.createChemical(w.ctx, { name: 'Acetone' });
	assert.equal(c.item.sdsMissing, true);
	const u = await reg.updateChemical(w.ctx, c.item.id, { sds_url: 'https://example.com/a.pdf', review_date: '2026-01-01' });
	assert.equal(u.item.sdsMissing, false);
	assert.equal(u.item.reviewDue, true);
	assert.equal((await reg.listChemicals(w.ctx)).items.length, 1);
	assert.equal((await reg.listEquipment(w.ctx)).items.length, 0);
});

test('locations and equipment in a location', async () => {
	const w = makeWorld();
	const loc = await reg.createLocation(w.ctx, { name: 'Workshop A', supervisor_id: '105747000000900001' });
	const e = await reg.createEquipment(w.ctx, { name: 'Saw', location_id: loc.item.id });
	assert.equal(e.item.locationName, 'Workshop A');
	await rejects(reg.createEquipment(w.ctx, { name: 'Saw', location_id: '105747000009999999' }), 404);
	const list = await reg.listLocations(w.ctx);
	assert.equal(list.items[0].supervisorName, 'Test User');
});

test('off hire switches the flagged equipment and reports it', async () => {
	const w = makeWorld();
	const a = await reg.createEquipment(w.ctx, { name: 'Hired lift', off_hire_required: true });
	const b = await reg.createEquipment(w.ctx, { name: 'Own drill' });
	const res = await reg.offHireForFinishedInstall(w.ctx, [a.item.id, b.item.id]);
	assert.deepEqual(res.switched.map((s) => s.id), [a.item.id]);
	assert.equal((await reg.listEquipment(w.ctx)).items.find((i) => i.id === a.item.id).status, 'Off hire');
});

test('devices: PMs may view, workers may not; stale and map link are derived', async () => {
	const w = makeWorld();
	w.db.devices.push({ ROWID: '5', person_id: '105747000000900001', model: 'iPhone', last_lat: -37.8, last_lng: 144.9, last_seen_at: '2026-11-02 09:00:00' }, { ROWID: '6', model: 'Pixel', last_seen_at: '2026-10-01 09:00:00' });
	const out = await reg.listDevices(w.as(['project_manager']));
	assert.equal(out.items[0].stale, false);
	assert.ok(out.items[0].mapUrl.includes('openstreetmap'));
	assert.equal(out.items[1].stale, true);
	assert.equal(out.items[1].lat, null);
	await rejects(reg.listDevices(w.as(['installer'])), 403);
});

test('outbox: admin lists items and can retry only failed ones', async () => {
	const outboxSvc = require('../lib/services/outbox');
	const w = makeWorld();
	w.db.outbox.push({ ROWID: '7', job_type: 'crm.stage', job_status: 'Failed', attempts: 6, last_error: 'boom' }, { ROWID: '8', job_type: 'crm.stage', job_status: 'Done', attempts: 1 });
	assert.equal((await outboxSvc.listOutbox(w.ctx)).items.length, 2);
	assert.equal((await outboxSvc.listOutbox(w.ctx, { status: 'Failed' })).items[0].lastError, 'boom');
	await rejects(outboxSvc.retryOutbox(w.ctx, '8'), 400);
	await outboxSvc.retryOutbox(w.ctx, '7');
	assert.equal(w.db.outbox[0].job_status, 'Pending');
	assert.equal(w.db.outbox[0].attempts, 0);
	await rejects(outboxSvc.listOutbox(w.as(['project_manager'])), 403);
});

test('the permission matrix accepts the equipment and devices resources', () => {
	const { validateMatrix } = require('../lib/domain/matrix');
	assert.deepEqual(validateMatrix({ workshop: { equipment: { verbs: ['view'], scope: 'all' } } }), []);
});
