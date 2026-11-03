import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ROLES, designTasks, fabTasks, installTasks, seedJobs, seedSwms } from '../data/mockData';
import { TRANSITIONS } from '../lib/workflow';
import { seedHoursLog, seedTimesheets } from '../data/hoursSeed';
import { ISSUE_MANAGERS, seedIssues } from '../data/issuesSeed';
import { VE_NAME, docTypes, inductionTypes, seedCompanies, seedCompanyDocs, seedInductions, seedTickets, seedWorkers, ticketTypes } from '../data/workersSeed';
import { ZERO_PAY, calcPay } from '../lib/payRules';
import { shortName } from '../lib/people';
import { seedChemicals, seedDevices, seedEquipment, seedLocations } from '../data/equipmentSeed';
import { nextToolId, offHireOnFinish } from '../lib/equipment';
import { toKey, today } from '../lib/dates';

const stamp = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const pad = (n) => String(n).padStart(2, '0');
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

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
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg) => setToast({ id: Date.now(), msg }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  const changeRole = useCallback((id) => {
    setRoleId(id);
    try { localStorage.setItem('ve-role', id); } catch { /* storage unavailable */ }
  }, []);

  const addJob = useCallback(({ name, client, finish }) => {
    setJobs((prev) => {
      const next = Math.max(...prev.map((j) => Number(j.id.slice(2)))) + 1;
      return [{ id: `J-${next}`, name, client, stage: 'Preparation', fab: 0, install: 0, job: 0, finish, risk: '', booked: 0, quoted: 0 }, ...prev];
    });
    notify(`Job created: ${name}`);
  }, [notify]);

  const signSwms = useCallback((id, signer) => {
    setSwms((prev) => prev.map((s) => (s.id === id && s.status === 'Created'
      ? { ...s, status: 'PM Signed', pmSignature: { name: signer.name, role: signer.role, signedAt: new Date().toISOString() } }
      : s)));
    notify(`${id} signed by ${signer.name}`);
  }, [notify]);

  const actOnTask = useCallback((id, action, comment = '') => {
    const who = ROLES[roleId].name;
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const step = (TRANSITIONS[t.stage] || []).find((a) => a.action === action);
      if (!step) return t;
      const at = new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const text = comment ? `${action}: ${comment}` : action;
      return { ...t, stage: step.to, history: [{ at, who, text }, ...(t.history || [])] };
    }));
    notify(`${action} done`);
  }, [roleId, notify]);

  const setSubStage = useCallback((id, sub) => {
    const who = ROLES[roleId].name;
    const task = tasks.find((t) => t.id === id);
    // EQP-2: finishing on site sends equipment off hire for linked equipment flagged "off hire required".
    const goingOff = task && sub === 'Finished On Site' ? offHireOnFinish(task, equipment) : [];
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, subStage: sub, offHireSent: t.offHireSent || goingOff.length > 0, history: [{ at: stamp(), who, text: goingOff.length ? `${sub}. Off hire: ${goingOff.map((e) => e.id).join(', ')}` : sub }, ...(t.history || [])] } : t)));
    if (goingOff.length) {
      const ids = goingOff.map((e) => e.id);
      setEquipment((prev) => prev.map((e) => (ids.includes(e.id)
        ? { ...e, status: 'Off hire', history: [{ at: stamp(), who, text: `Off hire after install finished: ${task.name}` }, ...(e.history || [])] } : e)));
      notify(`${sub}. Equipment Off Hire: ${task.name}. Equipment managers would be emailed (demo)`);
    } else notify(sub);
  }, [roleId, tasks, equipment, notify]);

  // Adds hours to the task and rolls them up to its job.
  const bookHours = useCallback((id, hours) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const who = ROLES[roleId].name;
    const add = (n) => Math.round(((n || 0) + hours) * 10) / 10;
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, booked: add(t.booked), history: [{ at: stamp(), who, text: `Booked ${hours}h` }, ...(t.history || [])] } : t)));
    setJobs((prev) => prev.map((j) => (j.id === task.jobId ? { ...j, booked: add(j.booked) } : j)));
    setHoursLog((prev) => [{ id: `H${Date.now()}`, date: toKey(today()), worker: shortName(ROLES[roleId].name), kind: task.kind === 'install' ? 'install' : 'fab', jobId: task.jobId, hours, unbilled: 0 }, ...prev]);
    notify(`${hours}h booked`);
  }, [tasks, roleId, notify]);

  // Creates a fabrication task. With a team leader it starts Scheduled, otherwise Awaiting Scheduling.
  const addTask = useCallback((t) => {
    const who = ROLES[roleId].name;
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === 'fab').map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{
        id: `F${n}`, kind: 'fab', name: t.name, jobId: t.jobId, type: t.type, date: t.date, leader: t.leader || '', member: t.member || '',
        stage: t.leader ? 'Scheduled' : 'Awaiting Scheduling', quoted: t.quoted || 0, booked: 0,
        history: [{ at: stamp(), who, text: 'Task created' }],
      }, ...prev];
    });
    notify(`Fab task created: ${t.name}`);
  }, [roleId, notify]);

  const scheduleTask = useCallback((id, { date, leader, member }) => {
    const who = ROLES[roleId].name;
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, date, leader, member: member || '', stage: 'Scheduled', history: [{ at: stamp(), who, text: `Scheduled for ${leader}` }, ...(t.history || [])] } : t)));
    notify('Task scheduled');
  }, [roleId, notify]);

  // Creates an install task. VE Install and VE Subtask also get a SWMS record waiting for the PM's signature.
  const addInstallTask = useCallback((t) => {
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
  }, [roleId, notify]);

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
    const setup = ISSUE_MANAGERS[i.department];
    const rec = {
      location: '', site: '', direction: '', taskId: '', review: '', completionNotes: '', dateCompleted: '', dueDate: '', history: [], ...i,
      id: '', status: 'To Be discussed', reportedBy: ROLES[roleId].name, date: toKey(today()), assignedTo: setup.manager, notify: setup.also,
    };
    setIssues((prev) => {
      const n = Math.max(0, ...prev.map((x) => Number(x.id.slice(3)) || 0)) + 1;
      return [{ ...rec, id: `IS-${n}` }, ...prev];
    });
    notify(`Issue reported. ${setup.manager} notified${setup.also.length ? `, ${setup.also.join(' and ')} informed` : ''}.`);
  }, [roleId, notify]);

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
    notify(done ? `Issue ${id} completed. Completion email sent (demo).` : `Issue ${id} updated`);
  }, [roleId, notify]);

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
    const who = ROLES[roleId].name;
    setTasks((prev) => {
      const n = Math.max(0, ...prev.filter((x) => x.kind === 'design').map((x) => Number(String(x.id).slice(1)) || 0)) + 1;
      return [{
        id: `D${n}`, kind: 'design', name: t.name, jobId: t.jobId, type: t.type, owner: t.owner, stage: 'Not Started', due: t.due, date: t.due,
        quoted: t.quoted || 0, booked: 0, description: t.description || '', history: [{ at: stamp(), who, text: 'Task created' }],
      }, ...prev];
    });
    notify(`Design task created for ${t.owner}. Folder created (demo).`);
  }, [roleId, notify]);

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
    notify(status === 'Off hire' ? `${id} off hire. Equipment managers would be emailed (demo)` : `${id} back in service`);
  }, [roleId, notify]);

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

  const clientJobs = useMemo(() => jobs.filter((j) => !j.internal), [jobs]);

  const value = useMemo(() => ({
    roleId, role: ROLES[roleId], changeRole, jobs: clientJobs, allJobs: jobs, equipment, completeEquipmentCheck, chemicals, locations, devices, addEquipment, updateEquipment, setEquipmentStatus, addChemical, updateChemical, addLocation, updateLocation, deleteLocation, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, hoursLog, timesheets, checkIn, startBreak, endBreak, checkOut, addTimesheet, issues, addIssue, addIssueUpdate, workers, companies, tickets, inductions, companyDocs, addWorker, addCompany, updateCompliance, addDesignTask, notify, toast, dismissToast,
  }), [roleId, changeRole, clientJobs, jobs, equipment, completeEquipmentCheck, chemicals, locations, devices, addEquipment, updateEquipment, setEquipmentStatus, addChemical, updateChemical, addLocation, updateLocation, deleteLocation, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, hoursLog, timesheets, checkIn, startBreak, endBreak, checkOut, addTimesheet, issues, addIssue, addIssueUpdate, workers, companies, tickets, inductions, companyDocs, addWorker, addCompany, updateCompliance, addDesignTask, notify, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
