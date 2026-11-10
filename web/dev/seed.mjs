// Sample data for the local mock API: every module has realistic rows (good, late, expired, empty, very long, odd).
// Plain objects in memory; the mock API changes them while it runs and a restart brings them back.

export const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const iso = (n, h = 9) => `${day(n)}T${String(h).padStart(2, '0')}:00:00`;

export const people = [
	{ ROWID: '501', first_name: 'Karen', last_name: 'Wells', email: 'karen.wells@visualexposure.demo', phone: '0400 111 001', person_kind: 'staff', job_title: 'Operations administrator', roles: ['admin'], is_active: true, hourly_rate: 0 },
	{ ROWID: '502', first_name: 'Rachel', last_name: 'Barnes', email: 'rachel.barnes@visualexposure.demo', phone: '0400 111 002', person_kind: 'staff', job_title: 'Project manager', roles: ['project_manager'], is_active: true, hourly_rate: 88 },
	{ ROWID: '503', first_name: 'Helen', last_name: 'Cho', email: 'helen.cho@visualexposure.demo', phone: '0400 111 003', person_kind: 'staff', job_title: 'Project manager', roles: ['project_manager'], is_active: true, hourly_rate: 88 },
	{ ROWID: '504', first_name: 'Tom', last_name: 'Hendry', email: 'tom.hendry@visualexposure.demo', phone: '0400 111 004', person_kind: 'staff', job_title: 'Fabrication manager', roles: ['fab_manager'], is_active: true, hourly_rate: 92 },
	{ ROWID: '505', first_name: 'Greg', last_name: 'Walsh', email: 'greg.walsh@visualexposure.demo', phone: '0400 111 005', person_kind: 'staff', job_title: 'Fabrication manager', roles: ['fab_manager'], is_active: true, hourly_rate: 92 },
	{ ROWID: '506', first_name: 'Mia', last_name: 'Torres', email: 'mia.torres@visualexposure.demo', phone: '0400 111 006', person_kind: 'staff', job_title: 'Fab second in charge', roles: ['second_ic', 'fab_worker'], is_active: true, hourly_rate: 62 },
	{ ROWID: '507', first_name: 'Sam', last_name: 'Taylor', email: 'sam.taylor@visualexposure.demo', phone: '0400 111 007', person_kind: 'staff', job_title: 'Fabricator', roles: ['fab_worker'], is_active: true, hourly_rate: 55 },
	{ ROWID: '508', first_name: 'Dave', last_name: 'Kerr', email: 'dave.kerr@visualexposure.demo', phone: '0400 111 008', person_kind: 'staff', job_title: 'Install team leader', roles: ['installer'], is_active: true, hourly_rate: 64 },
	{ ROWID: '509', first_name: 'Jo', last_name: 'Patel', email: 'jo.patel@visualexposure.demo', phone: '0400 111 009', person_kind: 'staff', job_title: 'Workshop hand', roles: ['workshop'], is_active: true, hourly_rate: 48 },
	{ ROWID: '510', first_name: 'Ben', last_name: 'Okafor', email: 'ben.okafor@visualexposure.demo', phone: '0400 111 010', person_kind: 'staff', job_title: 'Install coordinator', roles: ['install_coordinator'], is_active: true, hourly_rate: 75 },
	{ ROWID: '511', first_name: 'Ravi', last_name: 'Singh', email: 'ravi.singh@brightcrane.example', phone: '0400 111 011', person_kind: 'subcontractor', job_title: 'Crane operator', roles: ['installer'], is_active: true, hourly_rate: 110 },
	{ ROWID: '512', first_name: 'Anitha', last_name: 'Rao-Fernandez-Montgomery', email: 'anitha.rao.with.a.really.long.address@designstudio-example.test', phone: '', person_kind: 'subcontractor', job_title: 'Designer', roles: [], is_active: true, hourly_rate: 70 },
	{ ROWID: '513', first_name: 'Li', last_name: '', email: '', phone: '', person_kind: 'staff', job_title: '', roles: [], is_active: false, hourly_rate: 0 },
];
const fullName = (p) => `${p.first_name} ${p.last_name || ''}`.trim();
export const nameOf = (id) => { const p = people.find((x) => x.ROWID === String(id)); return p ? fullName(p) : null; };

export const companies = [
	{ id: '701', name: 'Northgate Retail Group', kind: 'client', state: 'VIC', contactName: 'Priya Shah', phone: '03 9000 1001', email: 'priya@northgate.example', notes: 'Pylon refresh client.', isActive: true },
	{ id: '702', name: 'Harbourline Logistics', kind: 'client', state: 'VIC', contactName: 'Mark Dunn', phone: '03 9000 1002', email: 'mark@harbourline.example', notes: '', isActive: true },
	{ id: '703', name: 'Metro Rail Alliance', kind: 'client', state: 'VIC', contactName: 'Jess Holt', phone: '03 9000 1003', email: 'jess@metrorail.example', notes: 'Strict site access rules.', isActive: true },
	{ id: '704', name: 'Bright Crane Hire', kind: 'subcontractor', state: 'VIC', contactName: 'Ravi Singh', phone: '0400 111 011', email: 'ravi.singh@brightcrane.example', notes: 'Public liability expires soon.', isActive: true },
	{ id: '705', name: 'Southern Vinyl Supplies', kind: 'supplier', state: 'NSW', contactName: 'Anna Lee', phone: '02 9000 2001', email: 'orders@southernvinyl.example', notes: '', isActive: true },
	{ id: '706', name: 'Visual Exposure Pty Ltd', kind: 'internal', state: 'VIC', contactName: '', phone: '03 9311 5722', email: 'info@visualexposure.com.au', notes: '', isActive: true },
	{ id: '707', name: 'Old Metal Works (closed)', kind: 'supplier', state: 'VIC', contactName: '', phone: '', email: '', notes: 'No longer trading.', isActive: false },
];

export const sites = [
	{ id: '801', name: 'Northgate Mall, car park B', address: '120 Northgate Drive, Epping VIC 3076', contactName: 'Priya Shah', phone: '03 9000 1001', isActive: true },
	{ id: '802', name: 'Harbourline depot', address: '88 Dock Road, Port Melbourne VIC 3207', contactName: 'Mark Dunn', phone: '03 9000 1002', isActive: true },
	{ id: '803', name: 'Metro Tunnel, Anzac station', address: 'St Kilda Road, Melbourne VIC 3004', contactName: 'Jess Holt', phone: '03 9000 1003', isActive: true },
	{ id: '804', name: 'Southern Cross Hardware, Dandenong', address: '5 Industry Way, Dandenong VIC 3175', contactName: '', phone: '', isActive: true },
	{ id: '805', name: 'Eastfield University, main gate', address: '1 University Walk, Hawthorn VIC 3122', contactName: '', phone: '', isActive: false },
];

export const jobs = [
	{ ROWID: '1042', name: 'Northgate Mall Pylon Refresh', stage: 'In Progress', crm_deal_id: '4590000000112', pm_id: '502', fab_manager_id: '504', expected_finish: day(20), created_date: day(-60), percent_fab: 68, percent_install: 0, percent_job: 42, server_path: 'S:\\Jobs\\J-1042 Northgate', description: 'Replace three pylon faces and lighting.' },
	{ ROWID: '1047', name: 'Harbourline Wayfinding', stage: 'In Progress', crm_deal_id: '4590000000187', pm_id: '502', fab_manager_id: '504', expected_finish: day(7), created_date: day(-75), percent_fab: 100, percent_install: 55, percent_job: 78, server_path: 'S:\\Jobs\\J-1047 Harbourline', description: 'Directional signs across the depot.' },
	{ ROWID: '1051', name: 'Metro Tunnel Site Hoardings', stage: 'Preparation', crm_deal_id: '4590000000203', pm_id: '503', fab_manager_id: '505', expected_finish: day(45), created_date: day(-10), percent_fab: 0, percent_install: 0, percent_job: 12, server_path: '', description: '' },
	{ ROWID: '1053', name: 'Southern Cross Façade', stage: 'In Progress', crm_deal_id: '4590000000240', pm_id: '503', fab_manager_id: '505', expected_finish: day(28), created_date: day(-45), percent_fab: 35, percent_install: 0, percent_job: 24, server_path: 'S:\\Jobs\\J-1053 Southern Cross', description: '' },
	{ ROWID: '1058', name: 'Eastfield Building Letters', stage: 'On Hold', crm_deal_id: '4590000000255', pm_id: '502', fab_manager_id: '505', expected_finish: day(3), created_date: day(-90), percent_fab: 100, percent_install: 85, percent_job: 92, server_path: 'S:\\Jobs\\J-1058 Eastfield', description: 'Waiting on council permit.' },
	{ ROWID: '1039', name: 'Westbrook Entry Signage', stage: 'Completed', crm_deal_id: '4590000000090', pm_id: '502', fab_manager_id: '504', expected_finish: day(-12), created_date: day(-120), percent_fab: 100, percent_install: 100, percent_job: 100, server_path: 'S:\\Jobs\\J-1039 Westbrook', description: '' },
	{ ROWID: '1030', name: 'A very long job name that keeps going to test how the table, the header and the breadcrumbs cope with it in a narrow column', stage: 'Completed - Closed', crm_deal_id: '', pm_id: '503', fab_manager_id: '504', expected_finish: day(-150), created_date: day(-220), percent_fab: 100, percent_install: 100, percent_job: 100, server_path: '', description: '' },
	{ ROWID: '1001', name: 'Workshop and Maintenance', stage: 'In Progress', crm_deal_id: '', pm_id: '504', fab_manager_id: '504', expected_finish: '2030-12-31', created_date: day(-30), percent_fab: 0, percent_install: 0, percent_job: 0, server_path: '', description: 'Holds workshop and maintenance tasks.' },
];

let tid = 2000;
const T = (job_id, task_type, name, kind, stage, sched, finish, extra = {}) => ({ ROWID: String(++tid), job_id, task_type, name, kind, stage, scheduled_date: sched, required_finish: finish, quoted_hours: extra.q ?? 0, booked_hours: extra.b ?? 0, description: extra.d || '', swms_id: extra.swms, assignees: extra.who || [] });
export const tasks = [
	T('1042', 'design', 'Pylon face artwork', null, 'Completed', day(-50), day(-45), { q: 12, b: 11, who: [['512', 'lead']] }),
	T('1042', 'fabrication', 'Cut and route ACM faces', 'CNC', 'In Progress', day(-2), day(-1), { q: 30, b: 22, who: [['506', 'lead'], ['507', 'member']] }),
	T('1042', 'fabrication', 'Paint pylon frames', 'Paint', 'Scheduled', day(1), day(6), { q: 24, who: [['507', 'lead']] }),
	T('1042', 'install', 'Install pylon faces', 'VE Install', 'Awaiting Scheduling', null, day(20), { q: 40, swms: '3001', who: [] }),
	T('1047', 'design', 'Sign family artwork', null, 'Completed', day(-70), day(-62), { q: 20, b: 22 }),
	T('1047', 'fabrication', 'Fabricate directional signs', 'Metal', 'Completed', day(-30), day(-20), { q: 60, b: 64, who: [['506', 'lead']] }),
	T('1047', 'install', 'Install block 1 signs', 'VE Install', 'Completed', day(-12), day(-10), { q: 16, b: 15, swms: '3002', who: [['508', 'lead']] }),
	T('1047', 'install', 'Install block 2 signs', 'VE Install', 'In Progress', day(0), day(3), { q: 16, b: 6, swms: '3003', who: [['508', 'lead'], ['511', 'member']] }),
	T('1047', 'install', 'Supplier crane lift', 'External Install', 'Scheduled', day(2), day(4), { q: 8, who: [] }),
	T('1051', 'design', 'Hoarding artwork', null, 'In Progress', day(-3), day(10), { q: 30, b: 8, who: [['512', 'lead']] }),
	T('1051', 'fabrication', 'Print hoarding panels', 'Print', 'Awaiting Scheduling', null, day(30), { q: 40 }),
	T('1053', 'design', 'Façade letter layout', null, 'Manager Review', day(-14), day(-4), { q: 14, b: 16, who: [['512', 'lead']] }),
	T('1053', 'fabrication', 'Cut aluminium letters', 'Metal', 'In Progress', day(-5), day(-3), { q: 80, b: 112, who: [['506', 'lead'], ['507', 'member']] }),
	T('1053', 'fabrication', 'Powder coat letters', 'Paint', 'On Hold', day(3), day(12), { q: 20 }),
	T('1058', 'fabrication', 'Weld letter brackets', 'Metal', 'Manager Review', day(-8), day(-5), { q: 24, b: 25, who: [['507', 'lead']] }),
	T('1058', 'install', 'Install building letters', 'VE Install', 'On Hold', day(4), day(6), { q: 30, b: 12, swms: '3004', who: [['508', 'lead']] }),
	T('1039', 'install', 'Install entry sign', 'VE Install', 'Completed', day(-20), day(-18), { q: 12, b: 12, swms: '3005', who: [['508', 'lead']] }),
	T('1001', 'fabrication', 'Clean the router bed', 'Workshop', 'Scheduled', day(1), day(1), { q: 2, who: [['509', 'lead']] }),
	T('1001', 'fabrication', 'Service the spray booth filters', 'Workshop', 'Awaiting Scheduling', null, day(-3), { q: 3 }),
	T('1001', 'fabrication', 'Weekly sweep and bins', 'Workshop', 'Completed', day(-7), day(-7), { q: 1, b: 1, who: [['509', 'lead']] }),
];

const NEXT = {
	'Awaiting Scheduling': ['Scheduled', 'Cancelled'],
	Scheduled: ['In Progress', 'On Hold', 'Cancelled'],
	'In Progress': ['Manager Review', 'On Hold', 'Cancelled'],
	'On Hold': ['In Progress', 'Cancelled'],
	'Manager Review': ['Completed', 'Rejected'],
	Rejected: ['In Progress'],
	Completed: ['Reopen'],
	Reopen: ['In Progress'],
};
export const nextStages = (stage) => NEXT[stage] || [];

export const issues = [
	{ ROWID: '4001', next_step: 'Order a replacement rack', due_date: iso(3).slice(0, 10), assigned_to_id: '502', subject: 'Ladder rack damaged on van 3', department: 'Install', issue_status: 'In Progress', issue_priority: 'High', description: 'Rack bent after a low clearance strike.', task_id: '', reported_by_id: '508', CREATEDTIME: iso(-4) },
	{ ROWID: '4002', next_step: 'Book the lift for Thursday', due_date: iso(-2).slice(0, 10), billboard_site: 'Panel 12, Citylink', billboard_face: 'North', review_needed: 'Install review', subject: 'Panel 12 face lighting out', department: 'Civic Billboards', issue_status: 'In Progress', issue_priority: 'High', description: '', task_id: '', reported_by_id: '510', CREATEDTIME: iso(-9) },
	{ ROWID: '4003', next_step: 'Order filters', due_date: iso(-1).slice(0, 10), subject: 'Spray booth filter overdue', department: 'Fabrication', issue_status: 'Open', issue_priority: 'High', description: 'Filters past their change date.', task_id: '', reported_by_id: '509', CREATEDTIME: iso(-1) },
	{ ROWID: '4004', subject: 'Wet floor at the loading bay', department: 'Install', issue_status: 'Open', issue_priority: 'Normal', description: '', task_id: '', reported_by_id: '507', CREATEDTIME: iso(-2) },
	{ ROWID: '4005', subject: 'Supplier sent the wrong vinyl colour, please check the order before we cut anything on the next job', department: 'Fabrication', issue_status: 'Resolved', issue_priority: 'Low', description: '', task_id: '', reported_by_id: '506', CREATEDTIME: iso(-20) },
	{ ROWID: '4006', subject: 'Council dispute about billboard height', department: 'Management', issue_status: 'Open', issue_priority: 'Normal', description: 'Needs a manager call.', task_id: '', reported_by_id: '502', CREATEDTIME: iso(-6) },
	{ ROWID: '4007', subject: 'Artwork proof approved late', department: 'Design', issue_status: 'Closed', issue_priority: 'Low', description: '', task_id: '', reported_by_id: '503', CREATEDTIME: iso(-30) },
	{ ROWID: '4008', subject: 'Harness inspection tag missing', department: 'Install', issue_status: 'Open', issue_priority: 'Urgent', description: 'Found at the Anzac site.', task_id: '', reported_by_id: '508', CREATEDTIME: iso(0) },
	{ ROWID: '4009', subject: 'CNC dust extraction noisy', department: 'Fabrication', issue_status: 'Closed', issue_priority: 'Low', description: '', task_id: '', reported_by_id: '507', CREATEDTIME: iso(-40) },
];
const ISSUE_NEXT = { Open: ['In Progress', 'Resolved'], 'In Progress': ['Resolved', 'Open'], Resolved: ['Closed', 'Open'], Closed: ['Open'] };
export const issueNext = (s) => ISSUE_NEXT[s] || [];

export const swms = [
	{ id: '3001', jobId: '1042', taskId: '2004', status: 'Created', pcbu: { Name: 'Visual Exposure Pty Ltd', Address: '532 Somerville Road, Sunshine West VIC 3020' }, siteAddress: '120 Northgate Drive, Epping VIC 3076', ppe: ['Hard hat', 'Hi-vis', 'Safety boots'], tasks: [{ task: 'Isolate the pylon lighting', responsible: 'Team leader' }, { task: 'Lift faces with the crane', responsible: 'Crane operator' }], declarations: [], signoff: {} },
	{ id: '3002', jobId: '1047', taskId: '2007', status: 'TL Signed', pcbu: { Name: 'Visual Exposure Pty Ltd' }, siteAddress: '88 Dock Road, Port Melbourne VIC 3207', ppe: ['Hard hat', 'Hi-vis'], tasks: [{ task: 'Set out sign positions', responsible: 'Team leader' }], declarations: [{ personId: '508', name: 'Dave Kerr', at: day(-13) }], signoff: { pm: { name: 'Rachel Barnes', at: day(-14) }, tl: { name: 'Dave Kerr', at: day(-13) } } },
	{ id: '3003', jobId: '1047', taskId: '2008', status: 'PM Signed', pcbu: { Name: 'Visual Exposure Pty Ltd' }, siteAddress: '88 Dock Road, Port Melbourne VIC 3207', ppe: ['Hard hat', 'Hi-vis', 'Gloves'], tasks: [{ task: 'Drill and fix brackets', responsible: 'Installers' }], declarations: [{ personId: '508', name: 'Dave Kerr', at: day(-1) }], signoff: { pm: { name: 'Rachel Barnes', at: day(-2) } } },
	{ id: '3004', jobId: '1058', taskId: '2016', status: 'Created', pcbu: {}, siteAddress: '', ppe: [], tasks: [], declarations: [], signoff: {} },
	{ id: '3005', jobId: '1039', taskId: '2017', status: 'TL Signed', pcbu: { Name: 'Visual Exposure Pty Ltd' }, siteAddress: '1 Retail Way, Westbrook VIC 3000', ppe: ['Hi-vis'], tasks: [{ task: 'Fix the entry sign', responsible: 'Team leader' }], declarations: [{ personId: '508', name: 'Dave Kerr', at: day(-21) }], signoff: { pm: { name: 'Rachel Barnes', at: day(-22) }, tl: { name: 'Dave Kerr', at: day(-21) } } },
];
// the SWMS ids above are used as the tasks' swms_id; fix the task numbers to match what was generated
for (const s of swms) { const t = tasks.find((x) => x.swms_id === s.id); if (t) s.taskId = t.ROWID; }

export const checklistDefinition = {
	sections: [
		{ key: 'site', title: 'On site', questions: [
			{ key: 'site_safe', label: 'Is the site safe to start work?', type: 'yesno', required: true },
			{ key: 'hazards', label: 'Describe any hazards you found', type: 'text', showIf: { key: 'site_safe', equals: 'no' } },
			{ key: 'weather', label: 'Weather', type: 'choice', options: ['Fine', 'Windy', 'Wet'], required: true },
		] },
		{ key: 'close', title: 'Closure', questions: [
			{ key: 'hours', label: 'Hours worked', type: 'number', required: true },
			{ key: 'photo_done', label: 'Photo of the finished work', type: 'photo', required: true },
		] },
	],
};
export const checklists = [
	{ id: '6001', taskId: '2007', phase: 'pre', status: 'Completed', assigneeId: '508', role: 'lead', hours: null, answers: { site_safe: 'yes', weather: 'Fine' } },
	{ id: '6002', taskId: '2007', phase: 'post', status: 'Completed', assigneeId: '508', role: 'lead', hours: 15, answers: { hours: 15, photo_done: '700000001' } },
	{ id: '6003', taskId: '2008', phase: 'pre', status: 'In Progress', assigneeId: '508', role: 'lead', hours: null, answers: { site_safe: 'yes' } },
	{ id: '6004', taskId: '2002', phase: 'pre', status: 'Completed', assigneeId: '506', role: 'lead', hours: null, answers: { site_safe: 'yes', weather: 'Windy' } },
	{ id: '6005', taskId: '2002', phase: 'post', status: 'In Progress', assigneeId: '507', role: 'member', hours: 6.5, answers: {} },
];

export const complianceTypes = [
	{ id: '901', kind: 'ticket', name: 'White card', requiresExpiry: false, mandatory: true, offsets: [] },
	{ id: '902', kind: 'ticket', name: 'Working at heights', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] },
	{ id: '903', kind: 'ticket', name: 'Forklift licence', requiresExpiry: true, mandatory: false, offsets: [30, 7, 0] },
	{ id: '904', kind: 'ticket', name: 'Elevated work platform', requiresExpiry: true, mandatory: false, offsets: [30, 7] },
	{ id: '905', kind: 'induction', name: 'Site induction: Northgate', requiresExpiry: true, mandatory: false, offsets: [14, 0] },
	{ id: '906', kind: 'induction', name: 'Company safety induction', requiresExpiry: false, mandatory: true, offsets: [] },
	{ id: '907', kind: 'company_document', name: 'Public liability insurance', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] },
	{ id: '908', kind: 'company_document', name: 'WorkCover certificate', requiresExpiry: true, mandatory: true, offsets: [30, 7, 0] },
];
let cid = 1000;
const C = (typeId, personId, companyId, ref, expiry) => ({ id: String(++cid), typeId, personId, companyId, referenceNo: ref, expiryDate: expiry });
export const complianceItems = [
	C('902', '508', null, 'WAH-2291', day(-14)), C('902', '506', null, 'WAH-3110', day(40)), C('902', '507', null, 'WAH-4421', day(12)), C('902', '511', null, 'WAH-5530', day(-3)),
	C('903', '509', null, 'FL-77', day(4)), C('903', '506', null, 'FL-81', day(200)), C('904', '508', null, 'EWP-9', day(25)), C('904', '511', null, 'EWP-12', day(-30)),
	C('901', '507', null, 'WC-2210', null), C('901', '508', null, 'WC-2211', null), C('901', '509', null, 'WC-2212', null), C('901', '506', null, 'WC-2213', null),
	C('905', '507', null, '', day(0)), C('905', '508', null, '', day(90)), C('906', '507', null, '', null), C('906', '508', null, '', null),
	C('907', null, '704', 'PL-9912', day(9)), C('907', null, '705', 'PL-1180', day(300)), C('908', null, '704', 'WC-4410', day(-20)), C('908', null, '701', 'WC-7710', day(60)),
];
export const complianceStatus = (expiry, requires) => {
	if (!expiry) return 'No expiry';
	const d = Math.round((new Date(expiry) - new Date(day(0))) / 864e5);
	return d < 0 ? 'Expired' : d <= 30 ? 'Expiring' : 'Valid';
};

export const locations = [
	{ id: '1101', name: 'Main workshop', description: 'CNC, paint booth and bench area', supervisorId: '504', supervisorName: 'Tom Hendry' },
	{ id: '1102', name: 'Chemical store', description: 'Locked, ventilated', supervisorId: '509', supervisorName: 'Jo Patel' },
	{ id: '1103', name: 'Yard and vehicles', description: '', supervisorId: '510', supervisorName: 'Ben Okafor' },
	{ id: '1104', name: 'Print room', description: 'Large format printers', supervisorId: null, supervisorName: null },
];
export const equipment = [
	{ id: '1201', code: 'CNC-01', name: 'CNC router', type: 'Machine', locationId: '1101', locationName: 'Main workshop', status: 'In service', offHireRequired: false, frequencyDays: 30, lastChecked: day(-12), nextDue: day(18), overdue: false, daysOverdue: 0 },
	{ id: '1202', code: 'SPB-01', name: 'Spray booth', type: 'Machine', locationId: '1101', locationName: 'Main workshop', status: 'In service', offHireRequired: false, frequencyDays: 14, lastChecked: day(-20), nextDue: day(-6), overdue: true, daysOverdue: 6 },
	{ id: '1203', code: 'LAD-07', name: 'Extension ladder 7m', type: 'Ladder', locationId: '1103', locationName: 'Yard and vehicles', status: 'In service', offHireRequired: false, frequencyDays: 90, lastChecked: day(-80), nextDue: day(10), overdue: false, daysOverdue: 0 },
	{ id: '1204', code: 'EWP-02', name: 'Scissor lift (hired)', type: 'Lift', locationId: '1103', locationName: 'Yard and vehicles', status: 'In service', offHireRequired: true, frequencyDays: 30, lastChecked: day(-5), nextDue: day(25), overdue: false, daysOverdue: 0 },
	{ id: '1205', code: 'PRT-01', name: 'Large format printer', type: 'Printer', locationId: '1104', locationName: 'Print room', status: 'Out of service', offHireRequired: false, frequencyDays: 60, lastChecked: day(-70), nextDue: day(-10), overdue: true, daysOverdue: 10 },
	{ id: '1206', code: 'WLD-03', name: 'MIG welder', type: 'Machine', locationId: '1101', locationName: 'Main workshop', status: 'In service', offHireRequired: false, frequencyDays: 30, lastChecked: day(-3), nextDue: day(27), overdue: false, daysOverdue: 0 },
	{ id: '1207', code: 'CRN-01', name: 'Mobile crane (hired)', type: 'Crane', locationId: '1103', locationName: 'Yard and vehicles', status: 'Off hire', offHireRequired: true, frequencyDays: null, lastChecked: null, nextDue: null, overdue: false, daysOverdue: 0 },
	{ id: '1208', code: 'HAR-15', name: 'Safety harness set, a very long name to test how the card and table cope', type: 'PPE', locationId: null, locationName: null, status: 'In service', offHireRequired: false, frequencyDays: 180, lastChecked: day(-170), nextDue: day(10), overdue: false, daysOverdue: 0 },
];
export const chemicals = [
	{ id: '1301', code: 'CH-01', name: 'Acetone', locationId: '1102', locationName: 'Chemical store', sdsUrl: 'https://example.test/sds/acetone.pdf', sdsMissing: false, reviewDate: day(200), reviewDue: false, stock: 12, unit: 'L', hazardClass: 'Flammable liquid' },
	{ id: '1302', code: 'CH-02', name: 'Two-pack paint hardener', locationId: '1102', locationName: 'Chemical store', sdsUrl: '', sdsMissing: true, reviewDate: day(-15), reviewDue: true, stock: 4, unit: 'L', hazardClass: 'Toxic' },
	{ id: '1303', code: 'CH-03', name: 'Vinyl adhesive', locationId: '1104', locationName: 'Print room', sdsUrl: 'https://example.test/sds/adhesive.pdf', sdsMissing: false, reviewDate: day(20), reviewDue: false, stock: 6, unit: 'tubes', hazardClass: '' },
	{ id: '1304', code: 'CH-04', name: 'Isopropyl alcohol', locationId: '1101', locationName: 'Main workshop', sdsUrl: 'https://example.test/sds/ipa.pdf', sdsMissing: false, reviewDate: day(-2), reviewDue: true, stock: 20, unit: 'L', hazardClass: 'Flammable liquid' },
	{ id: '1305', code: 'CH-05', name: 'Degreaser', locationId: null, locationName: null, sdsUrl: '', sdsMissing: true, reviewDate: null, reviewDue: false, stock: null, unit: '', hazardClass: '' },
];
export const devices = [
	{ id: '1401', personName: 'Dave Kerr', model: 'Galaxy Tab Active4', os: 'Android 14', lat: -37.8136, lng: 144.9631, address: 'Collins St, Melbourne VIC', lastSeenAt: iso(0, 8), stale: false, mapUrl: 'https://maps.google.com/?q=-37.8136,144.9631' },
	{ id: '1402', personName: 'Sam Taylor', model: 'iPad 10th gen', os: 'iPadOS 17', lat: -37.7870, lng: 144.8330, address: 'Sunshine West workshop', lastSeenAt: iso(0, 7), stale: false, mapUrl: 'https://maps.google.com/?q=-37.7870,144.8330' },
	{ id: '1403', personName: 'Ravi Singh', model: 'Galaxy A54', os: 'Android 14', lat: -37.9760, lng: 145.2150, address: 'Dandenong', lastSeenAt: iso(-3, 16), stale: true, mapUrl: 'https://maps.google.com/?q=-37.9760,145.2150' },
	{ id: '1404', personName: null, model: 'iPad 9th gen (spare)', os: 'iPadOS 16', lat: null, lng: null, address: '', lastSeenAt: null, stale: true, mapUrl: null },
	{ id: '1405', personName: 'Mia Torres', model: 'Galaxy Tab Active3', os: 'Android 13', lat: -37.7870, lng: 144.8330, address: 'Sunshine West workshop', lastSeenAt: iso(0, 9), stale: false, mapUrl: 'https://maps.google.com/?q=-37.7870,144.8330' },
];

export const signs = [
	{ id: '1501', jobId: '1042', name: 'Pylon face A', revision: 'C', qty: 3, medium: 'ACM', finishing: 'Satin', installDate: day(20) },
	{ id: '1502', jobId: '1042', name: 'Pylon lighting kit', revision: 'A', qty: 1, medium: 'LED', finishing: '', installDate: null },
	{ id: '1503', jobId: '1047', name: 'Directional sign D1 to D12', revision: 'B', qty: 12, medium: 'Aluminium', finishing: 'Powder coat', installDate: day(3) },
	{ id: '1504', jobId: '1047', name: 'Depot entry sign', revision: 'A', qty: 1, medium: 'ACM', finishing: 'Gloss', installDate: day(-10) },
];
export const signGroups = [
	{ id: '1601', jobId: '1042', name: 'Pylon refresh quote', description: 'Q-2291', crmQuoteId: '4590000009911', stage: 'Accepted', truncated: false, totals: { subTotal: 41800, discount: 1800, tax: 4000, adjustment: 0, grandTotal: 44000 }, items: [{ product: 'ACM pylon face', description: '3 x faces, printed', qty: 3, unitPrice: 9800, discount: 600, total: 28800 }, { product: 'LED lighting kit', description: '', qty: 1, unitPrice: 8200, discount: 600, total: 7600 }, { product: 'Install and crane', description: 'One day', qty: 1, unitPrice: 5400, discount: 600, total: 4800 }] },
	{ id: '1602', jobId: '1047', name: 'Wayfinding quote', description: 'Q-2301', crmQuoteId: '4590000009922', stage: 'Accepted', truncated: false, totals: { subTotal: 62500, discount: 0, tax: 6250, adjustment: 0, grandTotal: 68750 }, items: [{ product: 'Directional signs', description: '12 x D-series', qty: 12, unitPrice: 4200, discount: 0, total: 50400 }, { product: 'Install', description: '', qty: 1, unitPrice: 12100, discount: 0, total: 12100 }] },
];

export const files = [
	{ id: '1701', entityType: 'task', entityId: '2007', name: 'block1-before.jpg', kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 2400000, uploaded: true },
	{ id: '1702', entityType: 'task', entityId: '2007', name: 'block1-after.jpg', kind: 'photo', mimeType: 'image/jpeg', sizeBytes: 2600000, uploaded: true },
	{ id: '1703', entityType: 'task', entityId: '2007', name: 'handover-signed.pdf', kind: 'document', mimeType: 'application/pdf', sizeBytes: 480000, uploaded: true },
];

export const notifications = [
	{ id: '1', event: 'issue.raised', status: 'sent', subject: 'New issue: Harness inspection tag missing', recipients: ['rachel.barnes@visualexposure.demo', 'helen.cho@visualexposure.demo'], reason: null, error: null, at: iso(0, 8) },
	{ id: '2', event: 'report.weekly_hours', status: 'failed', subject: 'Weekly hours report: last week', recipients: ['karen.wells@visualexposure.demo'], reason: 'failed', error: 'Invalid login', at: iso(-1, 7) },
	{ id: '3', event: 'compliance.due', status: 'sent', subject: 'Ticket expiring: Working at heights', recipients: ['ben.okafor@visualexposure.demo'], reason: null, error: null, at: iso(-1, 7) },
	{ id: '4', event: 'job.closed', status: 'skipped', subject: 'Job closed: Westbrook Entry Signage', recipients: [], reason: 'no_recipients', error: null, at: iso(-12, 10) },
	{ id: '5', event: 'task.sent_back', status: 'sent', subject: 'Task sent back: Weld letter brackets', recipients: ['sam.taylor@visualexposure.demo'], reason: null, error: null, at: iso(-3, 14) },
];
export const outbox = [
	{ id: '1801', jobType: 'crm.update_deal', entityType: 'job', entityId: '1047', status: 'Done', attempts: 1, nextRunAt: null, lastError: '' },
	{ id: '1802', jobType: 'workdrive.create_job_folder', entityType: 'job', entityId: '1051', status: 'Pending', attempts: 0, nextRunAt: iso(0, 10), lastError: '' },
	{ id: '1803', jobType: 'workdrive.upload_file', entityType: 'file', entityId: '1703', status: 'Failed', attempts: 5, nextRunAt: null, lastError: 'The job folder in WorkDrive is not ready yet' },
	{ id: '1804', jobType: 'crm.update_deal', entityType: 'job', entityId: '1058', status: 'Pending', attempts: 2, nextRunAt: iso(0, 11), lastError: 'Zoho CRM rejected the update: INVALID_DATA' },
];

export const ROLE_KEYS = ['admin', 'project_manager', 'fab_manager', 'install_coordinator', 'second_ic', 'installer', 'fab_worker', 'workshop', 'viewer'];
