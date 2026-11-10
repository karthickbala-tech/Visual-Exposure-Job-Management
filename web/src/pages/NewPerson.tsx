import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreatePerson, useRoles } from '../api/more';
import { useMe } from '../api/queries';
import { Field, FormPage, FormSection } from '../components/FormKit';
import { useToast } from '../components/toast';

const EMPTY = { first_name: '', last_name: '', person_kind: 'staff', role: '', job_title: '', email: '', phone: '' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roleLabel = (r: string) => r.replace(/_/g, ' ');

/** Add a worker or subcontractor contact on its own page. */
export function NewPerson() {
	const me = useMe();
	const canAdd = !!me.data?.permissions.createJob;
	const roles = useRoles();
	const create = useCreatePerson();
	const navigate = useNavigate();
	const { notify } = useToast();
	const [f, setF] = useState(EMPTY);
	const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));
	if (me.isSuccess && !canAdd) return <p className="table-empty">You do not have access to add people.</p>;

	const emailBad = !!f.email && !EMAIL.test(f.email);
	const needRole = f.person_kind === 'staff' && !f.role;
	const problem = emailBad ? 'Enter a valid email address.' : needRole ? 'Choose a primary role for Visual Exposure staff.' : '';

	return (
		<FormPage
			eyebrow="Team"
			title="Add a person"
			subtitle="Fields marked * are required."
			backTo="/people"
			backLabel="All people"
			onSubmit={() =>
				create.mutate(
					{ first_name: f.first_name.trim(), last_name: f.last_name.trim() || undefined, email: f.email.trim() || undefined, phone: f.phone.trim() || undefined, person_kind: f.person_kind, job_title: f.job_title.trim() || undefined, roles: f.role ? [f.role] : undefined },
					{ onSuccess: () => { notify('Person added'); navigate('/people'); }, onError: (e) => notify(e instanceof Error ? e.message : 'Could not add the person', 'error') },
				)
			}
			onReset={() => setF(EMPTY)}
			busy={create.isPending}
			canSubmit={!!f.first_name.trim() && !problem}
			error={problem || null}
		>
			<FormSection title="Person">
				<Field label="First name" required htmlFor="p-first"><input id="p-first" value={f.first_name} required maxLength={100} autoFocus autoComplete="off" onChange={(e) => set('first_name', e.target.value)} /></Field>
				<Field label="Last name" htmlFor="p-last"><input id="p-last" value={f.last_name} maxLength={100} autoComplete="off" onChange={(e) => set('last_name', e.target.value)} /></Field>
				<Field label="Employer" htmlFor="p-kind">
					<select id="p-kind" value={f.person_kind} onChange={(e) => set('person_kind', e.target.value)}><option value="staff">Visual Exposure</option><option value="subcontractor">Subcontractor</option></select>
				</Field>
				{f.person_kind === 'staff' && (
					<Field label="Primary role" required htmlFor="p-role">
						<select id="p-role" value={f.role} onChange={(e) => set('role', e.target.value)}>
							<option value="">Choose…</option>
							{(roles.data?.items ?? []).filter((r) => r.key !== 'admin').map((r) => <option key={r.key} value={r.key}>{roleLabel(r.key)}</option>)}
						</select>
					</Field>
				)}
				<Field label="Job title" htmlFor="p-title"><input id="p-title" value={f.job_title} maxLength={100} onChange={(e) => set('job_title', e.target.value)} /></Field>
			</FormSection>
			<FormSection title="Contact">
				<Field label="Email" htmlFor="p-email"><input id="p-email" type="email" value={f.email} maxLength={100} autoComplete="off" spellCheck={false} aria-invalid={emailBad} onChange={(e) => set('email', e.target.value)} /></Field>
				<Field label="Phone" htmlFor="p-phone"><input id="p-phone" type="tel" value={f.phone} maxLength={30} autoComplete="off" onChange={(e) => set('phone', e.target.value)} /></Field>
			</FormSection>
		</FormPage>
	);
}
