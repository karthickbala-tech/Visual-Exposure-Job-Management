import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateIssue } from '../api/queries';
import { Field, FormPage, FormSection } from '../components/FormKit';
import { useToast } from '../components/toast';

const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];
const DEPARTMENTS = ['Management', 'Design', 'Fabrication', 'Install', 'Civic Billboards'];
const REVIEWS = ['None', 'Design review', 'Fabrication review', 'Install review', 'Management review'];
const FACES = ['North', 'South', 'East', 'West', 'Single face'];
const EMPTY = { subject: '', description: '', issue_priority: 'Normal', department: 'Management', billboard_site: '', billboard_face: '', review_needed: 'None' };

/** Raise an issue on its own page. The billboard fields appear only for Civic Billboards, as in the old form. */
export function NewIssue() {
	const create = useCreateIssue();
	const navigate = useNavigate();
	const { notify } = useToast();
	const [f, setF] = useState(EMPTY);
	const set = (k: keyof typeof EMPTY, v: string) => setF((s) => ({ ...s, [k]: v }));
	const civic = f.department === 'Civic Billboards';
	const missing = !f.subject.trim() || (civic && (!f.billboard_site.trim() || !f.billboard_face));

	return (
		<FormPage
			eyebrow="Safety and quality"
			title="Raise an issue"
			subtitle="Fields marked * are required."
			backTo="/issues"
			backLabel="All issues"
			onSubmit={() =>
				create.mutate(
					{
						subject: f.subject.trim(),
						description: f.description.trim() || undefined,
						issue_priority: f.issue_priority,
						department: f.department,
						billboard_site: civic ? f.billboard_site.trim() : undefined,
						billboard_face: civic ? f.billboard_face : undefined,
						review_needed: f.review_needed !== 'None' ? f.review_needed : undefined,
					},
					{ onSuccess: () => { notify('Issue raised'); navigate('/issues'); }, onError: (e) => notify(e instanceof Error ? e.message : 'Could not raise the issue', 'error') },
				)
			}
			onReset={() => setF(EMPTY)}
			busy={create.isPending}
			canSubmit={!missing}
		>
			<FormSection title="Issue">
				<Field label="What is the problem?" required htmlFor="i-subject" wide><input id="i-subject" value={f.subject} required maxLength={255} autoFocus onChange={(e) => set('subject', e.target.value)} /></Field>
				<Field label="Department" htmlFor="i-dept"><select id="i-dept" value={f.department} onChange={(e) => set('department', e.target.value)}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
				<Field label="Priority" htmlFor="i-prio"><select id="i-prio" value={f.issue_priority} onChange={(e) => set('issue_priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
				{civic && (
					<>
						<Field label="Billboard site" required htmlFor="i-site"><input id="i-site" value={f.billboard_site} maxLength={150} onChange={(e) => set('billboard_site', e.target.value)} /></Field>
						<Field label="Billboard face" required htmlFor="i-face"><select id="i-face" value={f.billboard_face} onChange={(e) => set('billboard_face', e.target.value)}><option value="">Choose…</option>{FACES.map((x) => <option key={x}>{x}</option>)}</select></Field>
					</>
				)}
				<Field label="Review needed" htmlFor="i-review"><select id="i-review" value={f.review_needed} onChange={(e) => set('review_needed', e.target.value)}>{REVIEWS.map((r) => <option key={r}>{r}</option>)}</select></Field>
				<Field label="Details" htmlFor="i-desc" wide><textarea id="i-desc" rows={3} maxLength={9000} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
			</FormSection>
		</FormPage>
	);
}
