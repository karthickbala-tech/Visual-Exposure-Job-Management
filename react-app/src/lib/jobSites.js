// JOB-3: the location and signs shown on Job Details. Pure functions over the site and sign lists.
export const STAGE_TONE = {
  Won: 'green', Quoted: 'amber',
  'Not started': 'gray', 'In design': 'blue', Approved: 'green',
  'In fabrication': 'blue', Complete: 'green',
  Scheduled: 'blue', Installed: 'green',
};

// One entry per site on the job, each with its signs.
export function locationsForJob(jobId, sites, signs) {
  return sites.filter((s) => s.jobId === jobId).map((site) => ({
    site,
    signs: signs.filter((g) => g.jobId === jobId && g.siteId === site.id),
  }));
}

export const addressLine = (s) => [s.address, s.suburb, `${s.state} ${s.postcode}`.trim()].filter(Boolean).join(', ');

export const mapsUrl = (s) => (s.lat != null && s.lng != null
  ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine(s))}`);

// Counts for the header of the Signs card. "Installed" counts signs, and qty is the number of physical pieces.
export function signSummary(signs) {
  return {
    signs: signs.length,
    pieces: signs.reduce((n, g) => n + (Number(g.qty) || 0), 0),
    installed: signs.filter((g) => g.install === 'Installed').length,
  };
}

// Sign groups on a job, in first-seen order, with their sign and piece counts.
export function signGroups(signs) {
  const out = [];
  signs.forEach((g) => {
    let row = out.find((r) => r.name === g.group);
    if (!row) { row = { name: g.group, signs: 0, pieces: 0 }; out.push(row); }
    row.signs += 1;
    row.pieces += Number(g.qty) || 0;
  });
  return out;
}
