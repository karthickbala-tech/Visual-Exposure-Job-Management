// Exchanges a Zoho Self Client "code" for a refresh token, on YOUR machine, so the client secret never has to be
// pasted into a chat or a file. Prints only the refresh token (and which data center it is for).
//
// Run (PowerShell), after generating the code in the Zoho API console (Self Client, Generate Code tab):
//   $env:ZOHO_CLIENT_ID = "1000.xxxx"
//   $env:ZOHO_CLIENT_SECRET = "xxxx"
//   $env:ZOHO_CODE = "1000.xxxx"
//   $env:ZOHO_DC = "in"          # in, com, com.au, eu ... the ending of your CRM address (crm.zoho.in -> in)
//   node scripts/zoho-token.mjs
//   Remove-Item Env:ZOHO_CLIENT_SECRET, Env:ZOHO_CODE   # then clear them again
//
// Then put the three values into the Catalyst console (Functions > api > Environment Variables, and the same on jobs):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_DC
// The code works once and expires in 10 minutes.

const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_CODE, ZOHO_DC = 'in' } = process.env;

if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_CODE) {
	console.error('Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_CODE first (see the comments at the top of this file).');
	process.exit(1);
}
if (!/^[a-z.]+$/.test(ZOHO_DC)) {
	console.error('ZOHO_DC must be the ending of your Zoho address, for example: in, com, com.au, eu');
	process.exit(1);
}

const body = new URLSearchParams({
	grant_type: 'authorization_code',
	client_id: ZOHO_CLIENT_ID,
	client_secret: ZOHO_CLIENT_SECRET,
	code: ZOHO_CODE,
});

const res = await fetch(`https://accounts.zoho.${ZOHO_DC}/oauth/v2/token`, { method: 'POST', body });
const data = await res.json().catch(() => ({}));

if (!data.refresh_token) {
	// Show Zoho's reason (for example invalid_code or invalid_client) but never echo the secret or the code.
	console.error('Zoho did not return a refresh token:', data.error || res.status);
	console.error('Common causes: the code was already used or is older than 10 minutes, or the data center ending is wrong.');
	process.exit(1);
}

console.log(`Data center : ${ZOHO_DC}`);
console.log(`Scopes      : ${data.scope || '(not reported)'}`);
console.log(`Refresh token (keep it private, store it in the Catalyst console only):`);
console.log(data.refresh_token);
