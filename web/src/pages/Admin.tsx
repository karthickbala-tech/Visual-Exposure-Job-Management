import { useEffect, useState } from 'react';
import { RotateCw } from 'lucide-react';
import { useAuthz, useCheckIntegrations, usePullWonDeals, useMe, useOutbox, useRetryOutbox, useSaveAuthz } from '../api/queries';
import type { Matrix, Scope, Verb } from '../api/types';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';
import { EmailsTab, NotificationsTab, RolesTab, SettingsTab } from './AdminMore';

const VERBS: Verb[] = ['view', 'create', 'edit', 'delete'];
const SCOPES: Scope[] = ['all', 'assigned', 'own'];
const SCOPE_LABEL: Record<Scope, string> = { all: 'All records', assigned: 'Assigned to them', own: 'Their own' };
const RESOURCES = ['jobs', 'tasks', 'sites', 'signs', 'people', 'issues', 'swms', 'compliance', 'equipment', 'devices'];

const TAB_LABEL = { permissions: 'Permissions', settings: 'Settings', roles: 'Roles', emails: 'Emails', log: 'Email log', outbox: 'Outbox', integrations: 'Integrations' } as const;

/** Administrator tools: who can do what, and the queue of work waiting to reach other systems. */
export function Admin() {
	const me = useMe();
	const [tab, setTab] = useState<'permissions' | 'settings' | 'roles' | 'emails' | 'log' | 'outbox' | 'integrations'>('permissions');
	if (me.isSuccess && !me.data.roles.includes('admin')) {
		return (
			<>
				<PageHeader eyebrow="Administration" title="Admin" />
				<p className="table-empty">Only an administrator can open this page.</p>
			</>
		);
	}
	return (
		<>
			<PageHeader eyebrow="Administration" title="Admin" subtitle="Permissions, settings, emails and the queue of work for other systems." />
			<div className="inline-form" role="tablist" aria-label="Admin">
				{(['permissions', 'settings', 'roles', 'emails', 'log', 'outbox', 'integrations'] as const).map((t) => (
					<button key={t} role="tab" aria-selected={tab === t} className={'btn' + (tab === t ? '' : ' btn-ghost')} onClick={() => setTab(t)}>
						{TAB_LABEL[t]}
					</button>
				))}
			</div>
			{tab === 'permissions' ? <Permissions /> : tab === 'settings' ? <SettingsTab /> : tab === 'roles' ? <RolesTab /> : tab === 'emails' ? <EmailsTab /> : tab === 'log' ? <NotificationsTab /> : tab === 'outbox' ? <Outbox /> : <Integrations />}
		</>
	);
}

function Permissions() {
	const authz = useAuthz();
	const save = useSaveAuthz();
	const { notify } = useToast();
	const [matrix, setMatrix] = useState<Matrix | null>(null);
	const [role, setRole] = useState('');

	useEffect(() => {
		if (authz.data) {
			setMatrix(structuredClone(authz.data.matrix));
			setRole((r) => r || Object.keys(authz.data.matrix).find((k) => k !== 'admin') || '');
		}
	}, [authz.data]);

	if (authz.isPending) return <p role="status" className="table-empty">Loading…</p>;
	if (authz.isError || !matrix) return <p role="alert">Could not load permissions.</p>;

	const roles = Object.keys(matrix).filter((r) => r !== 'admin');
	const grants = matrix[role] ?? {};
	const toggle = (res: string, verb: Verb) => {
		const g = grants[res] ?? { verbs: [], scope: 'all' as Scope };
		const verbs = g.verbs.includes(verb) ? g.verbs.filter((v) => v !== verb) : [...g.verbs, verb];
		const nextGrants = { ...grants };
		if (verbs.length === 0) delete nextGrants[res];
		else nextGrants[res] = { ...g, verbs };
		setMatrix({ ...matrix, [role]: nextGrants });
	};
	const setScope = (res: string, scope: Scope) => setMatrix({ ...matrix, [role]: { ...grants, [res]: { ...grants[res], scope } } });

	return (
		<Card flush>
			<div className="inline-form">
				<label style={{ flex: '0 1 240px' }}>
					<span className="toolbar__label">Role</span>
					<select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%' }}>
						{roles.map((r) => (
							<option key={r} value={r}>
								{r.replace(/_/g, ' ')}
							</option>
						))}
					</select>
				</label>
				<button className="btn" disabled={save.isPending} onClick={() => save.mutate(matrix, { onSuccess: () => notify('Permissions saved. They apply within five minutes.') })}>
					{save.isPending ? 'Saving…' : 'Save permissions'}
				</button>
				{save.isError && <p role="alert">{save.error.message}</p>}
			</div>
			<p className="muted" style={{ padding: '0 16px' }}>
				The administrator role always has full access and cannot be changed. {authz.data?.customised ? `Customised (version ${authz.data.version}).` : 'Using the built-in defaults.'}
			</p>
			<div className="table-wrap">
				<table className="table">
					<caption className="sr-only">Permissions for {role}</caption>
					<thead>
						<tr>
							<th scope="col">Area</th>
							{VERBS.map((v) => (
								<th key={v} scope="col">
									{v}
								</th>
							))}
							<th scope="col">Which records</th>
						</tr>
					</thead>
					<tbody>
						{RESOURCES.map((res) => {
							const g = grants[res];
							return (
								<tr key={res}>
									<td data-label="Area" className="cell-primary">
										<strong>{res}</strong>
									</td>
									{VERBS.map((v) => (
										<td key={v} data-label={v}>
											<input type="checkbox" aria-label={`${role} can ${v} ${res}`} checked={!!g?.verbs.includes(v)} onChange={() => toggle(res, v)} />
										</td>
									))}
									<td data-label="Which records">
										<select aria-label={`Records for ${res}`} value={g?.scope ?? 'all'} disabled={!g} onChange={(e) => setScope(res, e.target.value as Scope)}>
											{SCOPES.map((s) => (
												<option key={s} value={s}>
													{SCOPE_LABEL[s]}
												</option>
											))}
										</select>
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

function Outbox() {
	const [status, setStatus] = useState('');
	const list = useOutbox(status);
	const retry = useRetryOutbox();
	const { notify } = useToast();
	return (
		<Card flush>
			<div className="inline-form">
				<label style={{ flex: '0 1 200px' }}>
					<span className="toolbar__label">Status</span>
					<select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%' }}>
						<option value="">All</option>
						<option>Pending</option>
						<option>Failed</option>
						<option>Done</option>
					</select>
				</label>
			</div>
			{list.isPending && <p role="status" className="table-empty">Loading…</p>}
			{list.isError && <p role="alert">Could not load the outbox.</p>}
			{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">Nothing in the outbox.</p>}
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Outbox</caption>
						<thead>
							<tr>
								<th scope="col">Work</th>
								<th scope="col">Status</th>
								<th scope="col">Attempts</th>
								<th scope="col">Next try</th>
								<th scope="col">Last error</th>
								<th scope="col">Action</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((o) => (
								<tr key={o.id}>
									<td data-label="Work" className="cell-primary">
										<strong>{o.jobType}</strong>
										<div className="muted">{[o.entityType, o.entityId].filter(Boolean).join(' ')}</div>
									</td>
									<td data-label="Status">
										<Chip status={o.status} />
									</td>
									<td data-label="Attempts" className="num">
										{o.attempts}
									</td>
									<td data-label="Next try">{o.nextRunAt ?? '-'}</td>
									<td data-label="Last error">{o.lastError || '-'}</td>
									<td data-label="Action">
										{o.status === 'Failed' && (
											<button className="btn btn-ghost" disabled={retry.isPending} onClick={() => retry.mutate(o.id, { onSuccess: () => notify('Queued to try again') })}>
												<RotateCw size={15} aria-hidden="true" /> Retry
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

function Integrations() {
	const check = useCheckIntegrations();
	const pull = usePullWonDeals();
	const row = (name: string, c?: { configured: boolean; ok: boolean; message: string }) => (
		<tr key={name}>
			<td data-label="Service" className="cell-primary">
				<strong>{name}</strong>
			</td>
			<td data-label="Status">{c ? <span className={'chip ' + (c.ok ? 'chip-green' : c.configured ? 'chip-red' : 'chip-gray')}>{c.ok ? 'Connected' : c.configured ? 'Not working' : 'Not set up'}</span> : '-'}</td>
			<td data-label="Detail">{c ? c.message : 'Not checked yet.'}</td>
		</tr>
	);
	return (
		<Card flush>
			<div className="inline-form">
				<button className="btn" disabled={check.isPending} onClick={() => check.mutate()}>
					{check.isPending ? 'Checking…' : 'Check connections'}
				</button>
				<button className="btn btn-ghost" disabled={pull.isPending} onClick={() => pull.mutate()}>
					{pull.isPending ? 'Pulling…' : 'Pull won deals from CRM now'}
				</button>
				{check.isError && <p role="alert">{check.error.message}</p>}
				{pull.isError && <p role="alert">{pull.error.message}</p>}
			</div>
			{pull.data && (
				<p role="status" style={{ padding: '0 16px' }}>
					{pull.data.ran
						? `Looked at ${pull.data.changedDeals} changed deal(s): ${pull.data.wonDeals} won, ${pull.data.created} new job(s) created, ${pull.data.alreadyHadJob} already had a job${pull.data.failed ? `, ${pull.data.failed} could not be created` : ''}.`
						: pull.data.reason}
				</p>
			)}
			<p className="muted" style={{ padding: '0 16px' }}>
				Makes one small read at Zoho CRM and one at WorkDrive. The credentials are set on the functions in the Catalyst console and are never shown here.
			</p>
			<div className="table-wrap">
				<table className="table">
					<caption className="sr-only">Integrations</caption>
					<thead>
						<tr>
							<th scope="col">Service</th>
							<th scope="col">Status</th>
							<th scope="col">Detail</th>
						</tr>
					</thead>
					<tbody>
						{row('Zoho CRM', check.data?.crm)}
						{row('Zoho WorkDrive', check.data?.workdrive)}
						{row('WorkDrive job folder', check.data?.workdriveFolder)}
					</tbody>
				</table>
			</div>
			{check.data && !check.data.workdriveFolderSet && (
				<p className="muted" style={{ padding: '8px 16px' }}>
					Job folders are not created yet: set <code>WORKDRIVE_PARENT_FOLDER_ID</code> (the WorkDrive folder that job folders go in) on the api and jobs functions.
				</p>
			)}
		</Card>
	);
}
