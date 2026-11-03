// TSK-2 and INS-6: the task actions beyond submit, approve, reject and reopen. Pure functions.
import { crewOf } from './checklists';

export const OPEN_STAGES = ['Awaiting Scheduling', 'Scheduled', 'In Progress', 'On Hold'];

// Install external and print-only tasks have no checklists and are closed by the PM (INS-6).
export const isCloseOnly = (task) => task.kind === 'install' && ['External Install', 'Print Only'].includes(task.type);

// Each action: label, the stages it is allowed from, the stage it moves to, and whether a reason is required.
// Fab tasks may be cancelled from Scheduled too (WORKFLOWS section 5). Install tasks only from Awaiting Scheduling (section 4.1).
export function availableActions(task) {
  if (!['install', 'fab'].includes(task.kind)) return [];
  const s = task.stage;
  const out = [];
  if (['Awaiting Scheduling', 'Scheduled', 'In Progress'].includes(s) && !(task.kind === 'fab' && s === 'In Progress')) {
    out.push({ id: 'hold', label: 'Put on hold', to: 'On Hold', comment: true });
  }
  if (s === 'On Hold') out.push({ id: 'release', label: 'Take off hold', to: 'Scheduled', comment: false });
  if (['Awaiting Scheduling', 'Scheduled'].includes(s)) out.push({ id: 'notUsed', label: 'Mark complete - not used', to: 'Complete - Not Used', comment: true });
  if (s === 'Awaiting Scheduling' || (task.kind === 'fab' && s === 'Scheduled')) out.push({ id: 'cancel', label: 'Cancel task', to: 'Cancelled', comment: true, danger: true });
  if (s === 'Scheduled' && crewOf(task).length > 0 && !isCloseOnly(task)) out.push({ id: 'reset', label: 'Reset assignment', to: 'Awaiting Scheduling', comment: true });
  if (isCloseOnly(task) && ['Awaiting Scheduling', 'Scheduled', 'In Progress'].includes(s)) out.push({ id: 'close', label: 'Close task', to: 'Completed', comment: false });
  return out;
}

// The change each action makes to the task. Cancel and not-used clear the assignees (WORKFLOWS section 5).
export function applyAction(task, id) {
  const a = availableActions(task).find((x) => x.id === id);
  if (!a) return null;
  const patch = { stage: a.to };
  if (['cancel', 'notUsed', 'reset'].includes(id)) { patch.leader = ''; patch.member = ''; patch.subStage = ''; }
  if (id === 'cancel') patch.quoted = 0;
  if (id === 'close') patch.subStage = '';
  return { action: a, patch, dropChecklists: ['notUsed', 'reset'].includes(id) };
}

// WORKFLOWS section 7: a subtask hangs off the root parent. A subtask of a closed job is refused.
export function subtaskDraft(task, allTasks, job) {
  if (!['install', 'fab'].includes(task.kind)) return { error: 'Only install and fabrication tasks can have subtasks.' };
  if (job && job.stage === 'Completed - Closed') return { error: 'This job is closed. Reopen it before adding a subtask.' };
  const rootId = task.parentId || task.id;
  const root = allTasks.find((t) => t.id === rootId) || task;
  const base = {
    kind: task.kind, name: `${root.name} - Subtask`, jobId: task.jobId, parentId: rootId, date: task.date,
    leader: '', member: '', stage: 'Awaiting Scheduling', quoted: 0, booked: 0, subStage: '',
  };
  if (task.kind === 'install') return { draft: { ...base, type: 'VE Subtask', swms: root.swms || 'Not Required' } };
  return { draft: { ...base, type: task.type } };
}
