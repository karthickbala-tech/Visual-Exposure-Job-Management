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

const missing = ['ZOHO_DC', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_CODE'].filter((k) => !env[k]);
if (missing.length) {
	console.error(`Fill these in .env first: ${missing.join(', ')}`);
	process.exit(1);
}
if (!/^[a-z.]+$/.test(env.ZOHO_DC)) {
	console.error('ZOHO_DC must be the ending of your Zoho address, for example: in, com, com.au, eu');
	process.exit(1);
}

const res = await fetch(`https://accounts.zoho.${env.ZOHO_DC}/oauth/v2/token`, {
	method: 'POST',
	body: new URLSearchParams({ grant_type: 'authorization_code', client_id: env.ZOHO_CLIENT_ID, client_secret: env.ZOHO_CLIENT_SECRET, code: env.ZOHO_CODE }),
});
const data = await res.json().catch(() => ({}));

if (!data.refresh_token) {
	// Zoho's reason is safe to show (invalid_code, invalid_client...); the secret and the code are never echoed.
	console.error('Zoho did not return a refresh token:', data.error || res.status);
	console.error('Common causes: the code was already used or is older than 10 minutes, or ZOHO_DC is the wrong data center.');
	process.exit(1);
}

// Write the token back, and blank the one-time code so it is not left lying around.
const set = (src, key, value) => (new RegExp(`^${key}=.*$`, 'm').test(src) ? src.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`) : `${src.trimEnd()}\n${key}=${value}\n`);
writeFileSync(envPath, set(set(text, 'ZOHO_REFRESH_TOKEN', data.refresh_token), 'ZOHO_CODE', ''));

console.log('Done. ZOHO_REFRESH_TOKEN was written to .env and ZOHO_CODE was cleared.');
console.log(`Granted scopes: ${data.scope || '(not reported)'}`);
console.log('Next: copy the four ZOHO_ values from .env into the Catalyst console (api and jobs functions).');
