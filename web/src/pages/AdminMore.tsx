import { useEffect, useState } from 'react';
import { Mail, RotateCw } from 'lucide-react';
import { useJobs, usePeople } from '../api/queries';
import { previewTemplate, useMailTemplates, useNotifications, useRetryNotification, useRoles, useRunReport, useSaveSettings, useSaveTemplate, useSettings, useUpdatePerson } from '../api/more';
import type { AppSettings, MailTemplate } from '../api/more';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card } from '../components/ui';

const DEPARTMENTS = ['Install', 'Civic Billboards', 'Workshop', 'Management', 'VT/Digital Screens'];
const fullName = (p: { first_name: string; last_name?: string }) => `${p.first_name} ${p.last_name ?? ''}`.trim();
const errText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
const parseRoles = (v: unknown): string[] => {
	try {
		const list = typeof v === 'string' ? JSON.parse(v) : v;
		return Array.isArray(list) ? list.map(String) : [];
	} catch {
		return [];
	}
};

/** Settings an administrator can change: pay period, workshop job, issue routing, reminders, company details, report recipients. */
export function SettingsTab() {
	const q = useSettings();
	const save = useSaveSettings();
	const people = usePeople(true);
	const jobs = useJobs();
	const { notify } = useToast();
	const [s, setS] = useState<AppSettings>({});
	const [pcbu, setPcbu] = useState('');
	const [days, setDays] = useState('');

	useEffect(() => {
		if (!q.data) return;
		setS(q.data.settings);
		setPcbu(Object.entries(q.data.settings.pcbu_defaults ?? {}).map(([k, v]) => `${k}: ${v}`).join('\n'));
		setDays((q.data.settings.expiry_reminder_days ?? []).join(', '));
	}, [q.data]);

	const submit = () => {
		const pcbuObj: Record<string, string> = {};
		for (const line of pcbu.split('\n')) {
			const i = line.indexOf(':');
			if (i > 0 && line.slice(i + 1).trim()) pcbuObj[line.slice(0, i).trim()] = line.slice(i + 1).trim();
		}
		const dayList = days.split(',').map((d) => d.trim()).filter(Boolean).map(Number);
		if (dayList.some((d) => !Number.isInteger(d) || d < 0)) return notify('Reminder days must be whole numbers, like 30, 7, 0', 'error');
		save.mutate(
			{ ...s, pcbu_defaults: Object.keys(pcbuObj).length ? pcbuObj : null, expiry_reminder_days: dayList.length ? dayList : null },
			{ onSuccess: () => notify('Settings saved'), onError: (e) => notify(errText(e), 'error') },
		);
	};
	const route = (d: string) => s.issue_routing?.[d] ?? {};
	const setRoute = (d: string, patch: { manager_id?: string | null; inform_also?: string[] }) => setS({ ...s, issue_routing: { ...(s.issue_routing ?? {}), [d]: { ...route(d), ...patch } } });
	const list = people.data?.items ?? [];

	if (q.isPending) return <p role="status" className="table-empty">Loading settings…</p>;
	if (q.isError) return <p role="alert">Could not load settings.</p>;
	return (
		<div className="stack">
			<Card title="Hours and workshop">
				<div className="inline-form" style={{ background: 'transparent', border: 0, padding: 0 }}>
					<label><span className="toolbar__label">Pay period starts on</span><input type="date" value={s.pay_period?.start_date ?? ''} onChange={(e) => setS({ ...s, pay_period: e.target.value ? { start_date: e.target.value, length_days: s.pay_period?.length_days ?? 14 } : null })} /></label>
					<label><span className="toolbar__label">Length (days)</span><input type="number" min={7} max={31} value={s.pay_period?.length_days ?? 14} disabled={!s.pay_period} onChange={(e) => setS({ ...s, pay_period: s.pay_period ? { ...s.pay_period, length_days: Number(e.target.value) } : null })} /></label>
					<label><span className="toolbar__label">Ignore work before</span><input type="date" value={s.hours_cutoff_date ?? ''} onChange={(e) => setS({ ...s, hours_cutoff_date: e.target.value || null })} /></label>
					<label><span className="toolbar__label">Workshop job</span>
						<select value={s.workshop_job_id ?? ''} onChange={(e) => setS({ ...s, workshop_job_id: e.target.value || null })}>
							<option value="">Not set</option>
							{(jobs.data?.items ?? []).map((j) => <option key={j.ROWID} value={j.ROWID}>{j.name}</option>)}
						</select>
					</label>
				</div>
			</Card>

			<Card title="Who hears about issues">
				<p className="lead">For each department, choose the manager. A department with none goes to every project manager.</p>
				<div className="inline-form" style={{ background: 'transparent', border: 0, padding: '12px 0 0' }}>
					{DEPARTMENTS.map((d) => (
						<label key={d}><span className="toolbar__label">{d}</span>
							<select value={route(d).manager_id ?? ''} onChange={(e) => setRoute(d, { manager_id: e.target.value || null })}>
								<option value="">All project managers</option>
								{list.map((p) => <option key={p.ROWID} value={p.ROWID}>{fullName(p)}</option>)}
							</select>
						</label>
					))}
				</div>
			</Card>

			<Card title="Reminders and reports">
				<div className="inline-form" style={{ background: 'transparent', border: 0, padding: 0 }}>
					<label><span className="toolbar__label">Reminder days before expiry</span><input value={days} onChange={(e) => setDays(e.target.value)} placeholder="30, 7, 0" /></label>
					<fieldset style={{ flex: '2 1 280px', border: 0, padding: 0, margin: 0 }}>
						<legend className="toolbar__label">Weekly hours report goes to</legend>
						<div className="check-list">
							{list.map((p) => {
								const on = (s.hours_report_recipients ?? []).includes(p.ROWID);
								return (
									<label key={p.ROWID} className="check">
										<input type="checkbox" checked={on} onChange={(e) => setS({ ...s, hours_report_recipients: e.target.checked ? [...(s.hours_report_recipients ?? []), p.ROWID] : (s.hours_report_recipients ?? []).filter((x) => x !== p.ROWID) })} />
										{fullName(p)}
									</label>
								);
							})}
						</div>
					</fieldset>
				</div>
			</Card>

			<Card title="Company details on every SWMS">
				<label><span className="toolbar__label">One per line, like "Name: Visual Exposure Pty Ltd"</span><textarea rows={5} value={pcbu} onChange={(e) => setPcbu(e.target.value)} /></label>
			</Card>

			<div className="actions"><button className="btn" onClick={submit} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save settings'}</button></div>
		</div>
	);
}

/** Edit the subject, intro and footer of each email, and preview it. */
export function EmailsTab() {
	const q = useMailTemplates();
	const [open, setOpen] = useState<string | null>(null);
	if (q.isPending) return <p role="status" className="table-empty">Loading emails…</p>;
	if (q.isError) return <p role="alert">Could not load the emails.</p>;
	return (
		<div className="stack">
			<p className="lead">Change the wording of an email. Use the placeholders shown for each one. Clearing all three boxes goes back to the original.</p>
			{q.data.items.map((t) => (
				<TemplateCard key={t.name} t={t} open={open === t.name} onToggle={() => setOpen(open === t.name ? null : t.name)} />
			))}
		</div>
	);
}

function TemplateCard({ t, open, onToggle }: { t: MailTemplate; open: boolean; onToggle: () => void }) {
	const save = useSaveTemplate();
	const { notify } = useToast();
	const [subject, setSubject] = useState(t.override?.subject ?? '');
	const [intro, setIntro] = useState(t.override?.intro ?? '');
	const [footer, setFooter] = useState(t.override?.footer ?? '');
	const [html, setHtml] = useState<string | null>(null);
	return (
		<Card title={t.label} action={<button className="btn btn-ghost btn-sm" onClick={onToggle} aria-expanded={open}>{open ? 'Close' : t.override ? 'Edit (changed)' : 'Edit'}</button>}>
			{open && (
				<div className="stack">
					<p className="muted">Placeholders: {t.placeholders.map((p) => `{${p}}`).join(' ') || 'none'}</p>
					<label><span className="toolbar__label">Subject</span><input value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} /></label>
					<label><span className="toolbar__label">Intro</span><textarea rows={2} maxLength={600} value={intro} onChange={(e) => setIntro(e.target.value)} /></label>
					<label><span className="toolbar__label">Footer</span><textarea rows={2} maxLength={600} value={footer} onChange={(e) => setFooter(e.target.value)} /></label>
					<div className="actions">
						<button className="btn" disabled={save.isPending} onClick={() => save.mutate({ name: t.name, subject: subject.trim() || null, intro: intro.trim() || null, footer: footer.trim() || null }, { onSuccess: () => notify('Email saved'), onError: (e) => notify(errText(e), 'error') })}>Save</button>
						<button className="btn btn-ghost" onClick={() => previewTemplate(t.name).then((r) => setHtml(r.html)).catch((e) => notify(errText(e), 'error'))}>Preview saved version</button>
					</div>
					{html && <iframe title={`Preview of ${t.label}`} className="mail-preview" sandbox="" srcDoc={html} />}
				</div>
			)}
		</Card>
	);
}

/** Every email the system sent (or tried to), with a retry for failed ones, and buttons to run the weekly reports now. */
export function NotificationsTab() {
	const [status, setStatus] = useState('');
	const q = useNotifications(status);
	const retry = useRetryNotification();
	const run = useRunReport();
	const { notify } = useToast();
	return (
		<Card flush title="Email log" action={
			<div className="actions">
				<button className="btn btn-ghost btn-sm" disabled={run.isPending} onClick={() => run.mutate('weekly-hours', { onSuccess: (r) => notify(r.ran ? 'Hours report sent' : String(r.reason ?? 'Nothing sent')), onError: (e) => notify(errText(e), 'error') })}><Mail size={14} aria-hidden="true" /> Send hours report</button>
				<button className="btn btn-ghost btn-sm" disabled={run.isPending} onClick={() => run.mutate('weekly-issues', { onSuccess: () => notify('Issues report run'), onError: (e) => notify(errText(e), 'error') })}><Mail size={14} aria-hidden="true" /> Send issues report</button>
			</div>
		}>
			<div className="inline-form">
				<label style={{ flex: '0 1 200px' }}><span className="toolbar__label">Outcome</span>
					<select value={status} onChange={(e) => setStatus(e.target.value)}>
						<option value="">All</option><option value="sent">Sent</option><option value="skipped">Skipped</option><option value="failed">Failed</option><option value="retried">Retried</option>
					</select>
				</label>
			</div>
			{q.isPending && <p role="status" className="table-empty">Loading…</p>}
			{q.isError && <p role="alert">Could not load the log.</p>}
			{q.isSuccess && q.data.items.length === 0 && <p className="table-empty">No emails yet.</p>}
			{q.isSuccess && q.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Emails</caption>
						<thead><tr><th scope="col">When</th><th scope="col">Email</th><th scope="col">To</th><th scope="col">Outcome</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
						<tbody>
							{q.data.items.map((n) => (
								<tr key={n.id}>
									<td data-label="When">{n.at?.replace('T', ' ').slice(0, 16) ?? '-'}</td>
									<td data-label="Email" className="cell-primary"><strong>{n.subject}</strong><br /><small>{n.event}</small></td>
									<td data-label="To">{n.recipients.length}</td>
									<td data-label="Outcome"><span className={'chip chip-' + (n.status === 'sent' ? 'green' : n.status === 'failed' ? 'red' : 'gray')}>{n.status}</span>{n.reason ? <small> {n.reason}</small> : null}</td>
									<td data-label="Actions">{n.status === 'failed' && <button className="btn btn-ghost btn-sm" disabled={retry.isPending} onClick={() => retry.mutate(n.id, { onSuccess: (r) => notify(r.sent ? 'Sent again' : 'Still not sent', r.sent ? 'ok' : 'error') })}><RotateCw size={14} aria-hidden="true" /> Retry</button>}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

/** Roles and the active switch for each person. Only an administrator; nobody can lock themselves out (the server checks). */
export function RolesTab() {
	const people = usePeople(true);
	const roles = useRoles();
	const update = useUpdatePerson();
	const { notify } = useToast();
	if (people.isPending || roles.isPending) return <p role="status" className="table-empty">Loading…</p>;
	if (people.isError || roles.isError) return <p role="alert">Could not load people.</p>;
	return (
		<Card flush title="People and roles">
			<div className="table-wrap">
				<table className="table">
					<caption className="sr-only">Roles</caption>
					<thead><tr><th scope="col">Person</th><th scope="col">Roles</th><th scope="col">Active</th></tr></thead>
					<tbody>
						{people.data.items.map((p) => {
							const mine = parseRoles(p.roles);
							return (
								<tr key={p.ROWID}>
									<td data-label="Person" className="cell-primary"><strong>{fullName(p)}</strong><br /><small>{p.email}</small></td>
									<td data-label="Roles">
										<div className="chips-row">
											{roles.data.items.map((r) => (
												<label key={r.key} className={'role-pick' + (mine.includes(r.key) ? ' on' : '')}>
													<input type="checkbox" checked={mine.includes(r.key)} onChange={(e) => update.mutate({ id: p.ROWID, roles: e.target.checked ? [...mine, r.key] : mine.filter((x) => x !== r.key) }, { onSuccess: () => notify('Roles updated'), onError: (er) => notify(errText(er), 'error') })} />
													{r.label}
												</label>
											))}
										</div>
									</td>
									<td data-label="Active">
										<button className="btn btn-ghost btn-sm" onClick={() => update.mutate({ id: p.ROWID, is_active: p.is_active === false }, { onSuccess: () => notify('Saved'), onError: (er) => notify(errText(er), 'error') })}>
											<Chip status={p.is_active === false ? 'Inactive' : 'Active'} />
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</Card>
	);
}
