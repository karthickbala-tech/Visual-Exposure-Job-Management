import { useMemo, useState } from 'react';
import { useDevices, useMe, usePeople } from '../api/queries';
import type { DeviceItem } from '../api/types';
import { DeviceMap } from '../components/DeviceMap';
import { Card, PageHeader } from '../components/ui';
import { ToolbarMenu } from '../components/ListToolbar';
import { GridStatusBar, ResizableGrid, RowHeightPicker, gridWidths, useGridLayout } from '../components/GridKit';
import type { GridColumn } from '../components/GridKit';

const COLUMNS: GridColumn<DeviceItem>[] = [
	{ key: 'person', label: 'Person', width: 200, cell: (d) => <strong>{d.personName ?? '-'}</strong> },
	{ key: 'device', label: 'Device', width: 220, cell: (d) => [d.model, d.os].filter(Boolean).join(' / ') || '-' },
	{ key: 'seen', label: 'Last seen', width: 240, cell: (d) => (
		<>
			{d.lastSeenAt ?? 'Never'}
			{d.stale && <span className="chip chip-amber" style={{ marginLeft: 8 }}>Not seen for 24 h</span>}
		</>
	) },
	{ key: 'location', label: 'Location', width: 280, cell: (d) => (
		d.mapUrl ? (
			<a href={d.mapUrl} target="_blank" rel="noopener noreferrer">
				{d.address || `${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`}
			</a>
		) : (
			'-'
		)
	) },
];
const WIDTHS = gridWidths(COLUMNS);

/** One active worker and their device, for "workers with / without a device" (EQP-4, the Creator "Workers with Devices" report). */
interface WorkerRow { id: string; name: string; device: DeviceItem | null }
const WORKER_COLUMNS: GridColumn<WorkerRow>[] = [
	{ key: 'person', label: 'Worker', width: 220, cell: (w) => <strong>{w.name}</strong> },
	{ key: 'device', label: 'Device', width: 240, cell: (w) => (w.device ? [w.device.model, w.device.os].filter(Boolean).join(' / ') || 'Device' : <span className="chip chip-amber">No device</span>) },
	{ key: 'seen', label: 'Last seen', width: 220, cell: (w) => (w.device ? w.device.lastSeenAt ?? 'Never' : '-') },
];
const WORKER_WIDTHS = gridWidths(WORKER_COLUMNS);
type WorkerFilter = 'all' | 'with' | 'without';

/** Worker devices and where each was last seen. The list comes from the device sync; nothing is typed in here. */
export function Devices() {
	const me = useMe();
	const allowed = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'fab_manager', 'install_coordinator'].includes(r));
	const list = useDevices(allowed);
	const grid = useGridLayout('ve.grid.devices', WIDTHS);
	const workerGrid = useGridLayout('ve.grid.device-workers', WORKER_WIDTHS);
	const [view, setView] = useState<'list' | 'map' | 'workers'>('list');
	const [who, setWho] = useState<WorkerFilter>('all');
	const showMap = view === 'map' && list.isSuccess && list.data.items.length > 0;
	// The people list is read only when the Workers view is open.
	const people = usePeople(allowed && view === 'workers');
	const workers = useMemo<WorkerRow[]>(() => {
		const byPerson = new Map((list.data?.items ?? []).filter((d) => d.personId).map((d) => [String(d.personId), d]));
		return (people.data?.items ?? [])
			.filter((p) => p.is_active !== false)
			.map((p) => ({ id: p.ROWID, name: `${p.first_name} ${p.last_name ?? ''}`.trim(), device: byPerson.get(p.ROWID) ?? null }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [people.data, list.data]);
	const withDevice = workers.filter((w) => w.device).length;
	const shownWorkers = workers.filter((w) => (who === 'with' ? w.device : who === 'without' ? !w.device : true));

	return (
		<>
			<PageHeader eyebrow="Assets" title="Devices" subtitle="Last known location of each worker device.">
				<div className="lt-actions">
					<div className="segmented" role="group" aria-label="Devices view">
						{(['list', 'map', 'workers'] as const).map((v) => (
							<button key={v} type="button" className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => setView(v)}>
								{v}
							</button>
						))}
					</div>
					{view === 'list' && (
						<ToolbarMenu label="View" ariaLabel="View options" align="right">
							<p className="filter-pop__title">Row height</p>
							<RowHeightPicker value={grid.rows} onChange={grid.setRows} />
							<div className="filter-pop__actions">
								<button type="button" className="btn btn-ghost btn-sm" onClick={grid.reset}>Reset widths</button>
							</div>
						</ToolbarMenu>
					)}
				</div>
			</PageHeader>
			{showMap && list.isSuccess && <Card title="Map"><DeviceMap devices={list.data.items} large /></Card>}
			{view === 'workers' && (
				<Card flush>
					<div className="list-toolbar">
						<div className="segmented" role="group" aria-label="Workers">
							{([['all', 'All workers', workers.length], ['with', 'With a device', withDevice], ['without', 'Without a device', workers.length - withDevice]] as const).map(([k, label, n]) => (
								<button key={k} type="button" className={who === k ? 'on' : ''} aria-pressed={who === k} onClick={() => setWho(k)}>
									{label} <span className="tab-count">{n}</span>
								</button>
							))}
						</div>
					</div>
					{(people.isPending || list.isPending) && <p role="status" className="table-empty">Loading…</p>}
					{people.isError && <p role="alert">Could not load the workers.</p>}
					{people.isSuccess && shownWorkers.length === 0 && <p className="table-empty">Nobody in this view.</p>}
					{people.isSuccess && shownWorkers.length > 0 && <ResizableGrid layout={workerGrid} label="Workers and their devices" columns={WORKER_COLUMNS} rows={shownWorkers} rowKey={(w) => w.id} />}
					{people.isSuccess && <GridStatusBar text={`Showing ${shownWorkers.length} of ${workers.length}`} />}
				</Card>
			)}
			{!showMap && view !== 'workers' && (
				<Card flush>
					{!allowed && me.isSuccess && <p className="table-empty">You do not have access to devices.</p>}
					{allowed && list.isPending && <p role="status" className="table-empty">Loading…</p>}
					{allowed && list.isError && <p role="alert">Could not load devices.</p>}
					{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No devices yet. They appear once the device sync is switched on.</p>}
					{list.isSuccess && list.data.items.length > 0 && (
						<ResizableGrid layout={grid} label="Devices" columns={COLUMNS} rows={list.data.items} rowKey={(d) => d.id} />
					)}
					{list.isSuccess && !showMap && <GridStatusBar text={`Showing ${list.data.items.length} of ${list.data.items.length}`} />}
				</Card>
			)}
		</>
	);
}
