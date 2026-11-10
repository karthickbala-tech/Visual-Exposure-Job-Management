// TSK-5: attachments per task. The demo keeps only the file name and size; real uploads and the WorkDrive sync need the backend.
import { MANAGER_ROLES } from './workflow';

export const formatSize = (bytes) => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// The FSD does not say who may delete. Built as: the person who added it, or a Project Manager or Fab Manager.
export const canDeleteAttachment = (att, roleId, who) => MANAGER_ROLES.includes(roleId) || att.by === who;

export const makeAttachments = (taskId, files, by, at, seed = Date.now()) => files
  .filter((f) => f && f.name)
  .map((f, i) => ({ id: `A${seed.toString(36)}${i}`, taskId, name: f.name, size: f.size || 0, by, at, synced: true }));
