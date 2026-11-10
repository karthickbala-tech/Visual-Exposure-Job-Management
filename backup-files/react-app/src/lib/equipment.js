import { addDays, fromKey, toKey } from './dates';

// Next check date = last check + interval. Equipment that is off hire is not checked.
export const nextDue = (e) => toKey(addDays(fromKey(e.lastChecked), e.intervalDays));
export const isOverdue = (e, todayKey) => e.status !== 'Off hire' && nextDue(e) < todayKey;
export const daysOverdue = (e, todayKey) => {
  const ms = fromKey(todayKey) - fromKey(nextDue(e));
  return Math.max(0, Math.round(ms / 86400000));
};

// Tool codes follow the Creator pattern "VE - n". The next code is the highest number in use plus one.
export const nextToolId = (list) => {
  const n = Math.max(100, ...list.map((e) => Number(String(e.id).replace(/\D/g, '')) || 0));
  return `VE - ${n + 1}`;
};

// An SDS needs a link, and a review date in the past means it is due for review.
export const sdsMissing = (c) => !c.sdsUrl;
export const sdsReviewDue = (c, todayKey) => !!c.reviewDate && c.reviewDate < todayKey;

// Only web links are allowed for SDS files, so a pasted "javascript:" address cannot become a clickable link.
export const isWebUrl = (v) => /^https?:\/\/\S+$/i.test(String(v).trim());

// EQP-2: an install task can list the equipment it uses. When the crew marks it "Finished On Site", linked equipment
// flagged "off hire required" and still in service goes off hire, and the equipment managers are emailed once.
export const offHireOnFinish = (task, equipment) => {
  if (task.kind !== 'install' || task.offHireSent) return [];
  return (task.hiredEquipment || [])
    .map((id) => equipment.find((e) => e.id === id))
    .filter((e) => e && e.offHireRequired && e.status === 'In service');
};
