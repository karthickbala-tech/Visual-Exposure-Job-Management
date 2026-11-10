'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { makeWorld, rejects } = require('./helpers');
const issues = require('../lib/services/issues');
const appSettings = require('../lib/services/appSettings');
const handlers = require('../lib/events/handlers');
const { diffIssue, boardCounts, DEPARTMENTS } = require('../lib/domain/issues');
const { projectRow } = require('../lib/authz');
const { render } = require('../lib/domain/notifications');
const { createZoho } = require('../lib/integrations/zoho');

const ME = '105747000000900001';
const BOSS = '105747000000900002';
const STAFF = '105747000000900003';

function setup() {
	const w = makeWorld();
	w.db.people.push({ ROWID: BOSS, first_name: 'Rachel', last_name: 'PM', email: 'rachel@example.test', roles: ['project_manager'], is_active: 'true' });
	w.db.people.push({ ROWID: STAFF, first_name: 'Sam', last_name: 'Crew', email: 'sam@example.test', roles: ['installer'], is_active: 'true' });
	w.db.people[0].email = 'me@example.test';
	return w;
}
const make = async (w, over = {}) => (await issues.createIssue(w.ctx, { subject: 'Cracked panel', ...over })).issue;
const logCtx = (w, sent) => ({ ...w.ctx, log: { info() {}, warn() {}, error() {} }, mailer: { send: async (m) => (sent.push(m), { sent: true, count: m.to.length }) } });

test('rules: what an update really changes, and board counts', () => {
	const row = { issue_status: 'To Be discussed', issue_priority: 'Medium', assigned_to_id: null, owner_id: 'p1', department: 'Install', description: 'a' };
	assert.deepEqual(diffIssue(row, { issue_status: 'To Be discussed', issue_priority: 'High', owner_id: 'p1', assigned_to_id: 'p2' }), [
		{ field: 'issue_priority', label: 'Priority', from: 'Medium', to: 'High' },
		{ field: 'assigned_to_id', label: 'Assigned to', from: '', to: 'p2' },
	]);
	assert.deepEqual(diffIssue(row, { description: 'b' }), [{ field: 'description', label: 'Description', long: true }]);
	assert.deepEqual(diffIssue(row, { description: 'a', department: 'Install' }), []);

	const c = boardCounts([{ department: 'Install', issue_status: 'To Be discussed' }, { department: 'Install', issue_status: 'Completed' }, { department: 'Management', issue_status: 'In Progress' }, { department: 'Odd', issue_status: 'To Be discussed' }]);
	assert.equal(c.Install.openTotal, 1);
	assert.equal(c.Install.Completed, 1);
	assert.equal(c.Management['In Progress'], 1);
	assert.equal(c.Odd.openTotal, 1, 'an unknown department still shows');
	for (const d of DEPARTMENTS) assert.ok(c[d], `${d} always appears`);
});

test('boards: filter by department and by All Open, My Open and My Reported; crew never see others', async () => {
	const w = setup();
	const a = await make(w, { subject: 'A', department: 'Civic Billboards', billboard_site: 'Site 1', billboard_face: 'North' });
	const b = await make(w, { subject: 'B' });
	await issues.updateIssue(w.ctx, a.ROWID, { assigned_to_id: ME });
	await issues.updateIssue(w.ctx, b.ROWID, { issue_status: 'Completed', work_completed: 'Done' });
	w.db.issues.find((i) => i.subject === 'B').reported_by_id = STAFF;

	assert.deepEqual((await issues.listIssues(w.ctx, { department: 'Civic Billboards', billboard_site: 'Site 1', billboard_face: 'North' })).items.map((i) => i.subject), ['A']);
	assert.deepEqual((await issues.listIssues(w.ctx, { view: 'open' })).items.map((i) => i.subject), ['A'], 'All Open leaves out resolved');
	assert.deepEqual((await issues.listIssues(w.ctx, { view: 'mine' })).items.map((i) => i.subject), ['A'], 'My Open: assigned to me');
	assert.deepEqual((await issues.listIssues(w.as(['project_manager'], BOSS), { view: 'mine' })).items, []);
	assert.deepEqual((await issues.listIssues(w.ctx, { view: 'reported' })).items.map((i) => i.subject), ['A'], 'My Reported');
	assert.deepEqual((await issues.listIssues(w.as(['installer'], STAFF), {})).items.map((i) => i.subject), ['B'], 'crew only their own');
	await rejects(issues.listIssues(w.ctx, { department: 'Nope' }), 400);
	await rejects(issues.createIssue(w.ctx, { subject: 'x', department: 'Nope' }), 400);

	const board = await issues.issueBoard(w.ctx);
	assert.equal(board.counts['Civic Billboards']['To Be discussed'], 1);
	assert.equal(board.counts.Management.Completed, 1);
	assert.equal(board.truncated, false);
	await rejects(issues.issueBoard(w.as(['installer'], STAFF)), 403);
});

test('history: only real changes are saved, each with old and new values; an update with nothing new does nothing', async () => {
	const w = setup();
	const issue = await make(w);
	const events = () => w.published.filter((p) => p.type === 'issue.changed' && p.payload.changes);

	await issues.updateIssue(w.ctx, issue.ROWID, { issue_priority: 'Medium', issue_status: 'To Be discussed' }); // nothing new
	assert.equal(events().length, 0);
	assert.equal(w.db.activity.filter((a) => a.activity_type === 'updated').length, 0);

	await issues.updateIssue(w.ctx, issue.ROWID, { issue_priority: 'High', issue_status: 'In Progress', next_step: 'Call', due_date: '2026-12-01', assigned_to_id: STAFF, description: 'more detail' });
	assert.equal(events().length, 1);
	assert.deepEqual(events()[0].payload.changes.map((c) => [c.field, c.from, c.to]), [
		['issue_status', 'To Be discussed', 'In Progress'],
		['issue_priority', 'Medium', 'High'],
		['assigned_to_id', '', STAFF],
		['description', undefined, undefined],
		['next_step', undefined, undefined],
		['due_date', '', '2026-12-01'],
	]);
	assert.equal(events()[0].payload.actorId, ME);
	assert.equal(w.db.issues[0].issue_priority, 'High');

	const h = await issues.issueHistory(w.ctx, issue.ROWID);
	assert.equal(h.count, 1);
	assert.equal(h.items[0].changes[1].to, 'High');
	await rejects(issues.issueHistory(w.ctx, '105747000009999999'), 404);
});

test('update email: one message with old and new values, to the right people, not to the person who made the change', async () => {
	const w = setup();
	const issue = await make(w);
	w.db.issues[0].reported_by_id = STAFF;
	w.db.issues[0].assigned_to_id = ME;
	const sent = [];
	const ctx = logCtx(w, sent);
	const changes = [{ field: 'issue_status', label: 'Status', from: 'To Be discussed', to: 'In Progress' }, { field: 'assigned_to_id', label: 'Assigned to', from: '', to: BOSS }];
	await handlers['issue.changed']({ issueId: String(issue.ROWID), changes, actorId: ME }, ctx);
	assert.equal(sent.length, 1, 'one email');
	assert.deepEqual(sent[0].to.sort(), ['rachel@example.test', 'sam@example.test'], 'reporter and project managers, not the person who changed it');
	assert.match(sent[0].subject, /Issue updated: Cracked panel/);
	assert.match(sent[0].html, /Status: To Be discussed -&gt; In Progress/);
	assert.match(sent[0].html, /Assigned to: none -&gt; Rachel PM/, 'ids become names');

	sent.length = 0;
	await handlers['issue.changed']({ issueId: String(issue.ROWID), status: 'To Be discussed' }, ctx);
	assert.equal(sent.length, 0, 'no changes and not new: nothing to send');
	assert.equal(render('issueUpdated', { issue: { subject: 'x' }, changes: [{ label: 'Description', long: true }] }).text.includes('Description was changed.'), true);
});

test('routing: a department can have its own manager and inform-also list; others fall back to project managers', async () => {
	const w = setup();
	await rejects(appSettings.updateSettings(w.ctx, { issue_routing: { Nowhere: { manager_id: STAFF } } }), 400);
	await appSettings.updateSettings(w.ctx, { issue_routing: { 'Civic Billboards': { manager_id: STAFF, inform_also: [ME] } } });
	assert.equal((await appSettings.getSettings(w.ctx)).settings.issue_routing['Civic Billboards'].manager_id, STAFF);

	const routed = await make(w, { subject: 'Billboard', department: 'Civic Billboards', billboard_site: 'Site 1', billboard_face: 'North' });
	const normal = await make(w, { subject: 'Other' });
	const sent = [];
	const ctx = logCtx(w, sent);
	await handlers['issue.changed']({ issueId: String(routed.ROWID), created: true }, ctx);
	assert.deepEqual(sent[0].to.sort(), ['me@example.test', 'sam@example.test']);
	sent.length = 0;
	await handlers['issue.changed']({ issueId: String(normal.ROWID), created: true }, ctx);
	assert.deepEqual(sent[0].to, ['rachel@example.test'], 'no routing for this department: the project managers');
});

test('ISS-6: crew and viewers do not see the internal fields; managers see everything; mixed roles see the shared minimum', () => {
	const row = { subject: 's', crm_deal_id: 'D1', owner_id: '1', assigned_to_id: '2', source_kind: 'manual', reported_by_id: '3', department: 'Install' };
	const crew = projectRow(['installer'], 'issues', row);
	assert.deepEqual(Object.keys(crew).sort(), ['department', 'reported_by_id', 'subject']);
	assert.equal('reported_by_id' in projectRow(['viewer'], 'issues', row), false);
	assert.deepEqual(projectRow(['project_manager'], 'issues', row), row);
	assert.deepEqual(projectRow(['admin'], 'issues', row), row);
	assert.deepEqual(projectRow(['installer', 'project_manager'], 'issues', row), row, 'a manager who is also crew sees all');
	assert.equal('crm_deal_id' in projectRow(['installer', 'viewer'], 'issues', row), false);
});

test('ISS-4: a CRM deal is created from an issue once; asking again returns the same deal; clear errors otherwise', async () => {
	const w = setup();
	const issue = await make(w, { subject: 'Billboard dispute', description: 'Needs a quote', department: 'Civic Billboards', billboard_site: 'Site 1', billboard_face: 'North' });
	const calls = [];
	const zoho = { crm: { createDeal: async (f) => (calls.push(f), '1482987000000999001') } };

	await rejects(issues.createDealFromIssue({ ...w.ctx, zoho: null }, issue.ROWID), 503, 'not_configured');
	await rejects(issues.createDealFromIssue({ ...w.as(['installer'], STAFF), zoho }, issue.ROWID), 403);
	const first = await issues.createDealFromIssue({ ...w.ctx, zoho }, issue.ROWID);
	assert.deepEqual(first, { created: true, dealId: '1482987000000999001' });
	assert.equal(calls[0].Deal_Name, 'Issue: Billboard dispute');
	assert.equal(calls[0].Stage, 'Qualification');
	assert.equal(calls[0].Closing_Date, '2026-12-02', '30 days after the fixed test day');
	assert.match(calls[0].Description, /Needs a quote/);
	assert.match(calls[0].Description, /Civic Billboards/);

	const again = await issues.createDealFromIssue({ ...w.ctx, zoho }, issue.ROWID);
	assert.deepEqual(again, { created: false, dealId: '1482987000000999001' });
	assert.equal(calls.length, 1, 'the CRM was asked once');
	await rejects(issues.createDealFromIssue({ ...w.ctx, zoho }, '105747000009999999'), 404);
});

test('the CRM client creates a deal and surfaces a rejection', async () => {
	const answer = (body) => async (u) => (String(u).includes('/oauth/v2/token') ? { ok: true, status: 200, json: async () => ({ access_token: 'T', expires_in: 3600 }) } : { ok: true, status: 200, json: async () => body });
	const env = { ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'a', ZOHO_CLIENT_SECRET: 'b', ZOHO_REFRESH_TOKEN: 'c' };
	const good = createZoho({ env, fetchFn: answer({ data: [{ status: 'success', details: { id: '77' } }] }) });
	assert.equal(await good.crm.createDeal({ Deal_Name: 'x' }), '77');
	const bad = createZoho({ env, fetchFn: answer({ data: [{ status: 'error', code: 'MANDATORY_NOT_FOUND', message: 'required field not found' }] }) });
	await assert.rejects(bad.crm.createDeal({}), /required field not found/);
});

test('update rules: finishing needs the work completed; other statuses need a next step and due date; Civic needs site and face', async () => {
	const w = setup();
	const a = await make(w, { subject: 'Rules' });
	await rejects(issues.updateIssue(w.ctx, a.ROWID, { issue_status: 'Completed' }), 400);
	await rejects(issues.updateIssue(w.ctx, a.ROWID, { issue_status: 'In Progress' }), 400);
	await rejects(issues.updateIssue(w.ctx, a.ROWID, { issue_status: 'In Progress', next_step: 'Call', due_date: 'tomorrow' }), 400);
	const ok = await issues.updateIssue(w.ctx, a.ROWID, { issue_status: 'In Progress', next_step: 'Call', due_date: '2020-01-01' });
	assert.equal(ok.issue.issue_status, 'In Progress');
	await rejects(issues.createIssue(w.ctx, { subject: 'Billboard', department: 'Civic Billboards' }), 400);
	const civic = await issues.createIssue(w.ctx, { subject: 'Billboard', department: 'Civic Billboards', billboard_site: 'S1', billboard_face: 'East' });
	assert.equal(civic.issue.billboard_face, 'East');
	const overdue = await issues.listIssues(w.ctx, { view: 'overdue' });
	assert.deepEqual(overdue.items.map((i) => i.subject), ['Rules']);
	assert.equal((await issues.listIssues(w.ctx, { view: 'assigned' })).count, 0);
});
