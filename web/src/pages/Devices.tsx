import { useDevices, useMe } from '../api/queries';
import { DeviceMap } from '../components/DeviceMap';
import { Card, PageHeader } from '../components/ui';

/** Worker devices and where each was last seen. The list comes from the device sync; nothing is typed in here. */
export function Devices() {
	const me = useMe();
	const allowed = (me.data?.roles ?? []).some((r) => ['admin', 'project_manager', 'fab_manager', 'install_coordinator'].includes(r));
	const list = useDevices(allowed);

	return (
		<>
			<PageHeader eyebrow="Workers" title="Devices" subtitle="Last known location of each worker device." />
			{list.isSuccess && list.data.items.length > 0 && <Card title="Map"><DeviceMap devices={list.data.items} /></Card>}
			<Card flush>
				{!allowed && me.isSuccess && <p className="table-empty">You do not have access to devices.</p>}
				{allowed && list.isPending && <p role="status" className="table-empty">Loading…</p>}
				{allowed && list.isError && <p role="alert">Could not load devices.</p>}
				{list.isSuccess && list.data.items.length === 0 && <p className="table-empty">No devices yet. They appear once the device sync is switched on.</p>}
				{list.isSuccess && list.data.items.length > 0 && (
					<div className="table-wrap">
						<table className="table">
							<caption className="sr-only">Devices</caption>
							<thead>
								<tr>
									<th scope="col">Person</th>
									<th scope="col">Device</th>
									<th scope="col">Last seen</th>
									<th scope="col">Location</th>
								</tr>
							</thead>
							<tbody>
								{list.data.items.map((d) => (
									<tr key={d.id}>
										<td data-label="Person" className="cell-primary">
											<strong>{d.personName ?? '-'}</strong>
										</td>
										<td data-label="Device">{[d.model, d.os].filter(Boolean).join(' / ') || '-'}</td>
										<td data-label="Last seen">
											{d.lastSeenAt ?? 'Never'}
											{d.stale && <span className="chip chip-amber" style={{ marginLeft: 8 }}>Not seen for 24 h</span>}
										</td>
										<td data-label="Location">
											{d.mapUrl ? (
												<a href={d.mapUrl} target="_blank" rel="noopener noreferrer">
													{d.address || `${d.lat?.toFixed(4)}, ${d.lng?.toFixed(4)}`}
												</a>
											) : (
												'-'
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</Card>
		</>
	);
}
