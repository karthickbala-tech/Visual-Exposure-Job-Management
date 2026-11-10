import type { DeviceItem } from '../api/types';

const W = 640;
const H = 300;
const PAD = 40;
const initials = (name: string | null) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

/**
 * A schematic map: a 4 by 3 grid with one pin per located device, placed by latitude and longitude scaled to the box
 * (a single device sits in the middle). Pins show the worker's initials; grey pins have not reported for over 24 hours.
 * It is not a street map: the table under it links each device to OpenStreetMap.
 */
export function DeviceMap({ devices }: { devices: DeviceItem[] }) {
	const located = devices.filter((d) => d.lat !== null && d.lng !== null) as (DeviceItem & { lat: number; lng: number })[];
	if (located.length === 0) return <p className="table-empty">No device has reported a location yet.</p>;

	const lats = located.map((d) => d.lat);
	const lngs = located.map((d) => d.lng);
	const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
	const place = (v: number, min: number, max: number, size: number) => (max === min ? size / 2 : PAD + ((v - min) / (max - min)) * (size - 2 * PAD));
	const fresh = located.filter((d) => !d.stale).length;

	return (
		<figure className="device-map">
			<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Schematic map of ${located.length} devices, ${fresh} reporting recently`}>
				<rect x="0" y="0" width={W} height={H} className="device-map__bg" />
				{[1, 2, 3].map((i) => <line key={'v' + i} x1={(W / 4) * i} y1="0" x2={(W / 4) * i} y2={H} className="device-map__grid" />)}
				{[1, 2].map((i) => <line key={'h' + i} x1="0" y1={(H / 3) * i} x2={W} y2={(H / 3) * i} className="device-map__grid" />)}
				{located.map((d) => {
					const x = place(d.lng, minLng, maxLng, W);
					const y = H - place(d.lat, minLat, maxLat, H); // north is up
					return (
						<g key={d.id} transform={`translate(${x} ${y})`} className={d.stale ? 'device-pin device-pin--stale' : 'device-pin'}>
							<title>{`${d.personName ?? 'Unknown'}${d.address ? ', ' + d.address : ''}${d.stale ? ' (not seen for 24 h)' : ''}`}</title>
							<circle r="15" />
							<text textAnchor="middle" dy="4">{initials(d.personName)}</text>
						</g>
					);
				})}
			</svg>
			<figcaption className="muted">{fresh} of {located.length} located devices reporting. Grey pins have not reported for over 24 hours.</figcaption>
		</figure>
	);
}
