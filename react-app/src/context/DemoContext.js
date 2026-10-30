import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ROLES, designTasks, fabTasks, installTasks, seedJobs, seedSwms } from '../data/mockData';
import { TRANSITIONS } from '../lib/workflow';

const stamp = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

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
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, subStage: sub, history: [{ at: stamp(), who, text: sub }, ...(t.history || [])] } : t)));
    notify(sub);
  }, [roleId, notify]);

  // Adds hours to the task and rolls them up to its job.
  const bookHours = useCallback((id, hours) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const who = ROLES[roleId].name;
    const add = (n) => Math.round(((n || 0) + hours) * 10) / 10;
    setTasks((prev) => prev.map((t) => (t.id === id
      ? { ...t, booked: add(t.booked), history: [{ at: stamp(), who, text: `Booked ${hours}h` }, ...(t.history || [])] } : t)));
    setJobs((prev) => prev.map((j) => (j.id === task.jobId ? { ...j, booked: add(j.booked) } : j)));
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
        stage: t.leader ? 'Scheduled' : 'Awaiting Scheduling', swms: needsSwms ? 'Created' : 'Not Required', quoted: t.quoted || 0, booked: 0,
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

  const value = useMemo(() => ({
    roleId, role: ROLES[roleId], changeRole, jobs, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, notify, toast, dismissToast,
  }), [roleId, changeRole, jobs, swms, tasks, addJob, signSwms, actOnTask, setSubStage, bookHours, addTask, scheduleTask, addInstallTask, signSwmsTL, updateSwms, addCrewSignature, notify, toast, dismissToast]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
