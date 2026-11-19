// Exchanges a Zoho Self Client "code" for a refresh token, on YOUR machine.
// Reads ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_CODE from the ".env" file in the project root, and writes
// the refresh token back into the same file as ZOHO_REFRESH_TOKEN. Nothing secret is printed, so nobody needs to see it.
//
//   1. Copy .env.example to .env and fill in ZOHO_DC, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET.
//   2. In the Zoho API console (Self Client > Generate Code) create a code with the scope
//        ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,WorkDrive.files.ALL,WorkDrive.team.READ   (10 minutes)
//      and paste it as ZOHO_CODE in .env.
//   3. Run:  node scripts/zoho-token.mjs
//   4. Open .env, copy the four ZOHO_ values into the Catalyst console (Functions > api > Environment Variables, and the
//      same four on "jobs"). That is the only place the app reads them from once deployed.
//
// ManageEngine MDM (its own token, because the MDM account can be another Zoho account):
//   node scripts/zoho-token.mjs --mdm
//   reads MDM_CODE (scope MDMOnDemand.MDMInventory.READ, made in the API console of the MDM account), and MDM_DC,
//   MDM_CLIENT_ID, MDM_CLIENT_SECRET (each falls back to its ZOHO_ value), and writes MDM_REFRESH_TOKEN.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
if (!existsSync(envPath)) {
	console.error('No .env file found. Copy .env.example to .env and fill it in first.');
	process.exit(1);
}

const text = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
	text
		.split(/\r?\n/)
		.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
		.filter(Boolean)
		.map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
);

const forMdm = process.argv.includes('--mdm');
const P = forMdm ? 'MDM' : 'ZOHO';
// For MDM each setting may fall back to the ZOHO_ one (same OAuth client, same data center), except the one-time code.
const pick = (k) => env[`${P}_${k}`] || (forMdm && k !== 'CODE' ? env[`ZOHO_${k}`] : '');
const cfg = { DC: pick('DC'), CLIENT_ID: pick('CLIENT_ID'), CLIENT_SECRET: pick('CLIENT_SECRET'), CODE: pick('CODE') };
const missing = Object.keys(cfg).filter((k) => !cfg[k]).map((k) => `${P}_${k}`);
if (missing.length) {
	console.error(`Fill these in .env first: ${missing.join(', ')}`);
	process.exit(1);
}
if (!/^[a-z.]+$/.test(cfg.DC)) {
	console.error(`${P}_DC must be the ending of your Zoho address, for example: in, com, com.au, eu`);
	process.exit(1);
}

const res = await fetch(`https://accounts.zoho.${cfg.DC}/oauth/v2/token`, {
	method: 'POST',
	body: new URLSearchParams({ grant_type: 'authorization_code', client_id: cfg.CLIENT_ID, client_secret: cfg.CLIENT_SECRET, code: cfg.CODE }),
});
const data = await res.json().catch(() => ({}));

if (!data.refresh_token) {
	// Zoho's reason is safe to show (invalid_code, invalid_client...); the secret and the code are never echoed.
	console.error('Zoho did not return a refresh token:', data.error || res.status);
	console.error(`Common causes: the code was already used or is older than 10 minutes, or ${P}_DC is the wrong data center.`);
	process.exit(1);
}

// Write the token back, and blank the one-time code so it is not left lying around.
const set = (src, key, value) => (new RegExp(`^${key}=.*$`, 'm').test(src) ? src.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`) : `${src.trimEnd()}\n${key}=${value}\n`);
writeFileSync(envPath, set(set(text, `${P}_REFRESH_TOKEN`, data.refresh_token), `${P}_CODE`, ''));

console.log(`Done. ${P}_REFRESH_TOKEN was written to .env and ${P}_CODE was cleared.`);
console.log(`Granted scopes: ${data.scope || '(not reported)'}`);
console.log('Next: npm run deploy:env (it sends the values in .env to the api and jobs functions).');
