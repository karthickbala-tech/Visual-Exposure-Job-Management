// Helpers for the Devices screen.
export const STALE_HOURS = 24;

export const hasLocation = (d) => typeof d.lat === 'number' && typeof d.lng === 'number';
export const isStale = (d, now = Date.now()) => !d.seenAt || now - new Date(d.seenAt).getTime() > STALE_HOURS * 3600000;

// Scales latitude and longitude into a w x h picture, north at the top. A single point sits in the middle.
export function toMapPoints(devices, w, h, pad = 40) {
  const pts = devices.filter(hasLocation);
  if (!pts.length) return [];
  const lats = pts.map((d) => d.lat);
  const lngs = pts.map((d) => d.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const sx = maxLng === minLng ? 0.5 : null;
  const sy = maxLat === minLat ? 0.5 : null;
  return pts.map((d) => ({
    id: d.id,
    x: pad + (sx ?? (d.lng - minLng) / (maxLng - minLng)) * (w - 2 * pad),
    y: pad + (sy ?? (maxLat - d.lat) / (maxLat - minLat)) * (h - 2 * pad),
  }));
}

export const osmLink = (d) => `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=15/${d.lat}/${d.lng}`;
