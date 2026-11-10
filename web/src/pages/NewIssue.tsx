import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateIssue, useSites } from '../api/queries';
import { Field, FormPage, FormSection } from '../components/FormKit';
import { useToast } from '../components/toast';

const PRIORITIES = ['High', 'Medium', 'Low'];
const DEPARTMENTS = ['Install', 'Civic Billboards', 'Workshop', 'Management', 'VT/Digital Screens'];
const DIRECTIONS = ['Inbound', 'Outbound', 'Middle Panel'];
/** Review choices by department, as in Creator: Install and Workshop ask for one. */
const reviewFor = (d: string) => (d === 'Install' ? ['Management Review', 'WHS Reported'] : d === 'Workshop' ? ['Management Review', 'OH&S Reported'] : []);
const EMPTY = { subject: '', description: '', issue_priority: 'Medium', department: 'Management', billboard_site: '', billboard_face: '', review_needed: '', site_id: '' };

/** Raise an issue on its own page. The billboard fields appear only for Civic Billboards, as in the old form. */
export function NewIssue() {
	const create = useCreateIssue();
	const sites = useSites();
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
						review_needed: reviewFor(f.department).includes(f.review_needed) ? f.review_needed : undefined,
						site_id: f.site_id || undefined,
					},
					{ onSuccess: () => { notify('Issue raised'); navigate('/issues'); }, onError: (e) => notify(e instanceof Error ? e.message : 'Could not raise the issue', 'error') },
				)
			}
			onReset={() => setF(EMPTY)}
			busy={create.isPending}
			canSubmit={!missing}
		>
			<FormSection title="Issue">
				<Field label="Issue Subject" required htmlFor="i-subject" wide><input id="i-subject" value={f.subject} required maxLength={255} autoFocus onChange={(e) => set('subject', e.target.value)} /></Field>
				<Field label="Department" htmlFor="i-dept"><select id="i-dept" value={f.department} onChange={(e) => setF((x) => ({ ...x, department: e.target.value, review_needed: '' }))}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></Field>
				<Field label="Priority" htmlFor="i-prio"><select id="i-prio" value={f.issue_priority} onChange={(e) => set('issue_priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select></Field>
				<Field label="Locations" htmlFor="i-site-id"><select id="i-site-id" value={f.site_id} onChange={(e) => set('site_id', e.target.value)}><option value="">Not set</option>{(sites.data?.items ?? []).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
				{civic && (
					<>
						<Field label="Location" required htmlFor="i-site"><input id="i-site" value={f.billboard_site} maxLength={150} onChange={(e) => set('billboard_site', e.target.value)} /></Field>
						<Field label="Direction" required htmlFor="i-face"><select id="i-face" value={f.billboard_face} onChange={(e) => set('billboard_face', e.target.value)}><option value="">Choose…</option>{DIRECTIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
					</>
				)}
				{reviewFor(f.department).length > 0 && (
					<Field label={f.department === 'Install' ? 'Install Review For' : 'Fabrication Review For'} htmlFor="i-review"><select id="i-review" value={f.review_needed} onChange={(e) => set('review_needed', e.target.value)}><option value="">Not needed</option>{reviewFor(f.department).map((r) => <option key={r}>{r}</option>)}</select></Field>
				)}
				<Field label="Detailed Description" htmlFor="i-desc" wide><textarea id="i-desc" rows={3} maxLength={9000} value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
			</FormSection>
		</FormPage>
	);
}
