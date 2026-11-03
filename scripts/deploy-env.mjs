// Deploys the functions AND makes the Catalyst environment variables match your local ".env" file.
//
// Why: `catalyst deploy` replaces a function's environment variables with the "env_variables" list in its
// catalyst-config.json. That file is committed to git, so secrets must never be written into it permanently.
// This script puts the values from .env into those files only while the deploy runs, then restores the clean files
// (also if the deploy fails or you press Ctrl+C). Secret values are never printed; only key names are.
//
//   node scripts/deploy-env.mjs                 sync, then deploy api, jobs and events with their variables
//   node scripts/deploy-env.mjs api jobs        only these functions
//   node scripts/deploy-env.mjs --dry-run       show which key NAMES each function would get; deploy nothing
//   node scripts/deploy-env.mjs --env-file x    read another env file (used by the tests)
//   --deploy-command "cmd {fn}" --no-sync        replace the real deploy (used by the tests)
//
// Rule of thumb: .env is the single source of truth. A variable that is not in .env is REMOVED from Catalyst on deploy.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Which variables each function receives. Keys not listed for a function are never sent to it. */
export const PLAN = {
	api: ['APP_URL', 'STRATUS_BUCKET', 'CRM_WEBHOOK_SECRET', 'MAIL_FROM', 'ZOHO_DC', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'WORKDRIVE_PARENT_FOLDER_ID'],
	jobs: ['APP_URL', 'MAIL_FROM', 'ZOHO_DC', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN', 'WORKDRIVE_PARENT_FOLDER_ID'],
	events: ['APP_URL', 'MAIL_FROM'],
};
/** Without these the app misbehaves, so the deploy refuses to run (it would otherwise delete them from Catalyst). */
export const REQUIRED = { api: ['APP_URL', 'STRATUS_BUCKET'], jobs: ['APP_URL'], events: ['APP_URL'] };
const ZOHO_ALL_OR_NONE = ['ZOHO_DC', 'ZOHO_CLIENT_ID', 'ZOHO_CLIENT_SECRET', 'ZOHO_REFRESH_TOKEN'];

export function parseEnv(text) {
	return Object.fromEntries(
		text
			.split(/\r?\n/)
			.map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
			.filter(Boolean)
			.map((m) => [m[1], m[2].replace(/^["']|["']$/g, '')])
			.filter(([, v]) => v !== '')
	);
}

/** Pure: what each function would receive, plus the problems that stop a deploy. */
export function plan(env, functions = Object.keys(PLAN)) {
	const out = {};
	const problems = [];
	const zohoSet = ZOHO_ALL_OR_NONE.filter((k) => env[k]);
	if (zohoSet.length && zohoSet.length < ZOHO_ALL_OR_NONE.length) {
		problems.push(`Zoho settings are half filled in: missing ${ZOHO_ALL_OR_NONE.filter((k) => !env[k]).join(', ')}`);
	}
	for (const fn of functions) {
		if (!PLAN[fn]) {
			problems.push(`Unknown function "${fn}" (use: ${Object.keys(PLAN).join(', ')})`);
			continue;
		}
		out[fn] = Object.fromEntries(PLAN[fn].filter((k) => env[k]).map((k) => [k, env[k]]));
		for (const k of REQUIRED[fn]) if (!env[k]) problems.push(`${fn}: ${k} is empty in .env`);
	}
	return { out, problems };
}

// ---- running ----
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const valueOf = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
	const envPath = valueOf('--env-file') || join(root, '.env');
	const backupPath = join(tmpdir(), 've-deploy-env-backup.json');
	const configPath = (fn) => join(root, 'functions', fn, 'catalyst-config.json');

	const restore = () => {
		if (!existsSync(backupPath)) return;
		const saved = JSON.parse(readFileSync(backupPath, 'utf8'));
		for (const [fn, text] of Object.entries(saved)) writeFileSync(configPath(fn), text);
		unlinkSync(backupPath);
	};

	// A previous run that was killed halfway may have left secrets in the config files: put them right first.
	restore();

	if (!existsSync(envPath)) {
		console.error('No .env file found. Copy .env.example to .env and fill it in first.');
		process.exit(1);
	}
	let text = readFileSync(envPath, 'utf8');
	let env = parseEnv(text);

	// The webhook secret is created for you the first time, and kept in .env from then on.
	if (!env.CRM_WEBHOOK_SECRET && !flag('--dry-run')) {
		const secret = randomBytes(32).toString('hex');
		appendFileSync(envPath, `${text.endsWith('\n') ? '' : '\n'}CRM_WEBHOOK_SECRET=${secret}\n`);
		console.log('Created CRM_WEBHOOK_SECRET in .env (use it as the token when you set up the CRM webhook).');
		env = { ...env, CRM_WEBHOOK_SECRET: secret };
	}

	const wanted = args.filter((a, i) => !a.startsWith('--') && !['--env-file', '--deploy-command'].includes(args[i - 1]));
	const { out, problems } = plan(env, wanted.length ? wanted : Object.keys(PLAN));
	if (problems.length) {
		console.error('Not deploying:\n - ' + problems.join('\n - '));
		process.exit(1);
	}

	console.log('Variables each function will have after this deploy (names only):');
	for (const [fn, vars] of Object.entries(out)) console.log(`  ${fn}: ${Object.keys(vars).join(', ') || '(none)'}`);
	if (flag('--dry-run')) {
		console.log('Dry run: nothing was changed or deployed.');
		process.exit(0);
	}

	const run = (cmd) => spawnSync(cmd, { cwd: root, stdio: 'inherit', shell: true }).status === 0;
	const deployCommand = valueOf('--deploy-command') || 'catalyst deploy --only functions:{fn}';
	let code = 0;
	try {
		if (!flag('--no-sync') && !run('npm run sync')) throw new Error('sync failed');
		// Save the clean config files first, so they can be restored whatever happens.
		const originals = Object.fromEntries(Object.keys(out).map((fn) => [fn, readFileSync(configPath(fn), 'utf8')]));
		writeFileSync(backupPath, JSON.stringify(originals));
		const onSignal = () => {
			restore();
			process.exit(130);
		};
		process.on('SIGINT', onSignal);
		process.on('SIGTERM', onSignal);

		for (const [fn, vars] of Object.entries(out)) {
			const cfg = JSON.parse(originals[fn]);
			cfg.deployment.env_variables = vars;
			writeFileSync(configPath(fn), JSON.stringify(cfg, null, '\t') + '\n');
			console.log(`\n== deploying ${fn}`);
			if (!run(deployCommand.replaceAll('{fn}', fn))) throw new Error(`${fn} did not deploy`);
		}
		console.log('\nDone. Catalyst now matches .env for the functions above.');
	} catch (err) {
		console.error(`\nStopped: ${err.message}`);
		code = 1;
	} finally {
		restore();
		const leftover = Object.keys(out).filter((fn) => readFileSync(configPath(fn), 'utf8').includes('env_variables'));
		if (leftover.length) console.error(`WARNING: ${leftover.join(', ')} catalyst-config.json still has env_variables. Do not commit it; run: git checkout -- functions/*/catalyst-config.json`);
	}
	process.exit(code);
}
