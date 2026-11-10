import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePeople } from '../api/queries';
import { num } from '../api/types';
import type { Job } from '../api/types';
import { Chip } from './Chip';
import { Field, FormPage, ReadOnlyField } from './FormKit';
import { useToast } from './toast';

const STAGES_AT_START = ['Preparation', 'In Progress', 'On Hold'];
const d10 = (v?: string | null) => (v ?? '').slice(0, 10);
/** Catalyst gives "2026-11-10 14:30:00"; the datetime-local box wants "2026-11-10T14:30". */
const dt16 = (v?: string | null) => (v ? v.replace(' ', 'T').slice(0, 16) : '');
const money = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(num(v as string | number)));

const blank = (job?: Job) => ({
	name: job?.name ?? '',
	stage: job?.stage ?? 'Preparation',
	description: job?.description ?? '',
	required_fab_finish: d10(job?.required_fab_finish),
	expected_finish: d10(job?.expected_finish),
	agreed_fab_finish: d10(job?.agreed_fab_finish),
	pm_id: job?.pm_id ? String(job.pm_id) : '',
	fab_manager_id: job?.fab_manager_id ? String(job.fab_manager_id) : '',
	workdrive_url: (job as { workdrive_url?: string } | undefined)?.workdrive_url ?? '',
	server_path: (job as { server_path?: string } | undefined)?.server_path ?? '',
	total_purchases: money(job?.total_purchases),
	stock_purchases: money(job?.stock_purchases),
	profit_email_at: dt16(job?.profit_email_at),
	closure_email_sent: !!job?.closure_email_sent,
	close_triggered: !!job?.close_triggered,
	crm_deal_id: job?.crm_deal_id ?? '',
	quote_ref: job?.quote_ref ?? '',
});
type FormState = ReturnType<typeof blank>;

/** POST /jobs, or PATCH /jobs/:id when editing; refreshes the lists and the job page. */
const useSaveJob = (jobId?: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body: Record<string, unknown>) => api<{ job?: { ROWID: string }; ROWID?: string }>(jobId ? '/jobs/' + jobId : '/jobs', { method: jobId ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['jobs'] });
			if (jobId) void qc.invalidateQueries({ queryKey: ['job', jobId] });
		},
	});
};

const Suffix = ({ children, suffix }: { children: ReactNode; suffix: string }) => (
	<div className="input-suffix">
		{children}
		<span aria-hidden="true">{suffix}</span>
	</div>
);

/**
 * The job form, laid out like the old Creator form: three columns (job, dates and progress, people and money), then
 * Relationships. Used to add a job and to edit one. The system fields are for administrators; everyone else sees them greyed.
 */
export function JobForm({ job, isAdmin }: { job?: Job; isAdmin: boolean }) {
	const editing = !!job;
	const people = usePeople(true);
	const save = useSaveJob(job?.ROWID);
	const navigate = useNavigate();
	const { notify } = useToast();
	const [f, setF] = useState<FormState>(blank(job));
	const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

	const staff = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const personOptions = staff.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>);
	const datesProblem =
		f.agreed_fab_finish && f.required_fab_finish && f.agreed_fab_finish > f.required_fab_finish
			? 'The agreed fab finish is after the required fab finish.'
			: f.required_fab_finish && f.expected_finish && f.required_fab_finish > f.expected_finish
				? 'The required fab finish is after the expected job finish.'
				: '';
	const moneyBad = [f.total_purchases, f.stock_purchases].some((v) => v !== '' && !(Number(v) >= 0));
	// The server asks an edited job for these three (JOB-7): say so on the form instead of after Submit.
	const missingOnEdit = editing && (!f.expected_finish || !f.server_path.trim());
	const problem = datesProblem || (moneyBad ? 'Purchases must be a number of 0 or more.' : '') || (missingOnEdit ? 'An edited job needs its expected finish and its folder location on the VE server.' : '');

	const submit = () => {
		const body: Record<string, unknown> = { name: f.name.trim(), description: f.description.trim() };
		for (const k of ['required_fab_finish', 'expected_finish', 'agreed_fab_finish', 'pm_id', 'fab_manager_id', 'quote_ref'] as const) if (f[k] || editing) body[k] = f[k];
		if (f.server_path.trim() || editing) body.server_path = f.server_path.trim();
		if (!editing && f.stage !== 'Preparation') body.stage = f.stage;
		if (!editing || f.crm_deal_id !== (job?.crm_deal_id ?? '')) if (f.crm_deal_id.trim()) body.crm_deal_id = f.crm_deal_id.trim();
		if (isAdmin) {
			const was = blank(job);
			if (f.workdrive_url.trim() && f.workdrive_url !== was.workdrive_url) body.workdrive_url = f.workdrive_url.trim();
			if (f.profit_email_at && f.profit_email_at !== was.profit_email_at) body.profit_email_at = f.profit_email_at;
			if (f.total_purchases !== '' && f.total_purchases !== was.total_purchases) body.total_purchases = Number(f.total_purchases);
			if (f.stock_purchases !== '' && f.stock_purchases !== was.stock_purchases) body.stock_purchases = Number(f.stock_purchases);
			if (f.closure_email_sent !== was.closure_email_sent) body.closure_email_sent = f.closure_email_sent;
			if (f.close_triggered !== was.close_triggered) body.close_triggered = f.close_triggered;
		}
		save.mutate(body, {
			onSuccess: (r) => {
				notify(editing ? 'Job saved' : 'Job created');
				navigate('/jobs/' + (job?.ROWID ?? r.job?.ROWID ?? r.ROWID));
			},
			onError: (e) => notify(e instanceof Error ? e.message : 'Could not save the job', 'error'),
		});
	};

	return (
		<FormPage
			eyebrow="Projects"
			title={editing ? 'Edit Job' : 'Jobs'}
			subtitle="Fields marked * are required. Greyed fields are filled in by the system."
			backTo={editing ? '/jobs/' + job?.ROWID : '/jobs'}
			backLabel={editing ? 'Back to the job' : 'All jobs'}
			submitLabel="Submit"
			onSubmit={submit}
			onReset={() => setF(blank(job))}
			busy={save.isPending}
			canSubmit={!!f.name.trim() && !problem}
			error={problem || null}
		>
			<section className="job-form" aria-label="Job details">
				<div className="job-form__col">
					<Field label="Job Name" required htmlFor="jf-name"><input id="jf-name" value={f.name} required maxLength={200} autoFocus onChange={(e) => set('name', e.target.value)} /></Field>
					{editing ? (
						<ReadOnlyField label="Stage" value={<Chip status={f.stage} />} hint="Worked out from the tasks." />
					) : (
						<Field label="Stage" htmlFor="jf-stage"><select id="jf-stage" value={f.stage} onChange={(e) => set('stage', e.target.value)}>{STAGES_AT_START.map((s) => <option key={s}>{s}</option>)}</select></Field>
					)}
					<Field label="Description" htmlFor="jf-desc"><textarea id="jf-desc" rows={9} maxLength={9000} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
					<Field label="Profit Email Schedule Time" htmlFor="jf-profit">
						<input id="jf-profit" type="datetime-local" value={f.profit_email_at} disabled={!isAdmin} onChange={(e) => set('profit_email_at', e.target.value)} />
					</Field>
					<label className="check"><input type="checkbox" checked={f.closure_email_sent} disabled={!isAdmin} onChange={(e) => set('closure_email_sent', e.target.checked)} /> Closure Email Sent</label>
					<label className="check"><input type="checkbox" checked={f.close_triggered} disabled={!isAdmin} onChange={(e) => set('close_triggered', e.target.checked)} /> Job Close Triggered</label>
				</div>

				<div className="job-form__col">
					<Field label="Required Fab Finish Date" htmlFor="jf-req"><input id="jf-req" type="date" value={f.required_fab_finish} onChange={(e) => set('required_fab_finish', e.target.value)} /></Field>
					<Field label="Expected Job Finish" required={editing} htmlFor="jf-exp"><input id="jf-exp" type="date" value={f.expected_finish} onChange={(e) => set('expected_finish', e.target.value)} /></Field>
					<Field label="Agreed Fab Finish Date" htmlFor="jf-agr"><input id="jf-agr" type="date" value={f.agreed_fab_finish} onChange={(e) => set('agreed_fab_finish', e.target.value)} /></Field>
					<ReadOnlyField label="% Fab Completed" value={<>{num(job?.percent_fab)} %</>} />
					<ReadOnlyField label="% Install Completed" value={<>{num(job?.percent_install)} %</>} />
					<ReadOnlyField label="% Job Completed" value={<>{num(job?.percent_job)} %</>} />
				</div>

				<div className="job-form__col">
					<Field label="Project Manager" htmlFor="jf-pm"><select id="jf-pm" value={f.pm_id} onChange={(e) => set('pm_id', e.target.value)}><option value="">Not set</option>{personOptions}</select></Field>
					<Field label="Fab Manager" htmlFor="jf-fm"><select id="jf-fm" value={f.fab_manager_id} onChange={(e) => set('fab_manager_id', e.target.value)}><option value="">Not set</option>{personOptions}</select></Field>
					<Field label="Workdrive Link" htmlFor="jf-wd" hint={isAdmin ? undefined : 'Created automatically after the job is saved.'}>
						<input id="jf-wd" type="url" value={f.workdrive_url} disabled={!isAdmin} placeholder={isAdmin ? 'https://…' : ''} onChange={(e) => set('workdrive_url', e.target.value)} />
					</Field>
					<Field label="Folder Location on VE Server" required={editing} htmlFor="jf-path"><input id="jf-path" value={f.server_path} maxLength={255} placeholder="M:\Customer\Job name" onChange={(e) => set('server_path', e.target.value)} /></Field>
					<Field label="Total Purchases" htmlFor="jf-tp" hint={isAdmin ? undefined : 'Administrators only.'}>
						<Suffix suffix="$"><input id="jf-tp" type="number" min={0} step="0.01" inputMode="decimal" value={f.total_purchases} disabled={!isAdmin} onChange={(e) => set('total_purchases', e.target.value)} /></Suffix>
					</Field>
					<Field label="Stock Purchases" htmlFor="jf-sp">
						<Suffix suffix="$"><input id="jf-sp" type="number" min={0} step="0.01" inputMode="decimal" value={f.stock_purchases} disabled={!isAdmin} onChange={(e) => set('stock_purchases', e.target.value)} /></Suffix>
					</Field>
				</div>
			</section>

			<section className="form-section" aria-label="Relationships">
				<h2 className="form-section__title">Relationships</h2>
				<div className="form-fields">
					<Field label="Deal" htmlFor="jf-deal" hint={editing && !isAdmin ? 'Only an administrator can change the deal.' : 'The CRM deal ID.'}>
						<input id="jf-deal" value={f.crm_deal_id} maxLength={50} disabled={editing && !isAdmin} onChange={(e) => set('crm_deal_id', e.target.value)} />
					</Field>
					<Field label="Related Quote" htmlFor="jf-quote"><input id="jf-quote" value={f.quote_ref} maxLength={255} onChange={(e) => set('quote_ref', e.target.value)} /></Field>
				</div>
			</section>
		</FormPage>
	);
}
