// Read-only look at your Zoho CRM "Deals" module, using the same credentials as the app (from .env).
// Prints ONLY non-secret facts: field names and types, the stage values, and a few sample deals.
// Nothing is changed in the CRM and no credential is printed.
//   node scripts/zoho-crm-peek.mjs            fields + stages + 5 sample deals
//   node scripts/zoho-crm-peek.mjs --deals 10 more sample deals
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (!existsSync(envPath)) {
	console.error('No .env file found.');
	process.exit(1);
}
const env = Object.fromEntries(
	readFileSync(envPath, 'utf8')
		.split(/\r?\n/)
		.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
		.filter(Boolean)
		.map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);
for (const k of ['ZOHO_DC', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN']) {
	if (!env[k]) {
		console.error(`${k} is empty in .env`);
		process.exit(1);
	}
}
const dc = env.ZOHO_DC;
const want = Number(process.argv.includes('--deals') ? process.argv[process.argv.indexOf('--deals') + 1] : 5) || 5;

const tok = await (
	await fetch(`https://accounts.zoho.${dc}/oauth/v2/token`, {
		method: 'POST',
		body: new URLSearchParams({ grant_type: 'refresh_token', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, refresh_token: env.ZOHO_REFRESH_TOKEN }),
	})
).json();
if (!tok.access_token) {
	console.error('Zoho refused the credentials:', tok.error || 'unknown');
	process.exit(1);
}
const get = async (path) => {
	const res = await fetch(`https://www.zohoapis.${dc}/crm/v8${path}`, { headers: { Authorization: `Zoho-oauthtoken ${tok.access_token}` } });
	const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(`${path.split('?')[0]} -> HTTP ${res.status} ${body.code || body.message || ''}`);
	return body;
};

try {
	const f = await get('/settings/fields?module=Deals');
	const fields = f.fields || [];
	console.log(`Deals module: ${fields.length} fields`);
	console.log('\nField API name | label | type | custom?');
	for (const x of fields) console.log(`${x.api_name} | ${x.field_label} | ${x.data_type}${x.custom_field ? ' | custom' : ''}`);

	const stage = fields.find((x) => x.api_name === 'Stage');
	if (stage && stage.pick_list_values) {
		console.log('\nStage values (what you can set on a deal):');
		console.log(stage.pick_list_values.map((v) => v.actual_value).join(' | '));
	}

	const list = await get(`/Deals?fields=id,Deal_Name,Stage,Amount,Closing_Date,Owner&per_page=${Math.min(want, 50)}`);
	console.log(`\nSample deals (${(list.data || []).length}):`);
	for (const d of list.data || []) console.log(`${d.id} | ${d.Deal_Name} | ${d.Stage} | ${d.Amount ?? '-'} | ${d.Closing_Date || '-'} | owner: ${(d.Owner && d.Owner.email) || (d.Owner && d.Owner.name) || '-'}`);
	if (!(list.data || []).length) console.log('(no deals in this CRM yet)');
} catch (err) {
	console.error('Could not read the CRM:', err.message);
	process.exit(1);
}
