import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateJob, useMe, usePeople } from '../api/queries';
import { Chip } from '../components/Chip';
import { Field, FormPage, FormSection, ReadOnlyField } from '../components/FormKit';
import { useToast } from '../components/toast';

const EMPTY = {
	name: '',
	description: '',
	required_fab_finish: '',
	expected_finish: '',
	agreed_fab_finish: '',
	pm_id: '',
	fab_manager_id: '',
	server_path: '',
	crm_deal_id: '',
	quote_ref: '',
};

/** Add a job on its own page, laid out like the old Creator form: details, dates, people, then relationships. */
export function NewJob() {
	const me = useMe();
	const canCreate = !!me.data?.permissions.createJob;
	const people = usePeople(canCreate);
	const create = useCreateJob();
	const navigate = useNavigate();
	const { notify } = useToast();
	const [f, setF] = useState(EMPTY);
	const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));

	if (me.isSuccess && !canCreate) return <p className="table-empty">You do not have access to add jobs.</p>;

	const staff = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const personOptions = staff.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>);
	const datesProblem =
		f.agreed_fab_finish && f.required_fab_finish && f.agreed_fab_finish > f.required_fab_finish
			? 'The agreed fab finish is after the required fab finish.'
			: f.required_fab_finish && f.expected_finish && f.required_fab_finish > f.expected_finish
				? 'The required fab finish is after the expected job finish.'
				: '';

	const submit = () => {
		const body: Record<string, string> = { name: f.name.trim() };
		for (const [k, v] of Object.entries(f)) if (k !== 'name' && v.trim()) body[k] = v.trim();
		create.mutate(body as { name: string }, {
			onSuccess: (r) => {
				const id = (r as unknown as { job?: { ROWID: string } }).job?.ROWID ?? r.ROWID;
				notify('Job created');
				navigate('/jobs/' + id);
			},
			onError: (e) => notify(e instanceof Error ? e.message : 'Could not create the job', 'error'),
		});
	};

	return (
		<FormPage
			eyebrow="Projects"
			title="New job"
			subtitle="Fields marked * are required. A new job starts in Preparation; the progress figures fill in as tasks are done."
			backTo="/jobs"
			backLabel="All jobs"
			onSubmit={submit}
			onReset={() => setF(EMPTY)}
			busy={create.isPending}
			canSubmit={!!f.name.trim() && !datesProblem}
			error={datesProblem || null}
		>
			<FormSection title="Job">
				<Field label="Job name" required htmlFor="job-name" wide>
					<input id="job-name" value={f.name} required maxLength={200} autoFocus onChange={(e) => set('name', e.target.value)} />
				</Field>
				<ReadOnlyField label="Stage" value={<Chip status="Preparation" />} hint="Set by the tasks on the job." />
				<ReadOnlyField label="Job status" value="-" />
				<Field label="Description" htmlFor="job-desc" wide>
					<textarea id="job-desc" rows={3} maxLength={9000} value={f.description} onChange={(e) => set('description', e.target.value)} />
				</Field>
			</FormSection>

			<FormSection title="Dates">
				<Field label="Required fab finish date" htmlFor="job-req"><input id="job-req" type="date" value={f.required_fab_finish} onChange={(e) => set('required_fab_finish', e.target.value)} /></Field>
				<Field label="Expected job finish" htmlFor="job-exp"><input id="job-exp" type="date" value={f.expected_finish} onChange={(e) => set('expected_finish', e.target.value)} /></Field>
				<Field label="Agreed fab finish date" htmlFor="job-agr"><input id="job-agr" type="date" value={f.agreed_fab_finish} onChange={(e) => set('agreed_fab_finish', e.target.value)} /></Field>
			</FormSection>

			<FormSection title="Progress and emails">
				<ReadOnlyField label="% Fab completed" value="0" />
				<ReadOnlyField label="% Install completed" value="0" />
				<ReadOnlyField label="% Job completed" value="0" />
				<ReadOnlyField label="Profit email schedule time" value="Not scheduled" hint="Set when the job is closed." />
				<ReadOnlyField label="Job close triggered" value="No" />
				<ReadOnlyField label="Closure email sent" value="No" />
			</FormSection>

			<FormSection title="People and places">
				<Field label="Project manager" htmlFor="job-pm">
					<select id="job-pm" value={f.pm_id} onChange={(e) => set('pm_id', e.target.value)}><option value="">Not set</option>{personOptions}</select>
				</Field>
				<Field label="Fab manager" htmlFor="job-fm">
					<select id="job-fm" value={f.fab_manager_id} onChange={(e) => set('fab_manager_id', e.target.value)}><option value="">Not set</option>{personOptions}</select>
				</Field>
				<ReadOnlyField label="Workdrive link" value="Created automatically" hint="A folder is made in WorkDrive after the job is saved." />
				<Field label="Folder location on VE server" htmlFor="job-path"><input id="job-path" value={f.server_path} maxLength={255} placeholder="M:\Customer\Job name" onChange={(e) => set('server_path', e.target.value)} /></Field>
			</FormSection>

			<FormSection title="Purchases">
				<ReadOnlyField label="Total purchases" value="$0.00" hint="Not tracked in this app yet." />
				<ReadOnlyField label="Stock purchases" value="$0.00" hint="Not tracked in this app yet." />
			</FormSection>

			<FormSection title="Relationships">
				<Field label="Deal" htmlFor="job-deal" hint="The CRM deal ID."><input id="job-deal" value={f.crm_deal_id} maxLength={50} onChange={(e) => set('crm_deal_id', e.target.value)} /></Field>
				<Field label="Related quote" htmlFor="job-quote"><input id="job-quote" value={f.quote_ref} maxLength={255} onChange={(e) => set('quote_ref', e.target.value)} /></Field>
			</FormSection>
		</FormPage>
	);
}
