import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hammer, PenTool, Plus, Truck } from 'lucide-react';
import { useCreateWorkshopTask } from '../api/more';
import { useMe } from '../api/queries';
import { ROUTE_ROLES } from '../navConfig';
import { useToast } from '../components/toast';
import { Dialog } from '../components/Dialog';
import { LayoutToggle, PageHeader } from '../components/ui';
import { WorkList } from './WorkList';

type Kind = 'design' | 'fabrication' | 'install';
const TYPE_KEY = 've.tasks.type';
const TYPES: { key: Kind; label: string; hint: string; icon: typeof PenTool; roles: string[] | undefined }[] = [
	{ key: 'design', label: 'Design', hint: 'Artwork and proofs, from assignment to approval.', icon: PenTool, roles: ROUTE_ROLES.design },
	{ key: 'fabrication', label: 'Fabrication', hint: 'Everything being made in the workshop and on the CNC.', icon: Hammer, roles: ROUTE_ROLES.fabrication },
	{ key: 'install', label: 'Install', hint: 'Crews, dates and SWMS for every install.', icon: Truck, roles: ROUTE_ROLES.installation },
];

/** A repeating or one-off task for the workshop itself (cleaning, servicing), not tied to a customer job. */
function WorkshopTaskForm({ onClose }: { onClose: () => void }) {
	const make = useCreateWorkshopTask();
	const { notify } = useToast();
	const [f, setF] = useState({ name: '', scheduled_date: '', every: '', unit: 'weeks' });
	return (
		<Dialog title="Add workshop task" onClose={onClose}>
		<form
			className="inline-form"
			onSubmit={(e) => {
				e.preventDefault();
				make.mutate(
					{ name: f.name.trim(), scheduled_date: f.scheduled_date || undefined, repeat: f.every ? { every: Number(f.every), unit: f.unit } : undefined },
					{ onSuccess: () => { onClose(); notify('Workshop task created'); }, onError: (er) => notify(er instanceof Error ? er.message : 'Could not create the task', 'error') },
				);
			}}
		>
			<label style={{ flex: '2 1 260px' }}><span className="toolbar__label">Workshop task</span><input value={f.name} required maxLength={200} autoFocus onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="For example: clean the spray booth" /></label>
			<label><span className="toolbar__label">Scheduled</span><input type="date" value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></label>
			<label style={{ flex: '0 1 120px' }}><span className="toolbar__label">Repeat every</span><input type="number" min={1} max={52} inputMode="numeric" value={f.every} onChange={(e) => setF({ ...f, every: e.target.value })} /></label>
			<label style={{ flex: '0 1 130px' }}><span className="toolbar__label">Unit</span><select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}><option>days</option><option>weeks</option><option>months</option></select></label>
			<button className="btn" disabled={make.isPending || !f.name.trim()}>{make.isPending ? 'Saving…' : 'Create'}</button>
			<button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
		</form>
		</Dialog>
	);
}

/**
 * The task board: one screen for design, fabrication and install. The trade tabs lead the page (the choice that changes everything
 * below), then the saved views, search, and the board or list for that trade. One request serves the whole trade.
 */
export function TaskBoard() {
	const me = useMe();
	const [params, setParams] = useSearchParams();
	const [adding, setAdding] = useState(false);
	const [layout, setLayout] = useState<'list' | 'board'>('board');
	const roles = me.data?.roles ?? [];
	const allowed = TYPES.filter((t) => !t.roles || roles.some((r) => t.roles?.includes(r)));
	const wanted = params.get('type');
	// No ?type= in the link: open the trade the person chose last time, else the first trade their role can see.
	const saved = (() => { try { return localStorage.getItem(TYPE_KEY); } catch { return null; } })();
	const active = allowed.find((t) => t.key === wanted) ?? allowed.find((t) => t.key === saved) ?? allowed[0];

	return (
		<>
			<PageHeader eyebrow="Work" title="Task board" subtitle={active?.hint ?? 'Every open task by stage. Overdue tasks are marked.'}>
				{me.data?.permissions.createTask && active?.key === 'fabrication' && !adding && (
					<button className="btn btn-ghost" onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" /> Workshop task</button>
				)}
			</PageHeader>

			{active && (
				<nav className="type-tabs" aria-label="Task type">
					{allowed.length > 1 && allowed.map((t) => {
						const Icon = t.icon;
						return (
							<button key={t.key} type="button" className={'type-tab' + (active?.key === t.key ? ' on' : '')} aria-current={active?.key === t.key ? 'page' : undefined} onClick={() => { try { localStorage.setItem(TYPE_KEY, t.key); } catch { /* private mode: the choice is just not remembered */ } setParams({ type: t.key }, { replace: true }); }}>
								<Icon size={16} aria-hidden="true" /> {t.label}
							</button>
						);
					})}
					<div className="type-tabs__end"><LayoutToggle value={layout} onChange={setLayout} /></div>
				</nav>
			)}

			{adding && active?.key === 'fabrication' && <WorkshopTaskForm onClose={() => setAdding(false)} />}

			{active ? <WorkList key={active.key} kind={active.key} embedded layout={layout} /> : me.isSuccess && <p className="table-empty">There are no task boards for your role.</p>}
		</>
	);
}
