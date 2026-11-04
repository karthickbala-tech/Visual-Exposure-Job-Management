// Local mock of the API for UI work. Zero Catalyst requests: the free plan has a small monthly allowance (docs/REQUEST_BUDGET.md).
// Run:  node dev/mock-api.mjs    (port 3100; `npm run dev` proxies /server to it)
// Add ?role=installer to any page URL's API calls via the MOCK_ROLES env, e.g.  MOCK_ROLES=installer node dev/mock-api.mjs
import http from 'node:http';

const roles = (process.env.MOCK_ROLES || 'admin').split(',');
const isManager = roles.some((r) => ['admin', 'project_manager', 'fab_manager', 'install_coordinator'].includes(r));
const TODAY = new Date().toISOString().slice(0, 10);
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const jobs = [
	{ ROWID: '1001', name: 'Harbour Wayfinding Package', stage: 'In Progress', crm_deal_id: '4590000000112', expected_finish: day(30), created_date: day(-40), percent_fab: 60, percent_install: 20, percent_job: 45 },
	{ ROWID: '1002', name: 'Pylon Refresh: Sunshine West', stage: 'Preparation', crm_deal_id: '4590000000187', expected_finish: day(55), created_date: day(-5), percent_fab: 0, percent_install: 0, percent_job: 0 },
	{ ROWID: '1003', name: 'A very long job name that keeps going to test how the table and the header cope with it in a narrow column', stage: 'On Hold', created_date: day(-90), percent_fab: 90, percent_install: 0, percent_job: 60 },
	{ ROWID: '1004', name: 'Old Signage Removal', stage: 'Completed - Closed', created_date: day(-200), percent_fab: 100, percent_install: 100, percent_job: 100 },
];
const tasks = [
	{ ROWID: '2001', job_id: '1001', task_type: 'design', name: 'Artwork approval', kind: null, stage: 'Completed', scheduled_date: day(-20), required_finish: day(-15), nextStages: [] },
	{ ROWID: '2002', job_id: '1001', task_type: 'fabrication', name: 'Cut ACM panels', kind: 'CNC', stage: 'In Progress', scheduled_date: day(-1), required_finish: day(-2), nextStages: ['Manager Review', 'On Hold'] },
	{ ROWID: '2003', job_id: '1001', task_type: 'fabrication', name: 'Paint frames', kind: 'Paint', stage: 'Scheduled', scheduled_date: day(2), required_finish: day(9), nextStages: ['In Progress'] },
	{ ROWID: '2004', job_id: '1001', task_type: 'install', name: 'Install wayfinding totems', kind: 'VE Install', stage: 'Awaiting Scheduling', scheduled_date: null, required_finish: day(25), swms_id: '3001', nextStages: [] },
	{ ROWID: '2005', job_id: '1003', task_type: 'fabrication', name: 'Weld brackets', kind: 'Metal', stage: 'Manager Review', scheduled_date: day(-6), required_finish: day(-3), nextStages: ['Approved & Completed', 'Rejected'] },
];
const issues = [
	{ ROWID: '4001', subject: 'Wet floor at the loading bay', department: 'Install', issue_status: 'Open', issue_priority: 'High', CREATEDTIME: day(-2), nextStages: [], nextStatuses: ['In Progress', 'Resolved'] },
	{ ROWID: '4002', subject: 'Billboard dispute with council', department: 'Civic Billboards', issue_status: 'In Progress', issue_priority: 'Normal', task_id: '2004', CREATEDTIME: day(-9), nextStatuses: ['Resolved'] },
	{ ROWID: '4003', subject: 'Supplier sent the wrong vinyl colour, please check the order before we cut anything', department: 'Fabrication', issue_status: 'Resolved', issue_priority: 'Low', CREATEDTIME: day(-20), nextStatuses: ['Closed'] },
];
const people = [
	{ ROWID: '501', first_name: 'Karthick', last_name: 'Bala', email: 'karthick@example.test', roles: JSON.stringify(['admin']), is_active: true, hourly_rate: 95 },
	{ ROWID: '502', first_name: 'Rachel', last_name: 'Nguyen', email: 'rachel@example.test', roles: JSON.stringify(['project_manager']), is_active: true },
	{ ROWID: '503', first_name: 'Sam', last_name: 'Okafor-Whittington-Smythe', email: 'sam.with.a.very.long.email.address@subcontractor-example.test', roles: JSON.stringify(['installer', 'fab_worker']), is_active: true },
	{ ROWID: '504', first_name: 'Li', roles: JSON.stringify([]), is_active: false },
];
const swms = { id: '3001', jobId: '1001', status: 'PM Signed', pcbu: { Name: 'Visual Exposure Pty Ltd', Phone: '03 9311 5722' }, siteAddress: '1 Harbour Esplanade, Docklands', ppe: ['Hard hat', 'Hi-vis'], tasks: [{ task: 'Set out totem positions', responsible: 'Team leader' }], declarations: [{ personId: '503', name: 'Sam Okafor', at: day(-1) }], signoff: { pm: { name: 'Rachel Nguyen', at: day(-2) } } };

const hourCell = (fab, install) => ({ fab, install, workshop: 0, design: 0, other: 0, unbilled: 0, final: fab + install });
const week = () => {
	const d = new Date(); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow);
	return Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10));
};
const days = week();
const hoursReport = () => ({
	weekStart: days[0], days,
	rows: [
		{ personId: '503', name: 'Sam Okafor-Whittington-Smythe', days: { [days[0]]: hourCell(8, 0), [days[1]]: hourCell(0, 9.5), [days[2]]: hourCell(4, 4) }, totals: hourCell(12, 13.5), labourCost: 2300.5 },
		{ personId: '502', name: 'Rachel Nguyen', days: { [days[0]]: hourCell(0, 7.5) }, totals: hourCell(0, 7.5), labourCost: 712.5 },
	],
	totals: hourCell(12, 21), truncated: false,
});

const board = (type) => {
	const stages = type === 'design' ? ['To be Assigned', 'In Progress', 'Manager Review', 'Completed'] : ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'];
	return { type, truncated: false, columns: stages.map((stage) => { const items = tasks.filter((t) => t.task_type === type && t.stage === stage).map((t) => ({ ROWID: t.ROWID, name: t.name, job_id: t.job_id, kind: t.kind, scheduled_date: t.scheduled_date, required_finish: t.required_finish, overdue: !!t.required_finish && t.required_finish < TODAY && !['Completed', 'Cancelled'].includes(t.stage) })); return { stage, items, count: items.length, overdueCount: items.filter((i) => i.overdue).length }; }) };
};

const tilesFor = (role) => ({
	project_manager: [['My open jobs', 3], ['My open install tasks', 2], ['My open design tasks', 1], ['All open fab tasks', 5]],
	fab_manager: [['Open fab tasks', 5], ['Awaiting scheduling', 2], ['Scheduled', 1], ['In progress', 1], ['Manager review', 1], ['Overdue fab tasks', 2]],
	installer: [['My tasks today', 1], ['My open install tasks', 2]],
	fab_worker: [['Hours not filled in', 3], ['Hours not filled (workshop)', 1], ['My tasks today', 2], ['My open fab tasks', 3]],
	workshop: [['Open workshop tasks', 2], ['My open tasks', 3], ['Equipment overdue for checks', 1]],
	install_coordinator: [['Open install tasks', 4], ['Awaiting scheduling', 2], ['Scheduled', 1], ['Overdue install tasks', 1]],
}[role] ?? []).map(([label, value], i) => ({ key: `t${i}`, label, value }));

const templates = ['issueRaised', 'issueUpdated', 'taskSentBack', 'jobClosed', 'equipmentOffHire', 'complianceDue', 'weeklyHours', 'weeklyIssues'].map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), placeholders: ['job', 'subject', 'link'], override: name === 'jobClosed' ? { intro: 'Well done team.' } : null }));

let settings = { workshop_job_id: '1001', pay_period: { start_date: day(-3), length_days: 14 }, issue_routing: { Install: { manager_id: '502' } }, expiry_reminder_days: [30, 7, 0], pcbu_defaults: { Name: 'Visual Exposure Pty Ltd' }, hours_report_recipients: ['502'], hours_cutoff_date: null };

const routes = [
	['GET', /^\/me$/, () => ({ user: { id: '1', email: 'karthick@example.test', firstName: 'Karthick', lastName: 'Bala' }, roles, permissions: { createJob: isManager, editJob: isManager, createTask: isManager, assignPeople: isManager }, person: { ROWID: isManager ? '501' : '503' } })],
	['GET', /^\/jobs$/, (_, q) => { let items = jobs; const v = q.get('view'); if (v === 'preparation') items = jobs.filter((j) => j.stage === 'Preparation'); if (v === 'ongoing') items = jobs.filter((j) => ['In Progress', 'On Hold'].includes(j.stage)); if (v === 'completed') items = jobs.filter((j) => j.stage.startsWith('Completed')); if (q.get('stage')) items = items.filter((j) => j.stage === q.get('stage')); return { items, count: items.length }; }],
	['GET', /^\/jobs\/(\d+)$/, (m) => ({ job: jobs.find((j) => j.ROWID === m[1]) ?? jobs[0], tasks: tasks.filter((t) => t.job_id === m[1]), progress: { fab: 60, install: 20, job: 45 }, kpis: { design: { total: 1, open: 0, overdue: 0, percent: 100 }, fabrication: { total: 2, open: 2, overdue: 1, percent: 40 }, install: { total: 1, open: 1, overdue: 0, percent: 0 } } })],
	['GET', /^\/tasks\/board$/, (_, q) => board(q.get('type') || 'fabrication')],
	['GET', /^\/tasks\/(\d+)$/, (m) => ({ task: tasks.find((t) => t.ROWID === m[1]) ?? tasks[0], assignees: [{ linkId: '1', personId: '503', role: 'lead', name: 'Sam Okafor' }], nextStages: ['In Progress'] })],
	['GET', /^\/tasks\/(\d+)\/checklist\/next$/, () => ({ phase: 'pre', action: 'start', checklistId: null, next: null })],
	['GET', /^\/tasks\/(\d+)\/checklists$/, () => ({ items: [] })],
	['GET', /^\/dashboard$/, () => (isManager ? { scope: 'all', today: TODAY, myTasks: tasks.slice(1, 4), jobsByStage: { Preparation: 1, 'In Progress': 1, 'On Hold': 1, Completed: 1 }, overdueTasks: 2, openIssues: 2, swmsAwaiting: 1 } : { scope: 'mine', today: TODAY, myTasks: tasks.slice(1, 4) })],
	['GET', /^\/dashboards\/(\w+)$/, (m) => ({ role: m[1], tiles: tilesFor(m[1]) })],
	['GET', /^\/calendar$/, () => ({ items: tasks.filter((t) => t.scheduled_date).map((t) => ({ ROWID: t.ROWID, job_id: t.job_id, name: t.name, task_type: t.task_type, stage: t.stage, scheduled_date: t.scheduled_date, kind: t.kind })) })],
	['GET', /^\/issues$/, (_, q) => { const s = q.get('status'); const items = s ? issues.filter((i) => i.issue_status === s) : issues; return { items, count: items.length }; }],
	['GET', /^\/issues\/(\d+)\/history$/, () => ({ items: [{ at: new Date().toISOString(), changes: [{ field: 'issue_status', from: 'Open', to: 'In Progress' }, { field: 'assigned_to_id', from: '', to: 'Rachel Nguyen' }] }] })],
	['POST', /^\/jobs\/(\d+)\/close$/, () => ({ job: { stage: 'Completed - Closed' } })],
	['GET', /^\/issues\/board$/, () => ({ departments: ['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards'], counts: { Management: { Open: 0, 'In Progress': 0, Resolved: 0, Closed: 0, openTotal: 0 }, Design: { Open: 0, 'In Progress': 0, Resolved: 1, Closed: 2, openTotal: 0 }, Fabrication: { Open: 1, 'In Progress': 1, Resolved: 0, Closed: 0, openTotal: 2 }, Install: { Open: 3, 'In Progress': 0, Resolved: 0, Closed: 1, openTotal: 3 }, 'Civic Billboards': { Open: 0, 'In Progress': 1, Resolved: 0, Closed: 0, openTotal: 1 } }, truncated: false })],
	['POST', /^\/issues\/(\d+)\/crm-deal$/, () => ({ created: true, dealId: '4590000000999' })],
	['GET', /^\/companies$/, () => ({ items: [{ id: '701', name: 'Crane Co', kind: 'subcontractor', state: 'VIC', contactName: '', phone: '', email: 'c@example.test', notes: '', isActive: true }], count: 1 })],
	['GET', /^\/compliance\/types$/, () => ({ items: [{ id: '801', kind: 'ticket', name: 'White card', requiresExpiry: false, mandatory: true, offsets: [] }, { id: '802', kind: 'ticket', name: 'Working at heights', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] }, { id: '803', kind: 'company_document', name: 'Public liability insurance', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] }] })],
	['GET', /^\/people\/(\d+)\/ratings$/, () => ({ items: [{ taskId: '2002', rating: 5, comment: 'Careful and on time', ratedAt: null }, { taskId: '2003', rating: 4, comment: '', ratedAt: null }], count: 2, average: 4.5 })],
	['GET', /^\/people\/(\d+)$/, (m) => ({ person: people.find((p) => p.ROWID === m[1]) ?? people[0] })],
	['GET', /^\/people$/, () => ({ items: people, count: people.length })],
	['GET', /^\/roles$/, () => ({ items: ['admin', 'project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'installer', 'fab_worker', 'workshop', 'viewer'].map((key) => ({ key, label: key.replace(/_/g, ' ') })) })],
	['GET', /^\/hours\/(weekly|pay-period)$/, () => hoursReport()],
	['GET', /^\/hours\/not-filled$/, () => ({ personId: '501', workshop: 1, other: 2, total: 3 })],
	['GET', /^\/swms$/, () => ({ items: [{ id: '3001', status: 'PM Signed', jobId: '1001', siteAddress: '1 Harbour Esplanade, Docklands', task: { id: '2004', name: 'Install wayfinding totems', stage: 'Awaiting Scheduling' } }, { id: '3002', status: 'Created', jobId: '1002', siteAddress: '', task: null }], count: 2 })],
	['GET', /^\/swms\/(\d+)$/, () => ({ swms, taskId: '2004' })],
	['GET', /^\/reports\/checklists$/, () => ({ items: [{ id: '6001', taskId: '2002', taskName: 'Cut ACM panels', phase: 'pre', status: 'Completed', assigneeId: '503', role: 'lead', hours: null }, { id: '6002', taskId: '2002', taskName: 'Cut ACM panels', phase: 'post', status: 'In Progress', assigneeId: '503', role: 'member', hours: 6.5 }], count: 2 })],
	['GET', /^\/compliance\/dashboard$/, () => ({ today: TODAY, counts: { ticket: { overdue: 2, today: 0, within30: 3 }, induction: { overdue: 0, today: 1, within30: 2 }, company_document: { overdue: 1, today: 0, within30: 0 } }, workers: { ve: 8, other: 5 } })],
	['GET', /^\/compliance\/types$/, () => ({ items: [{ id: '801', kind: 'ticket', name: 'White card', requiresExpiry: false, mandatory: true, offsets: [] }, { id: '802', kind: 'ticket', name: 'Working at heights', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] }] })],
	['GET', /^\/compliance$/, () => ({ items: [{ id: '901', kind: 'ticket', typeName: 'Working at heights', personId: '503', personName: 'Sam Okafor', referenceNo: 'WAH-2291', expiryDate: day(-4), daysLeft: -4, status: 'Expired' }, { id: '902', kind: 'ticket', typeName: 'Forklift licence', personId: '502', personName: 'Rachel Nguyen', referenceNo: 'FL-77', expiryDate: day(12), daysLeft: 12, status: 'Expiring' }, { id: '903', kind: 'induction', typeName: 'Site induction', personId: '503', personName: 'Sam Okafor', referenceNo: '', expiryDate: null, daysLeft: null, status: 'No expiry' }], count: 3 })],
	['GET', /^\/admin\/settings$/, () => ({ settings })],
	['PUT', /^\/admin\/settings$/, (_, __, body) => { settings = { ...settings, ...body }; return { settings }; }],
	['GET', /^\/admin\/mail-templates$/, () => ({ items: templates })],
	['PUT', /^\/admin\/mail-templates\/(\w+)$/, (m, _, b) => ({ template: { ...templates.find((t) => t.name === m[1]), override: b } })],
	['GET', /^\/admin\/mail-templates\/(\w+)\/preview$/, () => ({ subject: 'Preview', html: '<div style="font-family:Raleway,Arial,sans-serif"><h2>Preview</h2><p>This is how the email looks.</p></div>' })],
	['GET', /^\/admin\/notifications$/, () => ({ items: [{ id: '1', event: 'issue.raised', status: 'sent', subject: 'Issue raised: Wet floor', recipients: ['a@x.test', 'b@x.test'], reason: null, at: new Date().toISOString() }, { id: '2', event: 'report.weekly_hours', status: 'failed', subject: 'Weekly hours report', recipients: ['a@x.test'], reason: 'failed', at: new Date().toISOString() }, { id: '3', event: 'job.closed', status: 'skipped', subject: 'Job closed', recipients: [], reason: 'no_sender', at: new Date().toISOString() }] })],
	['POST', /^\/admin\/notifications\/\d+\/retry$/, () => ({ sent: false, reason: 'no_sender' })],
	['POST', /^\/admin\/reports\/weekly-(hours|issues)$/, () => ({ ran: false, reason: 'No report recipients are set.' })],
	['GET', /^\/admin\/authz$/, () => ({ matrix: {}, resources: [], roles: [] })],
	['GET', /^\/admin\/outbox$/, () => ({ items: [], count: 0 })],
	['GET', /^\/(equipment|chemicals|locations|devices|companies|sites|signs|files)$/, () => ({ items: [], count: 0 })],
];

const server = http.createServer((req, res) => {
	const url = new URL(req.url, 'http://x');
	const path = url.pathname.replace(/^\/server\/api/, '') || '/';
	const chunks = [];
	req.on('data', (c) => chunks.push(c));
	req.on('end', () => {
		let body = {};
		try { body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { /* ignore */ }
		const hit = routes.find(([m, re]) => m === req.method && re.test(path));
		const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data })); };
		if (hit) return send(200, hit[2](path.match(hit[1]), url.searchParams, body));
		if (req.method !== 'GET') return send(200, { ok: true });
		console.log('mock: no route for', req.method, path);
		return send(200, { items: [], count: 0 });
	});
});
server.listen(3100, () => console.log('Mock API on http://localhost:3100 (roles: ' + roles.join(', ') + ')'));
