import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ROLES, designTasks, fabTasks, installTasks, seedJobs, seedSwms } from '../data/mockData';
import { TRANSITIONS } from '../lib/workflow';
import { crewOf, roleOf, stepTitle, submitBlockReason, taskSwmsStatus, validateStep } from '../lib/checklists';
import { applyAction, subtaskDraft } from '../lib/taskActions';
import { seedChecklistRecords, seedHoursLog, seedTimesheets } from '../data/hoursSeed';
import { DEFAULT_SETTINGS } from '../lib/config';
import { seedIssues } from '../data/issuesSeed';
import { setExpiryDays } from '../lib/compliance';
import { VE_NAME, docTypes, inductionTypes, seedCompanies, seedCompanyDocs, seedInductions, seedTickets, seedWorkers, ticketTypes } from '../data/workersSeed';
import { ZERO_PAY, calcPay } from '../lib/payRules';
import { shortName } from '../lib/people';
import { seedChemicals, seedDevices, seedEquipment, seedLocations } from '../data/equipmentSeed';
import { nextToolId, offHireOnFinish } from '../lib/equipment';
import { toKey, today } from '../lib/dates';
import { canCloseJob, isClosedJob, rollup } from '../lib/jobs';
import { canDeleteAttachment, makeAttachments } from '../lib/attachments';
import { makeNotifications, retried } from '../lib/notifications';
import { cleanRepeat, nextRepeatTask, shouldRepeat } from '../lib/repeat';
import { SEED_NOTIFICATIONS } from '../data/adminSeed';

const stamp = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const CLOSED_JOB_MSG = 'This job is closed, so tasks cannot be added to it.';

// TSK-5 sample attachments. Demo only: names and sizes, no file contents.
const seedAttachments = [
  { id: 'A1', taskId: 'I1', name: 'Level 1-2 install drawing.pdf', size: 482113, by: 'Rachel Barnes', at: '2 Nov, 09:14', synced: true },
  { id: 'A2', taskId: 'F1', name: 'Pylon panel cut file.dxf', size: 91340, by: 'Tom Hendry', at: '30 Oct, 14:02', synced: true },
];

const Ctx = createContext(null);
export const useDemo = () => useContext(Ctx);

// One list for all three task kinds, so one approval flow serves them all.
const seedTasks = () => [
  ...designTasks.map((t) => ({ ...t, kind: 'design', date: t.due, history: [] })),
  ...fabTasks.map((t) => ({ ...t, kind: 'fab', history: [] })),
  ...installTasks.map((t) => ({ ...t, kind: 'install', history: [] })),
];

const readRole = () => {
  try {
    const saved = localStorage.getItem('ve-role');
    return ROLES[saved] ? saved : 'pm';
  } catch {
    return 'pm';
  }
};

export function DemoProvider({ children }) {
  const [roleId, setRoleId] = useState(readRole);
  const [jobs, setJobs] = useState(seedJobs);
  const [swms, setSwms] = useState(seedSwms);
  const [tasks, setTasks] = useState(seedTasks);
  const [hoursLog, setHoursLog] = useState(seedHoursLog);
  const [timesheets, setTimesheets] = useState(seedTimesheets);
  const [issues, setIssues] = useState(seedIssues);
  const [equipment, setEquipment] = useState(seedEquipment);
  const [chemicals, setChemicals] = useState(seedChemicals);
  const [locations, setLocations] = useState(seedLocations);
  const [devices] = useState(seedDevices);
  const [workers, setWorkers] = useState(seedWorkers);
  const [companies, setCompanies] = useState(seedCompanies);
  const [tickets, setTickets] = useState(seedTickets);
  const [inductions, setInductions] = useState(seedInductions);
  const [companyDocs, setCompanyDocs] = useState(seedCompanyDocs);
  const [checklists, setChecklists] = useState(seedChecklistRecords);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [attachments, setAttachments] = useState(seedAttachments);
  const [notifications, setNotifications] = useState(SEED_NOTIFICATIONS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg) => setToast({ id: Date.now(), msg }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  // Notification log (FSD section 8): every email the server would send writes one row per recipient. Demo: nothing is emailed.
  const logNotify = useCallback((event, ctx) => {
    const rows = makeNotifications(event, ctx, settingsRef.current, new Date().toISOString(), Date.now() + Math.floor(Math.random() * 1e6));
    if (rows.length) setNotifications((prev) => [...rows, ...prev].slice(0, 500));
  }, []);
  const retryNotification = useCallback((id) => {
    setNotifications((prev) => prev.map((r) => (r.id === id ? retried(r, new Date().toISOString()) : r)));
    notify('Email sent again (demo)');
  }, [notify]);

  const changeRole = useCallback((id) => {
    setRoleId(id);
    try { localStorage.setItem('ve-role', id); } catch { /* storage unavailable */ }
  }, []);

  const addJob = useCallback(({ name, client, finish }) => {
    setJobs((prev) => {
      const next = Math.max(...prev.map((j) => Number(j.id.slice(2)))) + 1;
      return [{ id: `J-${next}`, name, client, stage: 'Preparation', fab: 0, install: 0, job: 0, finish, risk: '', booked: 0, quoted: 0, pm: roleId === 'pm' ? ROLES.pm.name : '', fabManager: '', fabRequired: '', fabAgreed: '' }, ...prev];
    });
    logNotify('job.created', { job: name, pm: roleId === 'pm' ? ROLES.pm.name : '', ref: name });
    notify(`Job created: ${name}`);
  }, [roleId, logNotify, notify]);

  const signSwms = useCallback((id, signer) => {
    setSwms((prev) => prev.map((s) => (s.id === id && s.status === 'Created'
      ? { ...s, status: 'PM Signed', pmSignature: { name: signer.name, role: signer.role, signedAt: new Date().toISOString() } }
      : s)));
    notify(`${id} signed by ${signer.name}`);
  }, [notify]);

  // One transition from the approval lifecycle. Submit is blocked until every crew closure is done (INS-3).
  // extra is merged into the task, for example the PM review recorded on approval (INS-5).
  const actOnTask = useCallback((id, action, comment = '', extra = null) => {
    const who = ROLES[roleId].name;
    const task = tasks.find((t) => t.id === id);
    const step = task && (TRANSITIONS[task.stage] || []).find((a) => a.action === action);
    if (!step) return false;
    if (action === 'Submit for approval') {
      const why = submitBlockReason(task, checklists);
      if (why) { notify(why); return false; }
    }
    const text = comment ? `${action}: ${comment}` : action;
    setTasks((prev) => prev.map((t) => (t.id !== id ? t : {
      ...t, ...(extra || {}), stage: step.to,
      ...(action === 'Reject' && t.kind === 'install' ? { subStage: 'On Site' } : {}),
      history: [{ at: stamp(), who, text, from: t.stage, to: step.to }, ...(t.history || [])],
    })));
    // A rejection resets the post-job checklists so the crew redo them (WORKFLOWS 4.3).
    if (action === 'Reject') {
      setChecklists((prev) => prev.map((c) => {
        if (c.taskId !== id) return c;
        const { post1, post2, ...keep } = c.steps; // eslint-disable-line no-unused-vars
        return { ...c, steps: keep };
      }));
    }
    const jobPm = jobs.find((j) => j.id === task.jobId)?.pm || '';
    const typeLabel = { install: 'Install', fab: 'Fabrication', design: 'Design' }[task.kind];
    if (action === 'Submit for approval') logNotify('task.submitted', { type: typeLabel, kind: task.kind, pm: jobPm, ref: task.id });
    if (action === 'Reject') logNotify('task.rejected', { type: typeLabel, task: task.name, assignees: [task.leader, task.member].filter(Boolean), ref: task.id });
    const flagged = extra?.pmReview && (extra.pmReview.ohs === 'Yes' || extra.pmReview.mgmtReview);
    notify(flagged ? 'Approved. The installation manager and the inform-also list would be emailed (demo)' : `${action} done`);
    return true;
  }, [roleId, tasks, checklists, jobs, logNotify, notify]);

  const setSubStage = useCallback((id, sub) => {
    const who = ROLES[roleId].name;
    const task = tasks.find((t) => t.id === id);
    // EQP-2: finishing on site sends equipment off hire for linked equipment flagged "off hire required".
    const goingOff = task && sub === 'Finished On Site' ? offHireOnFinish(task, equipment) : [];
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, subStage: sub, offHireSent: t.offHireSent || goingOff.length > 0, history: [{ at: stamp(), who, text: goingOff.length ? `${sub}. Off hire: ${goingOff.map((e) => e.id).join(', ')}` : sub }, ...(t.history || [])] } : t)));
    if (task && sub === 'Finished On Site') {
      logNotify('install.finishedOnSite', { task: task.name, employee: shortName(ROLES[roleId].name), pm: jobs.find((j) => j.id === task.jobId)?.pm || '', ref: task.id });
    }
    if (goingOff.length) {
      logNotify('equipment.offHire', { task: task.name, ref: task.id });
      const ids = goingOff.map((e) => e.id);
      setEquipment((prev) => prev.map((e) => (ids.includes(e.id)
        ? { ...e, status: 'Off hire', history: [{ at: stamp(), who, text: `Off hire after install finished: ${task.name}` }, ...(e.history || [])] } : e)));
      notify(`${sub}. Equipment Off Hire: ${task.name}. Equipment managers would be emailed (demo)`);
    } else notify(sub);
  }, [roleId, tasks, equipment, jobs, logNotify, notify]);

  // Adds hours to the task and rolls them up to its job.
  const bookHours = useCallback((id, hours, unbilled = 0) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const who = ROLES[roleId].name;
    const add = (n) => Math.round(((n || 0) + hours) * 10) / 10;
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, booked: add(t.booked), history: [{ at: stamp(), who, text: `Booked ${hours}h` }, ...(t.history || [])] } : t)));
    setJobs((prev) => prev.map((j) => (j.id === task.jobId ? { ...j, booked: add(j.booked) } : j)));
    setHoursLog((prev) => [{ id: `H${Date.now()}`, date: toKey(today()), worker: shortName(ROLES[roleId].name), kind: task.kind === 'install' ? 'install' : 'fab', jobId: task.jobId, hours, unbilled }, ...prev]);
    notify(`${hours}h booked`);
  }, [tasks, roleId, notify]);

  // Creates a fabrication task. With a team leader it starts Scheduled, otherwise Awaiting Scheduling.
  const addTask = useCallback((t) => {
    if (isClosedJob(jobs.find((j) => j.id === t.jobId))) { notify(CLOSED_JOB_MSG); return false; }
    const who = ROLES[roleId].name;
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === 'fab').map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{
        id: `F${n}`, kind: 'fab', name: t.name, jobId: t.jobId, type: t.type, date: t.date, leader: t.leader || '', member: t.member || '',
        stage: t.leader ? 'Scheduled' : 'Awaiting Scheduling', quoted: t.quoted || 0, booked: 0,
        ...(t.type === 'Workshop' && cleanRepeat(t.repeat) ? { repeat: cleanRepeat(t.repeat) } : {}),
        history: [{ at: stamp(), who, text: 'Task created' }],
      }, ...prev];
    });
    notify(`Fab task created: ${t.name}`);
    return true;
  }, [roleId, jobs, notify]);

  const scheduleTask = useCallback((id, { date, leader, member }) => {
    const who = ROLES[roleId].name;
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, date, leader, member: member || '', stage: 'Scheduled', history: [{ at: stamp(), who, text: `Scheduled for ${leader}` }, ...(t.history || [])] } : t)));
    notify('Task scheduled');
  }, [roleId, notify]);

  // Creates an install task. VE Install and VE Subtask also get a SWMS record waiting for the PM's signature.
  const addInstallTask = useCallback((t) => {
    if (isClosedJob(jobs.find((j) => j.id === t.jobId))) { notify(CLOSED_JOB_MSG); return false; }
    const who = ROLES[roleId].name;
    const needsSwms = ['VE Install', 'VE Subtask'].includes(t.type);
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === 'install').map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{
        id: `I${n}`, kind: 'install', name: t.name, jobId: t.jobId, type: t.type, date: t.date, leader: t.leader || '', member: t.member || '',
        stage: t.leader ? 'Scheduled' : 'Awaiting Scheduling', swms: needsSwms ? 'Created' : 'Not Required', quoted: t.quoted || 0, booked: 0, hiredEquipment: t.hiredEquipment || [],
        history: [{ at: stamp(), who, text: 'Task created' }],
      }, ...prev];
    });
    if (needsSwms) {
      setSwms((prev) => {
        const n = Math.max(0, ...prev.map((s) => Number(s.id.slice(3)) || 0)) + 1;
        return [{ id: `SW-${n}`, title: t.name, jobId: t.jobId, onSite: t.date, hazards: [], status: 'Created', pmSignature: null }, ...prev];
      });
    }
    notify(needsSwms ? `Install task created. SWMS waiting for PM signature.` : `Install task created: ${t.name}`);
    return true;
  }, [roleId, jobs, notify]);

  // Team leader signs at the job briefing (status PM Signed -> TL Signed). The linked install tasks follow.
  const signSwmsTL = useCallback((id, signer) => {
    const rec = swms.find((s) => s.id === id);
    if (!rec || rec.status !== 'PM Signed') return;
    setSwms((prev) => prev.map((s) => (s.id === id
      ? { ...s, status: 'TL Signed', tlSignature: { name: signer.name, role: signer.role, signedAt: new Date().toISOString() } } : s)));
    setTasks((prev) => prev.map((t) => (t.kind === 'install' && t.jobId === rec.jobId && (t.name === rec.title || t.swms === rec.status)
      ? { ...t, swms: 'TL Signed' } : t)));
    notify(`${id} signed by team leader ${signer.name}`);
  }, [swms, notify]);

  const updateSwms = useCallback((id, patch) => {
    setSwms((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    notify('SWMS saved');
  }, [notify]);

  // Crew declaration: other workers on the job sign after the team leader has.
  const addCrewSignature = useCallback((id, name) => {
    setSwms((prev) => prev.map((s) => (s.id === id ? { ...s, crew: [...(s.crew || []), { name, signedAt: new Date().toISOString() }] } : s)));
    notify(`${name} signed the declaration`);
  }, [notify]);

  // ---- Staff timesheet: check in, break, check out. Hours are split by the pay rules in lib/payRules.js ----
  const checkIn = useCallback(() => {
    const worker = shortName(ROLES[roleId].name);
    setTimesheets((prev) => (prev.some((t) => t.worker === worker && t.status !== 'Checked-out') ? prev
      : [{ id: `T${Date.now()}`, worker, date: toKey(today()), start: nowHM(), end: '', breakMins: 0, breakStartedAt: null, status: 'Checked-in', notes: '', ...ZERO_PAY }, ...prev]));
    notify('Checked in');
  }, [roleId, notify]);
  const startBreak = useCallback((id) => {
    setTimesheets((prev) => prev.map((t) => (t.id === id && t.status === 'Checked-in' ? { ...t, status: 'On Break', breakStartedAt: Date.now() } : t)));
    notify('Break started');
  }, [notify]);
  const endBreak = useCallback((id) => {
    setTimesheets((prev) => prev.map((t) => (t.id === id && t.status === 'On Break'
      ? { ...t, status: 'Checked-in', breakMins: t.breakMins + Math.max(1, Math.round((Date.now() - t.breakStartedAt) / 60000)), breakStartedAt: null } : t)));
    notify('Break ended');
  }, [notify]);
  const checkOut = useCallback((id, notes = '') => {
    setTimesheets((prev) => prev.map((t) => {
      if (t.id !== id || t.status === 'Checked-out') return t;
      const end = nowHM();
      const extra = t.status === 'On Break' ? Math.max(1, Math.round((Date.now() - t.breakStartedAt) / 60000)) : 0;
      const breakMins = t.breakMins + extra;
      const pay = calcPay({ date: t.date, start: t.start, end, breakMins }) || ZERO_PAY;
      return { ...t, end, breakMins, breakStartedAt: null, status: 'Checked-out', notes, ...pay };
    }));
    notify('Checked out');
  }, [notify]);
  const addTimesheet = useCallback((entry) => {
    const pay = calcPay(entry) || ZERO_PAY;
    setTimesheets((prev) => [{ id: `T${Date.now()}`, worker: shortName(ROLES[roleId].name), breakStartedAt: null, status: 'Checked-out', ...entry, ...pay }, ...prev]);
    notify('Shift added');
  }, [roleId, notify]);

  // ---- Issues: the department manager is assigned automatically, like the Creator "Assign Manager" workflow ----
  const addIssue = useCallback((i) => {
    const setup = settings.issueRouting[i.department] || { manager: '', also: [] }; // routing is edited in Admin
    const rec = {
      location: '', site: '', direction: '', taskId: '', review: '', completionNotes: '', dateCompleted: '', dueDate: '', history: [], ...i,
      id: '', status: 'To Be discussed', reportedBy: ROLES[roleId].name, date: toKey(today()), assignedTo: setup.manager, notify: setup.also,
    };
    setIssues((prev) => {
      const n = Math.max(0, ...prev.map((x) => Number(x.id.slice(3)) || 0)) + 1;
      return [{ ...rec, id: `IS-${n}` }, ...prev];
    });
    logNotify('issue.reported', { subject: i.subject, department: i.department, reportedBy: ROLES[roleId].name, ref: i.subject });
    notify(`Issue reported. ${setup.manager || 'No manager set'} notified${setup.also.length ? `, ${setup.also.join(' and ')} informed` : ''}.`);
  }, [roleId, settings.issueRouting, logNotify, notify]);

  // ISS-4: create a CRM deal from an issue. Demo: only a deal number is recorded. The real call to Zoho CRM runs on the server later.
  const createCrmDeal = useCallback((id) => {
    const issue = issues.find((x) => x.id === id);
    if (!issue || issue.crmDealId) return false;
    const dealId = `DEAL-${issue.id.replace('IS-', '')}${String(Date.now()).slice(-4)}`;
    setIssues((prev) => prev.map((x) => (x.id !== id ? x : {
      ...x, crmDealId: dealId,
      history: [...x.history, { at: new Date().toISOString(), by: ROLES[roleId].name, personResponsible: x.assignedTo, status: x.status, nextStep: `CRM deal created: ${dealId} (demo)`, workCompleted: '', dueDate: x.dueDate }],
    })));
    notify(`CRM deal ${dealId} created from ${id} (demo)`);
    return true;
  }, [issues, roleId, notify]);

  // One management-history update. The issue's status, next step and due date follow the latest entry.
  const addIssueUpdate = useCallback((id, u) => {
    const done = u.status === 'Completed';
    setIssues((prev) => prev.map((x) => (x.id !== id ? x : {
      ...x,
      status: u.status,
      dueDate: done ? x.dueDate : u.dueDate,
      site: u.site ?? x.site,
      direction: u.direction ?? x.direction,
      dateCompleted: done ? toKey(today()) : '',
      completionNotes: done ? u.workCompleted : '',
      history: [...x.history, { at: new Date().toISOString(), by: ROLES[roleId].name, personResponsible: u.personResponsible, status: u.status, nextStep: u.nextStep, workCompleted: u.workCompleted, dueDate: u.dueDate }],
    })));
    const issue = issues.find((x) => x.id === id);
    if (issue) logNotify(done ? 'issue.completed' : 'issue.updated', { subject: issue.subject, department: issue.department, reportedBy: issue.reportedBy, ref: id });
    notify(done ? `Issue ${id} completed. Completion email sent (demo).` : `Issue ${id} updated`);
  }, [roleId, issues, logNotify, notify]);

  // ---- Workers: adding a worker creates the tickets and inductions they need, like the Creator "create worker ticket" workflow ----
  const addWorker = useCallback((w) => {
    const company = companies.find((c) => c.id === w.companyId);
    const isVe = company?.name === VE_NAME;
    const id = `W-${Math.max(0, ...workers.map((x) => Number(x.id.slice(2)) || 0)) + 1}`;
    const needT = ticketTypes.filter((t) => (isVe ? t.ve : t.nonVe));
    const needI = inductionTypes.filter((t) => (isVe ? t.ve : t.nonVe));
    setWorkers((prev) => [{ ...w, id, active: true, ratings: [] }, ...prev]);
    setTickets((prev) => [...needT.map((t, i) => ({ id: `TK-${Date.now()}-${i}`, workerId: id, typeId: t.id, ref: '', issue: '', expiry: '' })), ...prev]);
    setInductions((prev) => [...needI.map((t, i) => ({ id: `IN-${Date.now()}-${i}`, workerId: id, typeId: t.id, ref: '', issue: '', expiry: '' })), ...prev]);
    notify(`${w.name} added. ${needT.length} tickets and ${needI.length} inductions to fill in.`);
    return id;
  }, [companies, workers, notify]);

  // Adding a company creates the documents every new company must supply.
  const addCompany = useCallback((c) => {
    const id = `C-${Math.max(0, ...companies.map((x) => Number(x.id.slice(2)) || 0)) + 1}`;
    const need = docTypes.filter((d) => d.required);
    setCompanies((prev) => [...prev, { ...c, id, active: true }]);
    setCompanyDocs((prev) => [...need.map((d, i) => ({ id: `CD-${Date.now()}-${i}`, companyId: id, typeId: d.id, name: d.name, issue: '', expiry: '' })), ...prev]);
    notify(`${c.name} added. ${need.length} documents to collect.`);
  }, [companies, notify]);

  const updateCompliance = useCallback((kind, id, patch) => {
    const set = kind === 'ticket' ? setTickets : kind === 'induction' ? setInductions : setCompanyDocs;
    set((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify('Saved');
  }, [notify]);

  // Creates a design task in Not Started. The Creator version also emails the team and creates the WorkDrive folder.
  const addDesignTask = useCallback((t) => {
    if (isClosedJob(jobs.find((j) => j.id === t.jobId))) { notify(CLOSED_JOB_MSG); return false; }
    const who = ROLES[roleId].name;
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === 'design').map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{
        id: `D${n}`, kind: 'design', name: t.name, jobId: t.jobId, type: t.type, owner: t.owner, stage: 'Not Started', due: t.due, date: t.due,
        quoted: t.quoted || 0, booked: 0, description: t.description || '', history: [{ at: stamp(), who, text: 'Task created' }],
      }, ...prev];
    });
    notify(`Design task created for ${t.owner}. Folder created (demo).`);
    return true;
  }, [roleId, jobs, notify]);

  // Marks an equipment check as done today, which pushes the next due date out by the interval.
  const completeEquipmentCheck = useCallback((id) => {
    const who = ROLES[roleId].name;
    setEquipment((prev) => prev.map((e) => (e.id === id
      ? { ...e, lastChecked: toKey(today()), history: [{ at: stamp(), who, text: 'Check completed' }, ...(e.history || [])] } : e)));
    notify(`${id} marked as checked`);
  }, [roleId, notify]);

  // EQP-1: the tool code is assigned automatically. A new item starts with a check dated today.
  const addEquipment = useCallback((e) => {
    const who = ROLES[roleId].name;
    let code = '';
    setEquipment((prev) => {
      code = nextToolId(prev);
      return [...prev, { ...e, id: code, lastChecked: toKey(today()), history: [{ at: stamp(), who, text: 'Added to the register' }] }];
    });
    notify('Equipment added');
  }, [roleId, notify]);

  const updateEquipment = useCallback((id, patch, text = 'Details updated') => {
    const who = ROLES[roleId].name;
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch, history: [{ at: stamp(), who, text }, ...(e.history || [])] } : e)));
    notify('Equipment updated');
  }, [roleId, notify]);

  // EQP-2: the real off-hire email is sent by the server. The demo only shows the toast.
  const setEquipmentStatus = useCallback((id, status) => {
    const who = ROLES[roleId].name;
    setEquipment((prev) => prev.map((e) => (e.id === id ? { ...e, status, history: [{ at: stamp(), who, text: status === 'Off hire' ? 'Marked off hire' : 'Back in service' }, ...(e.history || [])] } : e)));
    if (status === 'Off hire') logNotify('equipment.offHire', { task: id, ref: id });
    notify(status === 'Off hire' ? `${id} off hire. Equipment managers would be emailed (demo)` : `${id} back in service`);
  }, [roleId, logNotify, notify]);

  const addChemical = useCallback((ch) => {
    setChemicals((prev) => [...prev, { ...ch, id: `CH-${Math.max(0, ...prev.map((x) => Number(String(x.id).slice(3)) || 0)) + 1}` }]);
    notify('Chemical added');
  }, [notify]);

  const updateChemical = useCallback((id, patch) => {
    setChemicals((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    notify('Chemical updated');
  }, [notify]);

  const addLocation = useCallback((l) => {
    setLocations((prev) => [...prev, { ...l, id: `L-${Math.max(0, ...prev.map((x) => Number(String(x.id).slice(2)) || 0)) + 1}` }]);
    notify('Location added');
  }, [notify]);

  // A renamed location is renamed on its equipment and chemicals too, so nothing is left pointing at the old name.
  const updateLocation = useCallback((id, patch) => {
    const old = locations.find((x) => x.id === id);
    setLocations((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    if (old && patch.name && patch.name !== old.name) {
      setEquipment((prev) => prev.map((e) => (e.location === old.name ? { ...e, location: patch.name } : e)));
      setChemicals((prev) => prev.map((x) => (x.location === old.name ? { ...x, location: patch.name } : x)));
    }
    notify('Location updated');
  }, [locations, notify]);

  // A location that still holds equipment or chemicals cannot be deleted.
  const deleteLocation = useCallback((id) => {
    const loc = locations.find((x) => x.id === id);
    if (!loc) return false;
    const inUse = equipment.filter((e) => e.location === loc.name).length + chemicals.filter((x) => x.location === loc.name).length;
    if (inUse) { notify(`${loc.name} still holds ${inUse} item${inUse === 1 ? '' : 's'}. Move them first.`); return false; }
    setLocations((prev) => prev.filter((x) => x.id !== id));
    notify('Location deleted');
    return true;
  }, [locations, equipment, chemicals, notify]);

  // CHK-1 to CHK-8: saves one checklist step for one crew member. Returns an error message, or '' when saved.
  // The team leader's steps drive the task's sub-stage (INS-2), and the closure step books the hours (TSK-4).
  const completeChecklistStep = useCallback((taskId, person, key, data) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return 'Task not found.';
    const role = roleOf(task, person);
    const swmsStatus = key === 'pre1' && role === 'TL' && task.type === 'VE Install' ? taskSwmsStatus(task, swms) : undefined;
    const err = validateStep(key, role, data, { kind: task.kind, swmsStatus });
    if (err) return err;

    const who = ROLES[roleId].name;
    const title = stepTitle(task, key);
    const done = { ...data, role, at: new Date().toISOString() };
    setChecklists((prev) => {
      const has = prev.some((c) => c.taskId === taskId && c.person === person);
      if (!has) return [...prev, { taskId, person, role, steps: { [key]: done } }];
      return prev.map((c) => (c.taskId === taskId && c.person === person ? { ...c, steps: { ...c.steps, [key]: done } } : c));
    });
    const log = (text) => ({ at: stamp(), who, text });
    const startNow = task.stage === 'Scheduled' && role === 'TL';
    setTasks((prev) => prev.map((t) => (t.id !== taskId ? t : {
      ...t, ...(startNow ? { stage: 'In Progress' } : {}),
      history: [log(`${person} completed ${title}`), ...(startNow ? [{ ...log('Start'), from: 'Scheduled', to: 'In Progress' }] : []), ...(t.history || [])],
    })));

    if (key === 'post2') bookHours(taskId, Number(data.hours), Number(data.unbilled) || 0);
    if (key === 'post2' && task.kind === 'fab') logNotify('checklist.fabSubmitted', { task: task.name, employee: person, ref: taskId });
    // CHK-5: an OH&S or WHS concern raises an issue for the department manager.
    if (data.ohsConcern === 'Yes') {
      addIssue({
        subject: `${task.kind === 'install' ? 'WHS' : 'OH&S'} concern: ${task.name}`, description: data.ohsDetail.trim(),
        department: task.kind === 'install' ? 'Install' : 'Workshop', priority: 'High', taskId,
        review: task.kind === 'install' ? 'WHS Reported' : 'OH&S Reported',
      });
    }

    // The team leader's steps move the sub-stage. Finished On Site also triggers EQP-2 inside setSubStage.
    const sub = role === 'TL' ? { install: { pre1: 'Team Briefed', pre2: 'On Site', post1: 'Finished On Site' }, fab: { pre1: 'Fabrication Started' } }[task.kind]?.[key] : null;
    if (!data.ohsConcern || data.ohsConcern === 'No') notify(`${title} saved`);
    if (sub) setSubStage(taskId, sub);
    // Fab: once every crew member has closed, the task is ready to submit.
    if (task.kind === 'fab' && key === 'post2') {
      const others = crewOf(task).filter((p) => p !== person);
      if (others.every((p) => checklists.find((c) => c.taskId === taskId && c.person === p)?.steps.post2)) setSubStage(taskId, 'Fabrication Done');
    }
    return '';
  }, [tasks, swms, checklists, roleId, bookHours, addIssue, setSubStage, logNotify, notify]);

  // TSK-2: hold, release, cancel, mark not used, reset assignment and close (external or print only).
  const runTaskAction = useCallback((id, actionId, comment = '') => {
    const task = tasks.find((t) => t.id === id);
    const r = task && applyAction(task, actionId);
    if (!r) return false;
    if (r.action.comment && !comment.trim()) return false;
    const who = ROLES[roleId].name;
    const text = comment.trim() ? `${r.action.label}: ${comment.trim()}` : r.action.label;
    const notUsedInstall = actionId === 'notUsed' && task.kind === 'install' && task.swms === 'Created';
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, ...r.patch, ...(notUsedInstall ? { swms: 'Not Required' } : {}), history: [{ at: stamp(), who, text, from: t.stage, to: r.patch.stage }, ...(t.history || [])] } : t)));
    if (r.dropChecklists) setChecklists((prev) => prev.filter((c) => c.taskId !== id));
    if (notUsedInstall) setSwms((prev) => prev.map((s) => (s.jobId === task.jobId && s.title === task.name && s.status === 'Created' ? { ...s, status: 'Not Required' } : s)));
    notify(`${r.action.label}: done`);
    return true;
  }, [tasks, roleId, notify]);

  // WORKFLOWS section 7: a subtask is created under the root parent, unscheduled, with zero hours.
  const createSubtask = useCallback((id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return false;
    const res = subtaskDraft(task, tasks, jobs.find((j) => j.id === task.jobId));
    if (res.error) { notify(res.error); return false; }
    const who = ROLES[roleId].name;
    const prefix = task.kind === 'install' ? 'I' : 'F';
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === task.kind).map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{ ...res.draft, id: `${prefix}${n}`, history: [{ at: stamp(), who, text: `Subtask created from ${task.id}` }] }, ...prev];
    });
    notify(`Subtask created: ${res.draft.name}`);
    return true;
  }, [tasks, jobs, roleId, notify]);

  // JOB-6: after any task stage change (or a new task), recalculate the job's percentages and stage.
  // The first run only records the starting point, so the sample numbers stay as seeded until a task changes.
  const lastSig = useRef(null);
  useEffect(() => {
    const sigs = {};
    tasks.forEach((t) => { sigs[t.jobId] = `${sigs[t.jobId] || ''}|${t.id}:${t.stage}:${t.quoted || 0}`; });
    const before = lastSig.current;
    lastSig.current = sigs;
    if (!before) return;
    const changed = Object.keys(sigs).filter((id) => sigs[id] !== before[id]);
    if (changed.length === 0) return;
    setJobs((prev) => prev.map((j) => {
      if (!changed.includes(j.id) || j.internal) return j;
      const patch = rollup(j, tasks.filter((t) => t.jobId === j.id));
      return patch ? { ...j, ...patch } : j;
    }));
  }, [tasks]);

  // JOB-5: close a job at 100%. The closure report email is sent once and the CRM deal is updated by the server later.
  const closeJob = useCallback((id) => {
    const job = jobs.find((j) => j.id === id);
    if (!job) return false;
    const chk = canCloseJob(job, roleId);
    if (!chk.ok) { notify(chk.reason); return false; }
    setJobs((prev) => prev.map((j) => (j.id === id
      ? { ...j, stage: 'Completed - Closed', closedAt: toKey(today()), closedBy: ROLES[roleId].name, closureEmailSent: true } : j)));
    logNotify('job.closed', { job: job.name, pm: job.pm, ref: job.id });
    notify(`${job.name} closed. Closure report emailed and CRM deal updated (demo)`);
    return true;
  }, [jobs, roleId, logNotify, notify]);

  // TSK-5: add and remove task attachments. WorkDrive sync is a demo flag until the backend exists.
  const addAttachments = useCallback((taskId, files) => {
    const who = ROLES[roleId].name;
    const made = makeAttachments(taskId, files, who, stamp());
    if (made.length === 0) return false;
    setAttachments((prev) => [...made, ...prev]);
    setTasks((prev) => prev.map((t) => (t.id === taskId
      ? { ...t, history: [{ at: stamp(), who, text: `Attached ${made.map((a) => a.name).join(', ')}` }, ...(t.history || [])] } : t)));
    notify(made.length === 1 ? `Attached ${made[0].name}. Synced to WorkDrive (demo)` : `${made.length} files attached. Synced to WorkDrive (demo)`);
    return true;
  }, [roleId, notify]);

  const deleteAttachment = useCallback((id) => {
    const att = attachments.find((a) => a.id === id);
    const who = ROLES[roleId].name;
    if (!att || !canDeleteAttachment(att, roleId, who)) return false;
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    setTasks((prev) => prev.map((t) => (t.id === att.taskId
      ? { ...t, history: [{ at: stamp(), who, text: `Removed attachment ${att.name}` }, ...(t.history || [])] } : t)));
    notify(`Removed ${att.name}. Removed from WorkDrive (demo)`);
    return true;
  }, [attachments, roleId, notify]);

  // FAB-3: when a repeating workshop task becomes Completed, create the next one (old date plus the interval).
  const prevStages = useRef(null);
  useEffect(() => {
    const map = {};
    tasks.forEach((t) => { map[t.id] = t.stage; });
    const before = prevStages.current;
    prevStages.current = map;
    if (!before) return;
    const due = tasks.filter((t) => before[t.id] && before[t.id] !== 'Completed' && shouldRepeat(t));
    if (due.length === 0) return;
    setTasks((prev) => {
      let n = Math.max(0, ...prev.filter((x) => x.kind === 'fab').map((x) => Number(String(x.id).slice(1)) || 0));
      const made = [];
      const marked = prev.map((t) => {
        if (!due.some((d) => d.id === t.id)) return t;
        n += 1;
        made.push(nextRepeatTask(t, `F${n}`, stamp()));
        return { ...t, repeatSpawned: `F${n}` };
      });
      return [...made, ...marked];
    });
    notify(due.length === 1 ? `${due[0].name} repeats. The next one is created.` : `${due.length} repeating tasks created their next task.`);
  }, [tasks, notify]);

  const updateSettings = useCallback((patch) => setSettings((prev) => ({ ...prev, ...patch })), []);
  // The expiry window is read by lib/compliance.js on every screen, so push the setting there.
  setExpiryDays(settings.expiryDays);

  // HRS-4: a worker fills in hours on a closed post-job checklist that was saved with zero hours. The hours are booked on the task.
  const fillHours = useCallback((taskId, person, hours, confirmed = false) => {
    const task = tasks.find((t) => t.id === taskId);
    const rec = checklists.find((c) => c.taskId === taskId && c.person === person);
    if (!task || !rec || !rec.steps.post2) return 'That checklist was not found.';
    const err = validateStep('post2', rec.role, { hours, unbilled: '', hoursConfirmed: confirmed }, { kind: task.kind });
    if (err) return err;
    setChecklists((prev) => prev.map((c) => (c.taskId === taskId && c.person === person
      ? { ...c, steps: { ...c.steps, post2: { ...c.steps.post2, hours: Number(hours) } } } : c)));
    bookHours(taskId, Number(hours), 0);
    return '';
  }, [tasks, checklists, bookHours]);

  const clientJobs = useMemo(() => jobs.filter((j) => !j.internal), [jobs]);

  const value = useMemo(() => ({
    roleId, role: ROLES[roleId], changeRole, notifications, retryNotification, jobs: clientJobs, allJobs: jobs, equipment, completeEquipmentCheck, chemicals, locations, devices, addEquipment, updateEquipment, setEquipmentStatus, addChemical, updateChemical, addLocation, updateLocation, deleteLocation, checklists, completeChecklistStep, runTaskAction, createSubtask, closeJob, attachments, addAttachments, deleteAttachment, settings, updateSettings, fillHours, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, hoursLog, timesheets, checkIn, startBreak, endBreak, checkOut, addTimesheet, issues, addIssue, addIssueUpdate, createCrmDeal, workers, companies, tickets, inductions, companyDocs, addWorker, addCompany, updateCompliance, addDesignTask, notify, toast, dismissToast,
  }), [roleId, changeRole, notifications, retryNotification, clientJobs, jobs, equipment, completeEquipmentCheck, chemicals, locations, devices, addEquipment, updateEquipment, setEquipmentStatus, addChemical, updateChemical, addLocation, updateLocation, deleteLocation, checklists, completeChecklistStep, runTaskAction, createSubtask, closeJob, attachments, addAttachments, deleteAttachment, settings, updateSettings, fillHours, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, hoursLog, timesheets, checkIn, startBreak, endBreak, checkOut, addTimesheet, issues, addIssue, addIssueUpdate, createCrmDeal, workers, companies, tickets, inductions, companyDocs, addWorker, addCompany, updateCompliance, addDesignTask, notify, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
