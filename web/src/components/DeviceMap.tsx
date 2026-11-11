import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DeviceItem } from '../api/types';

const initials = (name: string | null) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

type Located = DeviceItem & { lat: number; lng: number };

/**
 * A street map (OpenStreetMap tiles through Leaflet) with one pin per located device. Pins show the worker's initials; grey pins have
 * not reported for over 24 hours. The map is only built when a device has a location. Names and addresses come from the database, so
 * they go into the page as text (elements), never as HTML.
 */
export function DeviceMap({ devices }: { devices: DeviceItem[] }) {
	const box = useRef<HTMLDivElement>(null);
	const located = useMemo(() => devices.filter((d) => d.lat !== null && d.lng !== null) as Located[], [devices]);
	const fresh = located.filter((d) => !d.stale).length;

	useEffect(() => {
		if (!box.current || located.length === 0) return;
		const map = L.map(box.current, { scrollWheelZoom: false });
		L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);

		for (const d of located) {
			const pin = document.createElement('span');
			pin.className = 'device-pin-dot' + (d.stale ? ' device-pin-dot--stale' : '');
			pin.textContent = initials(d.personName);
			const tip = document.createElement('span');
			tip.textContent = `${d.personName ?? 'Unknown'}${d.address ? ', ' + d.address : ''}${d.stale ? ' (not seen for 24 h)' : ''}`;
			L.marker([d.lat, d.lng], { icon: L.divIcon({ html: pin, className: 'device-pin-wrap', iconSize: [30, 30], iconAnchor: [15, 15] }), keyboard: false })
				.bindTooltip(tip)
				.addTo(map);
		}

		// Fit the pins in the box; do it again whenever the box changes size (a phone turning, the layout settling), or the pins drift out of view.
		const fit = () => {
			map.invalidateSize();
			if (located.length === 1) map.setView([located[0].lat, located[0].lng], 14);
			else map.fitBounds(L.latLngBounds(located.map((d) => [d.lat, d.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
		};
		fit();
		const watch = new ResizeObserver(fit);
		watch.observe(box.current);

		return () => {
			watch.disconnect();
			map.remove();
		};
	}, [located]);

	if (located.length === 0) return <p className="table-empty">No device has reported a location yet.</p>;

	return (
		<figure className="device-map">
			<div ref={box} className="device-map__canvas" role="region" aria-label={`Map of ${located.length} devices, ${fresh} reporting recently`} />
			<figcaption className="muted">{fresh} of {located.length} located devices reporting. Grey pins have not reported for over 24 hours. Use the + and - buttons to zoom.</figcaption>
		</figure>
	);
}
