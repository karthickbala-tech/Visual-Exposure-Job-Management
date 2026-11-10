import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { usePeople } from '../api/queries';
import type { Job } from '../api/types';
import { useToast } from './toast';

const date10 = (v?: string | null) => (v ?? '').slice(0, 10);

/** PATCH /jobs/:id, then refresh the job page and the jobs list. */
const useUpdateJob = (jobId: string) => {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (patch: Record<string, unknown>) => api('/jobs/' + jobId, { method: 'PATCH', body: JSON.stringify(patch) }),
		onSuccess: () => {
			void qc.invalidateQueries({ queryKey: ['job', jobId] });
			void qc.invalidateQueries({ queryKey: ['jobs'] });
		},
	});
};

/** Edit a job's details. The deal link and created date are for administrators; the server checks that too. */
export function EditJobForm({ job, isAdmin, onClose }: { job: Job & { pm_id?: string; fab_manager_id?: string; quote_ref?: string; agreed_fab_finish?: string; required_fab_finish?: string; server_path?: string }; isAdmin: boolean; onClose: () => void }) {
	const update = useUpdateJob(job.ROWID);
	const people = usePeople(true);
	const { notify } = useToast();
	const [f, setF] = useState({
		name: job.name,
		description: job.description ?? '',
		expected_finish: date10(job.expected_finish),
		agreed_fab_finish: date10(job.agreed_fab_finish),
		required_fab_finish: date10(job.required_fab_finish),
		server_path: job.server_path ?? '',
		quote_ref: job.quote_ref ?? '',
		pm_id: job.pm_id ? String(job.pm_id) : '',
		fab_manager_id: job.fab_manager_id ? String(job.fab_manager_id) : '',
		crm_deal_id: job.crm_deal_id ?? '',
	});
	const staff = (people.data?.items ?? []).filter((p) => p.is_active !== false);
	const person = (label: string, key: 'pm_id' | 'fab_manager_id') => (
		<label>
			<span className="toolbar__label">{label}</span>
			<select value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
				<option value="">Not set</option>
				{staff.map((p) => <option key={p.ROWID} value={p.ROWID}>{`${p.first_name} ${p.last_name ?? ''}`.trim()}</option>)}
			</select>
		</label>
	);
	return (
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				const body: Record<string, unknown> = { name: f.name.trim(), description: f.description.trim(), server_path: f.server_path.trim(), quote_ref: f.quote_ref.trim() };
				for (const k of ['expected_finish', 'agreed_fab_finish', 'required_fab_finish'] as const) if (f[k]) body[k] = f[k];
				if (f.pm_id) body.pm_id = f.pm_id;
				if (f.fab_manager_id) body.fab_manager_id = f.fab_manager_id;
				if (isAdmin && f.crm_deal_id.trim() && f.crm_deal_id.trim() !== job.crm_deal_id) body.crm_deal_id = f.crm_deal_id.trim();
				update.mutate(body, { onSuccess: () => { notify('Job saved'); onClose(); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not save the job', 'error') });
			}}
		>
			<label style={{ flex: '2 1 280px' }}><span className="toolbar__label">Job name *</span><input value={f.name} required maxLength={200} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
			<label><span className="toolbar__label">Expected finish</span><input type="date" value={f.expected_finish} onChange={(e) => setF({ ...f, expected_finish: e.target.value })} /></label>
			<label><span className="toolbar__label">Agreed fab finish</span><input type="date" value={f.agreed_fab_finish} onChange={(e) => setF({ ...f, agreed_fab_finish: e.target.value })} /></label>
			<label><span className="toolbar__label">Required fab finish</span><input type="date" value={f.required_fab_finish} onChange={(e) => setF({ ...f, required_fab_finish: e.target.value })} /></label>
			{person('Project manager', 'pm_id')}
			{person('Fab manager', 'fab_manager_id')}
			<label><span className="toolbar__label">Quote reference</span><input value={f.quote_ref} maxLength={255} onChange={(e) => setF({ ...f, quote_ref: e.target.value })} /></label>
			<label style={{ flex: '2 1 280px' }}><span className="toolbar__label">Folder on the VE server</span><input value={f.server_path} maxLength={255} onChange={(e) => setF({ ...f, server_path: e.target.value })} /></label>
			{isAdmin && <label><span className="toolbar__label">CRM deal ID (admin)</span><input value={f.crm_deal_id} maxLength={50} onChange={(e) => setF({ ...f, crm_deal_id: e.target.value })} /></label>}
			<label style={{ flex: '1 1 100%' }}><span className="toolbar__label">Description</span><textarea rows={2} value={f.description} maxLength={9000} onChange={(e) => setF({ ...f, description: e.target.value })} /></label>
			<button className="btn" disabled={update.isPending || !f.name.trim()}>{update.isPending ? 'Saving…' : 'Save job'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
		</form>
	);
}
