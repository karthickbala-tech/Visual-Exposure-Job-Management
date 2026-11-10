// Local mock of the API for UI work, with sample data for every module (see seed.mjs). Zero Catalyst requests: the free plan has a
// small monthly allowance (docs/REQUEST_BUDGET.md). Changes you make live in memory only; restart to get the sample data back.
// Run:  node dev/mock-api.mjs   (port 3100; `npm run dev` proxies /server to it)
// See another role:  MOCK_ROLES=installer node dev/mock-api.mjs   (any of: admin, project_manager, fab_manager, install_coordinator,
//   second_ic, installer, fab_worker, workshop, viewer; or several, comma separated)
import http from 'node:http';
import * as S from './seed.mjs';

const { day } = S;
const roles = (process.env.MOCK_ROLES || 'admin').split(',');
const isAdmin = roles.includes('admin');
const isManager = roles.some((r) => ['admin', 'project_manager', 'fab_manager', 'install_coordinator'].includes(r));
const TODAY = day(0);
// who you are in the sample data, by role
const ME = { admin: '501', project_manager: '502', fab_manager: '504', install_coordinator: '510', second_ic: '506', installer: '508', fab_worker: '507', workshop: '509', viewer: '501' }[roles[0]] || '501';
let nextId = 9000;
const id = () => String(++nextId);
const now = () => new Date().toISOString();
const fullName = (p) => `${p.first_name} ${p.last_name || ''}`.trim();
const jobById = (i) => S.jobs.find((j) => j.ROWID === String(i));
const taskById = (i) => S.tasks.find((t) => t.ROWID === String(i));

const isOpen = (t) => !['Completed', 'Cancelled', 'Complete - Not Used', 'Approved & Completed'].includes(t.stage);
const isLate = (t) => isOpen(t) && t.required_finish && t.required_finish < TODAY;
const taskView = (t) => ({ ROWID: t.ROWID, job_id: t.job_id, task_type: t.task_type, name: t.name, kind: t.kind, stage: t.stage, quoted_hours: t.quoted_hours, booked_hours: t.booked_hours, scheduled_date: t.scheduled_date, required_finish: t.required_finish, description: t.description, swms_id: t.swms_id, nextStages: S.nextStages(t.stage) });
const mine = (t) => t.assignees.some(([p]) => p === ME);
const myTasks = () => S.tasks.filter((t) => isOpen(t) && (isManager ? mine(t) || false : mine(t)));

const kpisFor = (jobId) => {
	const out = {};
	for (const type of ['design', 'fabrication', 'install']) {
		const list = S.tasks.filter((t) => t.job_id === jobId && t.task_type === type);
		const done = list.filter((t) => !isOpen(t)).length;
		out[type] = { total: list.length, open: list.length - done, overdue: list.filter(isLate).length, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
	}
	return out;
};

const week = () => { const d = new Date(); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10)); };
const days = week();
const cell = (fab = 0, install = 0, workshop = 0, design = 0, unbilled = 0) => ({ fab, install, workshop, design, other: 0, unbilled, final: fab + install + workshop + design });
const sum = (cells) => cells.reduce((a, c) => ({ fab: a.fab + c.fab, install: a.install + c.install, workshop: a.workshop + c.workshop, design: a.design + c.design, other: 0, unbilled: a.unbilled + c.unbilled, final: a.final + c.final }), cell());
const hoursRows = () => {
	const rows = [
		['506', { [days[0]]: cell(8), [days[1]]: cell(8.5), [days[2]]: cell(8, 0, 0, 0, 1) }, 62],
		['507', { [days[0]]: cell(7.5), [days[1]]: cell(8), [days[3]]: cell(6) }, 55],
		['508', { [days[0]]: cell(0, 9), [days[1]]: cell(0, 9.5), [days[2]]: cell(0, 4) }, 64],
		['509', { [days[0]]: cell(0, 0, 8), [days[1]]: cell(0, 0, 8) }, 48],
		['512', { [days[1]]: cell(0, 0, 0, 6) }, 70],
	].map(([pid, d, rate]) => { const totals = sum(Object.values(d)); return { personId: pid, name: S.nameOf(pid), days: d, totals, labourCost: Math.round(totals.final * rate * 100) / 100 }; });
	return isManager ? rows : rows.filter((r) => r.personId === ME).map(({ labourCost, ...r }) => r);
};
const hoursReport = () => { const rows = hoursRows(); return { weekStart: days[0], days, rows, totals: sum(rows.map((r) => r.totals)), truncated: false, period: { start: days[0], end: day(13 - ((new Date().getUTCDay() + 6) % 7)) } }; };

const board = (type) => {
	const stages = type === 'design' ? ['To be Assigned', 'In Progress', 'Manager Review', 'Completed'] : ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'Manager Review', 'On Hold', 'Completed'];
	const list = S.tasks.filter((t) => t.task_type === type && (isManager || mine(t)));
	return { type, truncated: false, columns: stages.map((stage) => { const items = list.filter((t) => t.stage === stage).map((t) => ({ ROWID: t.ROWID, name: t.name, job_id: t.job_id, kind: t.kind, scheduled_date: t.scheduled_date, required_finish: t.required_finish, overdue: !!isLate(t) })); return { stage, items, count: items.length, overdueCount: items.filter((i) => i.overdue).length }; }) };
};

const tilesFor = (role) => {
	const open = S.tasks.filter(isOpen);
	const fab = open.filter((t) => t.task_type === 'fabrication');
	const inst = open.filter((t) => t.task_type === 'install' && t.kind !== 'External Install');
	const by = (list, s) => list.filter((t) => t.stage === s).length;
	const my = open.filter(mine);
	const rows = {
		project_manager: [['My open jobs', S.jobs.filter((j) => j.pm_id === ME && !j.stage.startsWith('Completed')).length], ['My open install tasks', my.filter((t) => t.task_type === 'install').length], ['My open design tasks', my.filter((t) => t.task_type === 'design').length], ['All open fab tasks', fab.length]],
		fab_manager: [['Open fab tasks', fab.length], ['Awaiting scheduling', by(fab, 'Awaiting Scheduling')], ['Scheduled', by(fab, 'Scheduled')], ['In progress', by(fab, 'In Progress')], ['Manager review', by(fab, 'Manager Review')], ['Overdue fab tasks', fab.filter(isLate).length]],
		install_coordinator: [['Open install tasks', inst.length], ['Awaiting scheduling', by(inst, 'Awaiting Scheduling')], ['Scheduled', by(inst, 'Scheduled')], ['Overdue install tasks', inst.filter(isLate).length]],
		second_ic: [['My open fab tasks', my.filter((t) => t.task_type === 'fabrication').length], ['My tasks today', my.filter((t) => t.scheduled_date === TODAY).length], ['My hours last week', 41.5]],
		installer: [['My tasks today', my.filter((t) => t.scheduled_date === TODAY).length], ['My open install tasks', my.filter((t) => t.task_type === 'install').length]],
		fab_worker: [['Hours not filled in', 3], ['Hours not filled (workshop)', 1], ['My tasks today', my.filter((t) => t.scheduled_date === TODAY).length], ['My open fab tasks', my.filter((t) => t.task_type === 'fabrication').length]],
		workshop: [['Open workshop tasks', open.filter((t) => t.kind === 'Workshop').length], ['My open tasks', my.length], ['Equipment overdue for checks', S.equipment.filter((e) => e.overdue).length]],
	}[role] || [];
	return rows.map(([label, value], i) => ({ key: ['hours_not_filled', 'hours_not_filled_workshop'][i] && role === 'fab_worker' ? ['hours_not_filled', 'hours_not_filled_workshop'][i] : `${role}_${i}`, label, value }));
};

const issueView = (i) => ({ ...i, nextStatuses: S.issueNext(i.issue_status) });
const issueBoard = () => {
	const departments = ['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards'];
	const counts = Object.fromEntries(departments.map((d) => { const l = S.issues.filter((i) => i.department === d); const c = (s) => l.filter((i) => i.issue_status === s).length; return [d, { Open: c('Open'), 'In Progress': c('In Progress'), Resolved: c('Resolved'), Closed: c('Closed'), openTotal: c('Open') + c('In Progress') }]; }));
	return { departments, counts, truncated: false };
};
const issueHistory = [];

const complianceView = (c) => {
	const t = S.complianceTypes.find((x) => x.id === c.typeId);
	const daysLeft = c.expiryDate ? Math.round((new Date(c.expiryDate) - new Date(TODAY)) / 864e5) : null;
	const person = c.personId ? S.nameOf(c.personId) : null;
	const company = c.companyId ? S.companies.find((x) => x.id === c.companyId) : null;
	return { id: c.id, kind: t ? t.kind : 'ticket', typeId: c.typeId, typeName: t ? t.name : null, personId: c.personId, personName: person, companyId: c.companyId, companyName: company ? company.name : null, referenceNo: c.referenceNo || '', issueDate: c.issueDate || null, expiryDate: c.expiryDate, daysLeft, status: S.complianceStatus(c.expiryDate) };
};
const complianceDash = () => {
	const counts = {};
	for (const c of S.complianceItems) {
		const v = complianceView(c); if (!v.expiryDate) continue;
		const k = (counts[v.kind] = counts[v.kind] || { overdue: 0, today: 0, within30: 0 });
		if (v.daysLeft < 0) k.overdue += 1; else if (v.daysLeft === 0) k.today += 1; else if (v.daysLeft <= 30) k.within30 += 1;
	}
	return { today: TODAY, activeOnly: true, counts, workers: { ve: S.people.filter((p) => p.is_active && p.person_kind === 'staff').length, other: S.people.filter((p) => p.is_active && p.person_kind !== 'staff').length }, truncated: false };
};

const swmsList = () => S.swms.map((s) => { const t = taskById(s.taskId); const job = jobById(s.jobId); return { id: s.id, status: s.status, jobId: s.jobId, jobName: job ? job.name : null, siteAddress: s.siteAddress, onSite: t ? t.scheduled_date : null, progress: { pm: !!s.signoff.pm, tl: !!s.signoff.tl, crewSigned: s.declarations.length, crewTotal: t ? t.assignees.length : 0 }, task: t ? { id: t.ROWID, name: t.name, stage: t.stage } : null }; });
const swmsView = (s) => ({ id: s.id, jobId: s.jobId, status: s.status, pcbu: s.pcbu, siteAddress: s.siteAddress, ppe: s.ppe, hazards: s.hazards || [], tasks: s.tasks, declarations: s.declarations, signoff: s.signoff });

const checklistView = (c) => {
	const answered = Object.keys(c.answers).length;
	const total = S.checklistDefinition.sections.flatMap((s) => s.questions).filter((q) => !q.showIf).length;
	const next = S.checklistDefinition.sections.flatMap((s) => s.questions).find((q) => !q.showIf && c.answers[q.key] === undefined) || null;
	return { checklist: { id: c.id, taskId: c.taskId, phase: c.phase, status: c.status, role: c.role, hours: c.hours }, definition: S.checklistDefinition, answers: c.answers, progress: { total, answered: Math.min(answered, total), percent: Math.round((Math.min(answered, total) / total) * 100), missing: [], issues: [], canComplete: answered >= total }, next };
};

const templates = ['issueRaised', 'issueUpdated', 'taskSentBack', 'jobClosed', 'equipmentOffHire', 'complianceDue', 'weeklyHours', 'weeklyIssues'].map((name) => ({ name, label: name.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()), placeholders: ['job', 'subject', 'link'], override: name === 'jobClosed' ? { intro: 'Well done team.' } : null }));
let settings = { workshop_job_id: '1001', pay_period: { start_date: days[0], length_days: 14 }, issue_routing: { Install: { manager_id: '502' } }, expiry_reminder_days: [30, 7, 0], pcbu_defaults: { Name: 'Visual Exposure Pty Ltd', Address: '532 Somerville Road, Sunshine West VIC 3020', Phone: '03 9311 5722' }, hours_report_recipients: ['501', '502'], hours_cutoff_date: null };

const RESOURCES = ['jobs', 'tasks', 'sites', 'signs', 'people', 'issues', 'swms', 'compliance', 'equipment', 'devices'];
const matrix = () => Object.fromEntries(RESOURCES.map((r) => [r, Object.fromEntries(S.ROLE_KEYS.map((role) => [role, role === 'admin' ? { verbs: ['view', 'create', 'edit', 'delete'], scope: 'all' } : ['project_manager', 'fab_manager', 'install_coordinator'].includes(role) ? { verbs: ['view', 'create', 'edit'], scope: 'all' } : role === 'viewer' ? { verbs: ['view'], scope: 'all' } : { verbs: ['view'], scope: 'assigned' }]))]));

const SWMS_OPTIONS = {
	hazards: [['falls', 'Risk of a fall of more than 2 metres'], ['confined_space', 'Confined space'], ['electrical', 'On or near energised electrical installations'], ['roads_rail', 'On or near a road, railway or other traffic corridor in use'], ['mobile_plant', 'Movement of powered mobile plant in the area'], ['hot_works', 'Hot works (welding, cutting, grinding)'], ['lifting', 'Crane or lifting operations'], ['dust', 'Dust, fumes or airborne particles'], ['asbestos', 'Likely to disturb asbestos']].map(([key, label]) => ({ key, label })),
	ppe: ['Hard hat', 'Hi-vis vest', 'Safety boots', 'Safety glasses', 'Gloves', 'Hearing protection', 'Dust mask or respirator', 'Harness and fall arrest', 'Sun protection', 'Welding mask or face shield', 'Long sleeves and pants'],
	ppeFor: { falls: ['Harness and fall arrest', 'Hard hat', 'Safety boots'], hot_works: ['Welding mask or face shield', 'Gloves', 'Long sleeves and pants', 'Safety glasses'], roads_rail: ['Hi-vis vest', 'Hard hat', 'Safety boots'], mobile_plant: ['Hi-vis vest', 'Hard hat', 'Safety boots'], dust: ['Dust mask or respirator', 'Safety glasses'], lifting: ['Hard hat', 'Gloves', 'Safety boots'], electrical: ['Gloves', 'Safety glasses'] },
};

const list = (items) => ({ items, count: items.length });
const patch = (obj, body, keys) => { for (const k of keys) if (body[k] !== undefined) obj[k] = body[k]; return obj; };

const routes = [
	// who am I
	['GET', /^\/me$/, () => { const p = S.people.find((x) => x.ROWID === ME); return { user: { id: '1', email: p.email, firstName: p.first_name, lastName: p.last_name }, roles, permissions: { createJob: isManager, editJob: isManager, createTask: isManager, assignPeople: isManager }, person: { ROWID: ME } }; }],
	// jobs
	['GET', /^\/jobs$/, (_, q) => {
		const visible = S.jobs.filter((j) => isManager || S.tasks.some((t) => t.job_id === j.ROWID && mine(t)));
		const done = (j) => j.stage.startsWith('Completed');
		const tab = {
			all: () => true,
			my_open: (j) => j.pm_id === ME && !done(j),
			my_jobs: (j) => j.pm_id === ME || j.fab_manager_id === ME,
			preparation: (j) => j.stage === 'Preparation',
			ongoing: (j) => ['In Progress', 'On Hold'].includes(j.stage),
			completed: done,
		};
		const counts = Object.fromEntries(Object.entries(tab).map(([k, fn]) => [k, visible.filter(fn).length]));
		const needle = (q.get('search') || '').toLowerCase();
		const items = visible.filter((j) => (tab[q.get('view')] || tab.all)(j) && (!q.get('stage') || j.stage === q.get('stage')) && (!q.get('pm_id') || j.pm_id === q.get('pm_id')) && (!q.get('fab_manager_id') || j.fab_manager_id === q.get('fab_manager_id')) && (!needle || j.name.toLowerCase().includes(needle)));
		return {
			items: items.map(({ pm_id, fab_manager_id, ...j }) => {
				const own = S.tasks.filter((t) => t.job_id === j.ROWID);
				const quoted = own.reduce((n, t) => n + Number(t.quoted_hours || 0), 0);
				const booked = own.reduce((n, t) => n + Number(t.booked_hours || 0), 0);
				const risk = [];
				if (quoted > 0 && booked > quoted) risk.push(`Hours ${Math.round(((booked - quoted) / quoted) * 100)}% over quote`);
				if (own.some((t) => t.task_type === 'fabrication' && isLate(t))) risk.push('Fab behind schedule');
				if (own.some((t) => t.task_type === 'install' && isLate(t))) risk.push('Install behind schedule');
				const sumType = (type) => own.filter((t) => t.task_type === type).reduce((n, t) => n + Number(t.booked_hours || 0), 0);
				const rate = isAdmin ? { fab_labour_cost: Math.round(sumType('fabrication') * 38 * 100) / 100, install_labour_cost: Math.round(sumType('install') * 42 * 100) / 100 } : {};
				return { ...j, pm_name: S.nameOf(pm_id), fab_manager_name: S.nameOf(fab_manager_id), quoted_hours: quoted, booked_hours: booked, risk: risk.slice(0, 2), fab_hours_booked: sumType('fabrication'), install_hours_booked: sumType('install'), workdrive_url: j.workdrive_url || (j.ROWID < '1050' ? 'https://workdrive.zoho.com.au/folder/example-' + j.ROWID : ''), job_status: j.job_status || (j.stage === 'Completed - Closed' ? 'Closed' : ''), CREATEDTIME: j.CREATEDTIME || (j.created_date ? j.created_date + ' 09:30:00' : ''), MODIFIEDTIME: j.MODIFIEDTIME || (j.created_date ? j.created_date + ' 16:05:12' : ''), closure_email_sent: j.stage === 'Completed - Closed', ...rate };
			}),
			count: items.length,
			total: items.length,
			counts,
		};
	}],
	['POST', /^\/jobs$/, (_, __, b) => { const j = { ROWID: id(), name: b.name, stage: 'Preparation', crm_deal_id: b.crm_deal_id || '', quote_ref: b.quote_ref || '', pm_id: b.pm_id || ME, fab_manager_id: b.fab_manager_id || null, expected_finish: b.expected_finish || null, agreed_fab_finish: b.agreed_fab_finish || null, required_fab_finish: b.required_fab_finish || null, created_date: TODAY, percent_fab: 0, percent_install: 0, percent_job: 0, server_path: b.server_path || '', description: b.description || '' }; S.jobs.unshift(j); return { job: j }; }],
	['GET', /^\/jobs\/(\d+)\/signs$/, (m) => list(S.signs.filter((s) => s.jobId === m[1]))],
	['GET', /^\/jobs\/(\d+)\/sign-groups$/, (m) => list(S.signGroups.filter((s) => s.jobId === m[1]))],
	['POST', /^\/jobs\/(\d+)\/sync-quotes$/, (m) => ({ synced: S.signGroups.filter((s) => s.jobId === m[1]).length, items: S.signGroups.filter((s) => s.jobId === m[1]) })],
	['POST', /^\/jobs\/(\d+)\/close$/, (m) => { const j = jobById(m[1]); if (j) j.stage = 'Completed - Closed'; return { job: j }; }],
	['POST', /^\/jobs\/(\d+)\/tasks$/, (m, _, b) => { const t = { ROWID: id(), job_id: m[1], task_type: b.task_type, name: b.name, kind: b.kind || null, stage: b.task_type === 'design' ? 'To be Assigned' : 'Awaiting Scheduling', scheduled_date: b.scheduled_date || null, required_finish: b.required_finish || null, quoted_hours: b.quoted_hours || 0, booked_hours: 0, description: b.description || '', swms_id: undefined, assignees: [] }; S.tasks.push(t); return { task: taskView(t) }; }],
	['GET', /^\/jobs\/(\d+)$/, (m) => { const job = jobById(m[1]) || S.jobs[0]; const tasks = S.tasks.filter((t) => t.job_id === job.ROWID); return { job, tasks: tasks.map(taskView), progress: { fab: job.percent_fab, install: job.percent_install, job: job.percent_job }, kpis: kpisFor(job.ROWID) }; }],
	['PATCH', /^\/jobs\/(\d+)$/, (m, _, b) => { const j = jobById(m[1]); patch(j, b, ['name', 'description', 'expected_finish', 'server_path', 'crm_deal_id']); return { job: j }; }],
	// tasks
	['GET', /^\/tasks\/board$/, (_, q) => board(q.get('type') || 'fabrication')],
	['POST', /^\/tasks\/workshop$/, (_, __, b) => { const t = { ROWID: id(), job_id: '1001', task_type: 'fabrication', name: b.name, kind: 'Workshop', stage: 'Awaiting Scheduling', scheduled_date: b.scheduled_date || null, required_finish: null, quoted_hours: 0, booked_hours: 0, description: '', assignees: [] }; S.tasks.push(t); return { task: taskView(t) }; }],
	['GET', /^\/tasks\/(\d+)\/checklist\/next$/, (m) => { const t = taskById(m[1]); const my = S.checklists.filter((c) => c.taskId === m[1] && c.assigneeId === ME); const pre = my.find((c) => c.phase === 'pre'); const post = my.find((c) => c.phase === 'post'); const skip = t && t.kind === 'Workshop'; for (const [phase, c] of skip ? [['post', post]] : [['pre', pre], ['post', post]]) { if (c && c.status === 'Completed') continue; return c ? { phase, action: 'continue', checklistId: c.id, next: checklistView(c).next } : { phase, action: 'start', checklistId: null, next: null }; } return { phase: null, action: 'done', checklistId: null, next: null }; }],
	['GET', /^\/tasks\/(\d+)\/checklists$/, (m) => ({ items: S.checklists.filter((c) => c.taskId === m[1]).map((c) => ({ id: c.id, phase: c.phase, status: c.status, assigneeId: c.assigneeId, role: c.role, hours: c.hours })) })],
	['POST', /^\/tasks\/(\d+)\/checklists$/, (m, _, b) => { const c = { id: id(), taskId: m[1], phase: b.phase, status: 'In Progress', assigneeId: ME, role: 'lead', hours: null, answers: {} }; S.checklists.push(c); return checklistView(c); }],
	['POST', /^\/tasks\/(\d+)\/transition$/, (m, _, b) => { const t = taskById(m[1]); t.stage = b.to; return { task: taskView(t) }; }],
	['POST', /^\/tasks\/(\d+)\/assignees$/, (m, _, b) => { const t = taskById(m[1]); t.assignees.push([b.person_id, b.role]); return { ok: true }; }],
	['DELETE', /^\/tasks\/(\d+)\/assignees\/(\d+)$/, (m) => { const t = taskById(m[1]); t.assignees = t.assignees.filter(([p]) => p !== m[2]); return { removed: true }; }],
	['POST', /^\/tasks\/(\d+)\/hours$/, (m, _, b) => { const t = taskById(m[1]); t.booked_hours = Number(t.booked_hours || 0) + Number(b.hours || 0); return { entry: { hours: b.hours }, task: { bookedHours: t.booked_hours } }; }],
	['POST', /^\/tasks\/(\d+)\/ratings$/, () => ({ ok: true })],
	['POST', /^\/tasks\/(\d+)\/subtasks$/, (m, _, b) => { const p = taskById(m[1]); const t = { ...p, ROWID: id(), name: b.name, stage: 'Awaiting Scheduling', assignees: [], swms_id: undefined }; S.tasks.push(t); return { task: taskView(t) }; }],
	['GET', /^\/tasks\/(\d+)\/history$/, (m) => { const t = taskById(m[1]); return { items: [{ at: now(), from: 'Awaiting Scheduling', to: t ? t.stage : 'Scheduled', comment: null, by: S.nameOf(ME) }], count: 1 }; }],
	['GET', /^\/tasks\/(\d+)$/, (m) => { const t = taskById(m[1]) || S.tasks[0]; return { task: taskView(t), assignees: t.assignees.map(([p, role], i) => ({ linkId: `${t.ROWID}-${i}`, personId: p, role, name: S.nameOf(p) })), nextStages: S.nextStages(t.stage) }; }],
	['PATCH', /^\/tasks\/(\d+)$/, (m, _, b) => { const t = taskById(m[1]); patch(t, b, ['scheduled_date', 'required_finish', 'quoted_hours', 'description', 'name']); return { task: taskView(t) }; }],
	['GET', /^\/tasks$/, (_, q) => {
		let l = S.tasks.filter((t) => isManager || mine(t));
		if (q.get('type')) l = l.filter((t) => t.task_type === q.get('type'));
		return list(l.map((t) => (q.get('detail') ? { ...taskView(t), job_name: (jobById(t.job_id) || {}).name || null, swms_status: t.swms_id ? (S.swms.find((s) => s.id === t.swms_id) || {}).status || null : null, crew: t.assignees.map(([p, role]) => ({ personId: p, name: S.nameOf(p), role })) } : taskView(t))));
	}],
	// checklists
	['GET', /^\/checklists\/(\d+)$/, (m) => checklistView(S.checklists.find((c) => c.id === m[1]) || S.checklists[0])],
	['PATCH', /^\/checklists\/(\d+)\/answers$/, (m, _, b) => { const c = S.checklists.find((x) => x.id === m[1]); Object.assign(c.answers, b.answers); return checklistView(c); }],
	['POST', /^\/checklists\/(\d+)\/complete$/, (m, _, b) => { const c = S.checklists.find((x) => x.id === m[1]); c.status = 'Completed'; if (b.hours) c.hours = b.hours; return checklistView(c); }],
	['GET', /^\/reports\/checklists$/, (_, q) => { let l = S.checklists; if (q.get('phase')) l = l.filter((c) => c.phase === q.get('phase')); if (q.get('status')) l = l.filter((c) => c.status === q.get('status')); return list(l.map((c) => ({ id: c.id, taskId: c.taskId, taskName: (taskById(c.taskId) || {}).name || null, phase: c.phase, status: c.status, assigneeId: c.assigneeId, role: c.role, hours: c.hours }))); }],
	// dashboards and calendar
	['GET', /^\/dashboard$/, () => (isManager ? { scope: 'all', today: TODAY, myTasks: S.tasks.filter((t) => isOpen(t) && t.scheduled_date).slice(0, 5).map(taskView), jobsByStage: Object.fromEntries(['Preparation', 'In Progress', 'On Hold', 'Completed'].map((s) => [s, S.jobs.filter((j) => j.stage === s).length])), overdueTasks: S.tasks.filter(isLate).length, openIssues: S.issues.filter((i) => ['Open', 'In Progress'].includes(i.issue_status)).length, swmsAwaiting: S.swms.filter((s) => ['Created', 'PM Signed'].includes(s.status)).length } : { scope: 'mine', today: TODAY, myTasks: myTasks().map(taskView) })],
	['GET', /^\/dashboard\/todo$/, () => {
		const items = [];
		const swmsOpen = S.swms.filter((s) => ['Created', 'PM Signed'].includes(s.status));
		if (swmsOpen.length) items.push({ id: 'swms', tone: 'danger', title: `${swmsOpen.length} SWMS are waiting for a signature`, detail: `${swmsOpen.filter((s) => s.status === 'Created').length} not signed yet`, to: '/swms', action: 'Open SWMS' });
		S.tasks.filter((t) => t.stage === 'Manager Review').slice(0, 3).forEach((t) => items.push({ id: 'review-' + t.ROWID, tone: 'warn', title: `Review: ${t.name}`, detail: `${t.task_type} task waiting for approval`, to: '/tasks/' + t.ROWID, action: 'Review' }));
		const late = S.tasks.filter(isLate).length;
		if (late) items.push({ id: 'overdue', tone: 'danger', title: `${late} tasks are past the required finish`, detail: '', to: '/tasks', action: 'Open board' });
		S.issues.filter((i) => ['High', 'Urgent'].includes(i.issue_priority) && ['Open', 'In Progress'].includes(i.issue_status)).slice(0, 3).forEach((i) => items.push({ id: 'issue-' + i.ROWID, tone: 'danger', title: `${i.issue_priority} issue: ${i.subject}`, detail: `${i.department} · ${i.issue_status}`, to: '/issues', action: 'Open issues' }));
		const dash = complianceDash();
		const exp = Object.values(dash.counts).reduce((n, c) => n + c.overdue, 0); const soon = Object.values(dash.counts).reduce((n, c) => n + c.today + c.within30, 0);
		if (exp) items.push({ id: 'expired', tone: 'danger', title: `${exp} compliance items have expired`, detail: 'Tickets, inductions or company documents', to: '/compliance', action: 'Open compliance' });
		if (soon) items.push({ id: 'soon', tone: 'warn', title: `${soon} compliance items expire within 30 days`, detail: '', to: '/compliance', action: 'Open compliance' });
		S.tasks.filter((t) => t.task_type === 'install' && t.stage === 'Awaiting Scheduling').slice(0, 3).forEach((t) => items.push({ id: 'schedule-' + t.ROWID, tone: 'info', title: `Schedule: ${t.name}`, detail: 'Install task waiting for a date and a crew', to: '/tasks/' + t.ROWID, action: 'Schedule' }));
		const order = { danger: 0, warn: 1, info: 2 };
		items.sort((a, b) => order[a.tone] - order[b.tone]);
		return { today: TODAY, total: items.length, items, generatedAt: now() };
	}],
	['GET', /^\/dashboards\/(\w+)$/, (m) => ({ role: m[1], today: TODAY, tiles: tilesFor(m[1]) })],
	['GET', /^\/calendar$/, (_, q) => { const kind = q.get('kind'); return { items: S.tasks.filter((t) => t.scheduled_date && (isManager || mine(t)) && (!kind || kind === 'all' || (kind === 'install' ? t.task_type === 'install' && t.kind !== 'External Install' : t.task_type === 'fabrication'))).map((t) => ({ ROWID: t.ROWID, job_id: t.job_id, name: t.name, task_type: t.task_type, stage: t.stage, scheduled_date: t.scheduled_date, kind: t.kind })) }; }],
	// issues
	['GET', /^\/issues\/board$/, () => issueBoard()],
	['GET', /^\/issues\/(\d+)\/history$/, (m) => ({ items: [{ at: now(), changes: [{ field: 'issue_status', from: 'Open', to: (S.issues.find((i) => i.ROWID === m[1]) || {}).issue_status || 'Open' }, { field: 'assigned_to_id', from: '', to: 'Rachel Barnes' }] }, ...issueHistory.filter((h) => h.id === m[1])] })],
	['POST', /^\/issues\/(\d+)\/crm-deal$/, () => ({ created: true, dealId: '4590000000999' })],
	['GET', /^\/issues$/, (_, q) => { let l = S.issues; if (q.get('status')) l = l.filter((i) => i.issue_status === q.get('status')); return list(l.map(issueView)); }],
	['POST', /^\/issues$/, (_, __, b) => { const i = { ROWID: id(), subject: b.subject, department: b.department || 'Management', issue_status: 'Open', issue_priority: b.issue_priority || 'Normal', description: b.description || '', task_id: '', reported_by_id: ME, CREATEDTIME: now() }; S.issues.unshift(i); return { issue: issueView(i) }; }],
	['PATCH', /^\/issues\/(\d+)$/, (m, _, b) => { const i = S.issues.find((x) => x.ROWID === m[1]); if (b.issue_status) { issueHistory.push({ id: m[1], at: now(), changes: [{ field: 'issue_status', from: i.issue_status, to: b.issue_status }] }); i.issue_status = b.issue_status; } return { issue: issueView(i) }; }],
	// swms
	['GET', /^\/swms$/, (_, q) => { let l = swmsList(); const v = q.get('view'); if (v === 'open') l = l.filter((s) => ['Created', 'PM Signed'].includes(s.status)); if (v === 'completed') l = l.filter((s) => ['TL Signed', 'Not Required'].includes(s.status)); return list(l); }],

	['GET', /^\/swms\/(\d+)$/, (m) => { const s = S.swms.find((x) => x.id === m[1]) || S.swms[0]; return { swms: swmsView(s), taskId: s.taskId }; }],
	['PATCH', /^\/swms\/(\d+)$/, (m, _, b) => { const s = S.swms.find((x) => x.id === m[1]); if (b.site_address !== undefined) s.siteAddress = b.site_address; if (b.hazards) s.hazards = b.hazards; if (b.ppe) s.ppe = [...new Set([...s.ppe, ...b.ppe])]; if (b.swms_tasks) s.tasks = b.swms_tasks; return { swms: swmsView(s) }; }],
	['GET', /^\/swms\/options$/, () => SWMS_OPTIONS],
	['POST', /^\/swms\/(\d+)\/sign$/, (m, _, b) => { const s = S.swms.find((x) => x.id === m[1]); const who = (b.typed_name || S.nameOf(ME)); if (b.as === 'pm') { s.signoff.pm = { name: who, at: day(0) }; s.status = 'PM Signed'; } else { s.signoff.tl = { name: who, at: day(0) }; s.status = 'TL Signed'; } return { swms: swmsView(s) }; }],
	['POST', /^\/swms\/(\d+)\/declare$/, (m, _, b) => { const s = S.swms.find((x) => x.id === m[1]); s.declarations.push({ personId: ME, name: b.typed_name || S.nameOf(ME), at: day(0) }); return { swms: swmsView(s) }; }],
	// hours
	['GET', /^\/hours\/(weekly|pay-period)$/, () => hoursReport()],
	['GET', /^\/hours\/not-filled$/, () => ({ personId: ME, workshop: 1, other: 2, total: 3 })],
	// people
	['GET', /^\/roles$/, () => ({ items: S.ROLE_KEYS.map((key) => ({ key, label: key.replace(/_/g, ' ') })) })],
	['GET', /^\/people\/(\d+)\/ratings$/, () => ({ items: [{ taskId: '2007', rating: 5, comment: 'Careful and on time', ratedAt: null }, { taskId: '2008', rating: 4, comment: '', ratedAt: null }, { taskId: '2003', rating: 5, comment: 'Great finish on the frames', ratedAt: null }], count: 3, average: 4.67 })],
	['GET', /^\/people\/(\d+)$/, (m) => ({ person: personRow(S.people.find((p) => p.ROWID === m[1]) || S.people[0]) })],
	['PATCH', /^\/people\/(\d+)$/, (m, _, b) => { const p = S.people.find((x) => x.ROWID === m[1]); for (const k of ['first_name', 'last_name', 'email', 'phone', 'person_kind', 'job_title', 'hourly_rate', 'is_active', 'roles']) if (b[k] !== undefined) p[k] = b[k]; return { person: personRow(p) }; }],
	['GET', /^\/people$/, () => list(S.people.map(personRow))],
	['POST', /^\/people$/, (_, __, b) => { const p = { ROWID: id(), first_name: b.first_name, last_name: b.last_name || '', email: b.email || '', phone: b.phone || '', person_kind: b.person_kind || 'staff', job_title: '', roles: b.roles || [], is_active: true, hourly_rate: 0 }; S.people.push(p); return { person: personRow(p) }; }],
	// compliance
	['GET', /^\/compliance\/dashboard$/, () => complianceDash()],
	['GET', /^\/compliance\/types$/, () => ({ items: S.complianceTypes })],
	['PATCH', /^\/compliance\/(\d+)$/, (m, _, b) => { const c = S.complianceItems.find((x) => x.id === m[1]); if (!c) throw Object.assign(new Error('Not found'), { status: 404 }); if (b.issue_date && b.expiry_date && b.expiry_date < b.issue_date) throw Object.assign(new Error('The expiry date is before the issue date'), { status: 400 }); if (b.reference_no !== undefined) c.referenceNo = b.reference_no; if (b.issue_date !== undefined) c.issueDate = b.issue_date; if (b.expiry_date !== undefined) c.expiryDate = b.expiry_date; return { item: complianceView(c) }; }],
	['GET', /^\/compliance$/, (_, q) => { let l = S.complianceItems.map(complianceView); if (q.get('person_id')) l = l.filter((c) => c.personId === q.get('person_id')); if (q.get('company_id')) l = l.filter((c) => c.companyId === q.get('company_id')); if (q.get('status')) l = l.filter((c) => c.status === q.get('status')); if (!isManager) l = l.filter((c) => c.personId === ME); l.sort((a, b) => (a.expiryDate || '9999').localeCompare(b.expiryDate || '9999')); return list(l); }],
	['POST', /^\/compliance$/, (_, __, b) => { const c = { id: id(), typeId: b.type_id, personId: b.person_id || null, companyId: b.company_id || null, referenceNo: b.reference_no || '', expiryDate: b.expiry_date || null }; S.complianceItems.push(c); return { item: complianceView(c) }; }],
	// directory
	['GET', /^\/companies$/, () => list(S.companies)],
	['POST', /^\/companies$/, (_, __, b) => { const c = { id: id(), name: b.name, kind: b.kind || 'subcontractor', state: b.state || '', contactName: b.contact_name || '', phone: b.phone || '', email: b.email || '', notes: b.notes || '', isActive: true }; S.companies.push(c); return { item: c }; }],
	['GET', /^\/sites$/, () => list(S.sites)],
	['POST', /^\/sites$/, (_, __, b) => { const s = { id: id(), name: b.name, address: [b.street, b.suburb, b.state].filter(Boolean).join(', '), contactName: b.contact_name || '', phone: b.phone || '', isActive: true }; S.sites.push(s); return { item: s }; }],
	['POST', /^\/signs$/, (_, __, b) => { const s = { id: id(), jobId: b.job_id, name: b.name, revision: b.revision || 'A', qty: b.qty || 1, medium: b.medium || '', finishing: b.finishing || '', installDate: null }; S.signs.push(s); return { item: s }; }],
	// assets
	['GET', /^\/equipment$/, () => list(S.equipment)],
	['POST', /^\/equipment\/(\d+)\/checked$/, (m) => { const e = S.equipment.find((x) => x.id === m[1]); if (e) { e.lastChecked = TODAY; e.nextDue = e.frequencyDays ? day(e.frequencyDays) : null; e.overdue = false; e.daysOverdue = 0; } return { item: e }; }],
	['POST', /^\/equipment$/, (_, __, b) => { const e = { id: id(), code: b.code || '', name: b.name, type: b.type || '', locationId: b.location_id || null, locationName: null, status: 'In service', offHireRequired: !!b.off_hire_required, frequencyDays: b.frequency_days || null, lastChecked: null, nextDue: null, overdue: false, daysOverdue: 0 }; S.equipment.push(e); return { item: e }; }],
	['GET', /^\/chemicals$/, () => list(S.chemicals)],
	['GET', /^\/locations$/, () => list(S.locations)],
	['GET', /^\/devices$/, () => list(S.devices)],
	['GET', /^\/files$/, (_, q) => list(S.files.filter((f) => f.entityType === q.get('entity_type') && f.entityId === q.get('entity_id')))],
	// admin
	['POST', /^\/admin\/import\/(people|companies)$/, (m, _, b) => { const bad = []; let created = 0; (b.rows || []).forEach((r, i) => { const key = m[1] === 'people' ? r.first_name : r.name; if (!key) bad.push({ row: i + 1, reason: (m[1] === 'people' ? 'first_name' : 'name') + ': Required' }); else created += 1; }); return { created, skipped: bad }; }],
	['GET', /^\/admin\/settings$/, () => ({ settings, workshopJobName: (jobById(settings.workshop_job_id) || {}).name || null })],
	['PUT', /^\/admin\/settings$/, (_, __, b) => { settings = { ...settings, ...b }; return { settings }; }],
	['GET', /^\/admin\/mail-templates$/, () => ({ items: templates })],
	['PUT', /^\/admin\/mail-templates\/(\w+)$/, (m, _, b) => { const t = templates.find((x) => x.name === m[1]); t.override = Object.values(b).some(Boolean) ? b : null; return { template: t }; }],
	['GET', /^\/admin\/mail-templates\/(\w+)\/preview$/, () => ({ subject: 'Preview', html: '<div style="font-family:Raleway,Arial,sans-serif"><h2 style="margin:0 0 12px">Preview</h2><p>This is how the email looks, with sample data.</p><p><a href="#">Open in Visual Exposure</a></p></div>' })],
	['GET', /^\/admin\/notifications$/, (_, q) => list(S.notifications.filter((n) => !q.get('status') || n.status === q.get('status')))],
	['POST', /^\/admin\/notifications\/\d+\/retry$/, () => ({ sent: true, reason: null })],
	['POST', /^\/admin\/reports\/weekly-(hours|issues)$/, () => ({ ran: true, sent: true })],
	['GET', /^\/admin\/authz$/, () => ({ matrix: matrix(), customised: false, version: 1 })],
	['GET', /^\/admin\/outbox$/, (_, q) => list(S.outbox.filter((o) => !q.get('status') || o.status === q.get('status')))],
	['POST', /^\/admin\/outbox\/(\d+)\/retry$/, (m) => { const o = S.outbox.find((x) => x.id === m[1]); if (o) { o.status = 'Pending'; o.lastError = ''; } return { ok: true }; }],
	['GET', /^\/admin\/integrations$/, () => ({ crm: { configured: true, ok: true, message: 'Connected.' }, workdrive: { configured: true, ok: true, message: 'Connected.' }, workdriveFolder: { configured: true, ok: true, message: 'Folder found: Visual Exposure Jobs' }, workdriveFolderSet: true })],
	['POST', /^\/admin\/crm\/pull-won-deals$/, () => ({ checked: 4, created: 0, skipped: 4 })],
];

function personRow(p) { return { ...p, roles: JSON.stringify(p.roles) }; }

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
		if (hit) {
			try { return send(200, hit[2](path.match(hit[1]), url.searchParams, body)); } catch (err) { console.log('mock error on', req.method, path, err.message); return send(err.status || 500, { code: 'mock_error', message: err.message }); }
		}
		if (req.method !== 'GET') return send(200, { ok: true });
		console.log('mock: no route for', req.method, path);
		return send(200, { items: [], count: 0 });
	});
});
server.listen(3100, () => console.log(`Mock API on http://localhost:3100 (roles: ${roles.join(', ')}; you are ${S.nameOf(ME)})`));