import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { useChemicals, useEquipment, useLocations, useMe, useRegisterWrite } from '../api/queries';
import { Chip } from '../components/Chip';
import { useToast } from '../components/toast';
import { Card, PageHeader } from '../components/ui';

type Tab = 'equipment' | 'chemicals' | 'locations';
const TABS: { id: Tab; label: string }[] = [
	{ id: 'equipment', label: 'Equipment' },
	{ id: 'chemicals', label: 'Chemicals' },
	{ id: 'locations', label: 'Workshop locations' },
];

/** Equipment register, chemicals with safety data sheet (SDS) links, and workshop locations. */
export function Equipment() {
	const me = useMe();
	const canWrite = !!me.data?.permissions.createJob; // managers; the server decides for real
	const [tab, setTab] = useState<Tab>('equipment');
	return (
		<>
			<PageHeader eyebrow="Workshop" title="Equipment" subtitle="Equipment checks, chemicals and where things are kept." />
			<div className="inline-form" role="tablist" aria-label="Register">
				{TABS.map((t) => (
					<button key={t.id} role="tab" aria-selected={tab === t.id} className={'btn' + (tab === t.id ? '' : ' btn-ghost')} onClick={() => setTab(t.id)}>
						{t.label}
					</button>
				))}
			</div>
			{tab === 'equipment' && <EquipmentTab canWrite={canWrite} />}
			{tab === 'chemicals' && <ChemicalsTab canWrite={canWrite} />}
			{tab === 'locations' && <LocationsTab canWrite={canWrite} />}
		</>
	);
}

function State({ q, empty }: { q: { isPending: boolean; isError: boolean; data?: { items: unknown[] } }; empty: string }) {
	if (q.isPending) return <p role="status" className="table-empty">Loading...</p>;
	if (q.isError) return <p role="alert">Could not load this list.</p>;
	if (q.data && q.data.items.length === 0) return <p className="table-empty">{empty}</p>;
	return null;
}

function EquipmentTab({ canWrite }: { canWrite: boolean }) {
	const list = useEquipment();
	const locs = useLocations();
	const write = useRegisterWrite(['equipment']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState({ name: '', type: '', location_id: '', frequency_days: '', off_hire_required: false });
	const checked = (id: string) => write.mutate({ method: 'POST', path: `/equipment/${id}/checked` }, { onSuccess: () => notify('Marked as checked today') });

	return (
		<Card flush>
			{canWrite && (
				<div className="inline-form">
					{!open && (
						<button className="btn" onClick={() => setOpen(true)}>
							<Plus size={16} aria-hidden="true" /> Add equipment
						</button>
					)}
				</div>
			)}
			{canWrite && open && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{
								method: 'POST',
								path: '/equipment',
								body: {
									name: form.name,
									type: form.type || undefined,
									location_id: form.location_id || undefined,
									frequency_days: form.frequency_days ? Number(form.frequency_days) : undefined,
									off_hire_required: form.off_hire_required,
								},
							},
							{
								onSuccess: () => {
									setOpen(false);
									setForm({ name: '', type: '', location_id: '', frequency_days: '', off_hire_required: false });
									notify('Equipment added');
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">Name *</span>
						<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Type</span>
						<input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} maxLength={100} />
					</label>
					<label>
						<span className="toolbar__label">Location</span>
						<select value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} style={{ width: '100%' }}>
							<option value="">None</option>
							{locs.data?.items.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className="toolbar__label">Check every (days)</span>
						<input type="number" min={1} max={3650} value={form.frequency_days} onChange={(e) => setForm({ ...form, frequency_days: e.target.value })} />
					</label>
					<label className="login__check">
						<input type="checkbox" checked={form.off_hire_required} onChange={(e) => setForm({ ...form, off_hire_required: e.target.checked })} /> Hired (off hire when the job ends)
					</label>
					<button className="btn" disabled={write.isPending}>
						{write.isPending ? 'Saving...' : 'Save'}
					</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
						Cancel
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
			)}
			<State q={list} empty="No equipment yet." />
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Equipment register</caption>
						<thead>
							<tr>
								<th scope="col">Code</th>
								<th scope="col">Name</th>
								<th scope="col">Location</th>
								<th scope="col">Status</th>
								<th scope="col">Next check</th>
								{canWrite && <th scope="col">Action</th>}
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((e) => (
								<tr key={e.id}>
									<td data-label="Code" className="num">{e.code}</td>
									<td data-label="Name" className="cell-primary">
										<strong>{e.name}</strong>
										{e.type && <div className="muted">{e.type}</div>}
									</td>
									<td data-label="Location">{e.locationName ?? '-'}</td>
									<td data-label="Status">
										<Chip status={e.status} />
									</td>
									<td data-label="Next check">
										{e.nextDue ?? '-'}
										{e.overdue && <span className="chip chip-red" style={{ marginLeft: 8 }}>{e.daysOverdue} days overdue</span>}
									</td>
									{canWrite && (
										<td data-label="Action">
											{e.status === 'In service' && (
												<button className="btn btn-ghost" onClick={() => checked(e.id)} disabled={write.isPending}>
													<Check size={15} aria-hidden="true" /> Checked today
												</button>
											)}
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}

function ChemicalsTab({ canWrite }: { canWrite: boolean }) {
	const list = useChemicals();
	const locs = useLocations();
	const write = useRegisterWrite(['chemicals']);
	const { notify } = useToast();
	const [open, setOpen] = useState(false);
	const empty = { name: '', location_id: '', sds_url: '', review_date: '', hazard_class: '' };
	const [form, setForm] = useState(empty);
	const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

	return (
		<Card flush>
			{canWrite && !open && (
				<div className="inline-form">
					<button className="btn" onClick={() => setOpen(true)}>
						<Plus size={16} aria-hidden="true" /> Add chemical
					</button>
				</div>
			)}
			{canWrite && open && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate(
							{
								method: 'POST',
								path: '/chemicals',
								body: { name: form.name, location_id: form.location_id || undefined, sds_url: form.sds_url, review_date: form.review_date || undefined, hazard_class: form.hazard_class || undefined },
							},
							{
								onSuccess: () => {
									setOpen(false);
									setForm(empty);
									notify('Chemical added');
								},
							},
						);
					}}
				>
					<label>
						<span className="toolbar__label">Name *</span>
						<input value={form.name} onChange={set('name')} required maxLength={200} />
					</label>
					<label>
						<span className="toolbar__label">Location</span>
						<select value={form.location_id} onChange={set('location_id')} style={{ width: '100%' }}>
							<option value="">None</option>
							{locs.data?.items.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					</label>
					<label>
						<span className="toolbar__label">SDS link (https://...)</span>
						<input type="url" value={form.sds_url} onChange={set('sds_url')} maxLength={500} pattern="https?://.+" />
					</label>
					<label>
						<span className="toolbar__label">SDS review date</span>
						<input type="date" value={form.review_date} onChange={set('review_date')} />
					</label>
					<label>
						<span className="toolbar__label">Hazard class</span>
						<input value={form.hazard_class} onChange={set('hazard_class')} maxLength={100} />
					</label>
					<button className="btn" disabled={write.isPending}>
						{write.isPending ? 'Saving...' : 'Save'}
					</button>
					<button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
						Cancel
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
			)}
			<State q={list} empty="No chemicals yet." />
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Chemical register</caption>
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Location</th>
								<th scope="col">Hazard class</th>
								<th scope="col">Safety data sheet</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((c) => (
								<tr key={c.id}>
									<td data-label="Name" className="cell-primary">
										<strong>{c.name}</strong>
									</td>
									<td data-label="Location">{c.locationName ?? '-'}</td>
									<td data-label="Hazard class">{c.hazardClass || '-'}</td>
									<td data-label="Safety data sheet">
										{c.sdsMissing ? <span className="chip chip-red">SDS missing</span> : <a href={c.sdsUrl} target="_blank" rel="noopener noreferrer">Open SDS</a>}
										{c.reviewDue && <span className="chip chip-amber" style={{ marginLeft: 8 }}>Review due</span>}
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

function LocationsTab({ canWrite }: { canWrite: boolean }) {
	const list = useLocations();
	const write = useRegisterWrite(['locations']);
	const { notify } = useToast();
	const [name, setName] = useState('');
	return (
		<Card flush>
			{canWrite && (
				<form
					className="inline-form"
					onSubmit={(e) => {
						e.preventDefault();
						write.mutate({ method: 'POST', path: '/locations', body: { name } }, { onSuccess: () => { setName(''); notify('Location added'); } });
					}}
				>
					<label>
						<span className="toolbar__label">New location</span>
						<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
					</label>
					<button className="btn" disabled={write.isPending}>
						<Plus size={16} aria-hidden="true" /> Add
					</button>
					{write.isError && <p role="alert">{write.error.message}</p>}
				</form>
			)}
			<State q={list} empty="No workshop locations yet." />
			{list.isSuccess && list.data.items.length > 0 && (
				<div className="table-wrap">
					<table className="table">
						<caption className="sr-only">Workshop locations</caption>
						<thead>
							<tr>
								<th scope="col">Name</th>
								<th scope="col">Area supervisor</th>
							</tr>
						</thead>
						<tbody>
							{list.data.items.map((l) => (
								<tr key={l.id}>
									<td data-label="Name" className="cell-primary">
										<strong>{l.name}</strong>
										{l.description && <div className="muted">{l.description}</div>}
									</td>
									<td data-label="Area supervisor">{l.supervisorName ?? '-'}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</Card>
	);
}
