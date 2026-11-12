import { useState } from 'react';
import { useDevices, useMe } from '../api/queries';
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

/** Worker devices and where each was last seen. The list comes from the device sync; nothing is typed in here. */
export function Devices() {
	const me = useMe();
	const allowed = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'fab_manager', 'install_coordinator'].includes(r));
	const list = useDevices(allowed);
	const grid = useGridLayout('ve.grid.devices', WIDTHS);
	const [view, setView] = useState<'list' | 'map'>('list');
	const showMap = view === 'map' && list.isSuccess && list.data.items.length > 0;

	return (
		<>
			<PageHeader eyebrow="Assets" title="Devices" subtitle="Last known location of each worker device.">
				<div className="lt-actions">
					<div className="segmented" role="group" aria-label="Devices view">
						{(['list', 'map'] as const).map((v) => (
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
			{!showMap && (
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
