import type { MdmSyncResult } from '../api/types';

const n = (v: number | undefined) => v ?? 0;
const plural = (count: number, one: string, many = one + 's') => `${count} ${count === 1 ? one : many}`;

/** One sentence for the result of a device sync from ManageEngine MDM (Admin > Integrations and the Devices page). */
export function mdmSyncText(r: MdmSyncResult): string {
	if (!r.ran) return r.reason || 'The device sync did not run.';
	const parts = [`MDM has ${plural(n(r.fromMdm), 'device')}: ${n(r.added)} added, ${n(r.updated)} updated, ${n(r.unchanged)} unchanged; ${n(r.located)} with a location.`];
	const notMatched = n(r.notInApp) + n(r.notInMdm);
	if (notMatched) {
		const who = r.skippedUsers?.length ? ` (${r.skippedUsers.join(', ')})` : '';
		parts.push(`${plural(notMatched, 'device')} skipped: the MDM user is not a person here with "In MDM" ticked${who}.`);
	}
	if (n(r.noUser)) parts.push(`${plural(n(r.noUser), 'device')} have no user in MDM.`);
	if (n(r.noSerial)) parts.push(`${plural(n(r.noSerial), 'device')} have no serial number.`);
	return parts.join(' ');
}
