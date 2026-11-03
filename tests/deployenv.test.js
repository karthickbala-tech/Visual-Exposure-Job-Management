'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../scripts/deploy-env.mjs');

test('parseEnv reads KEY=value lines, ignores comments and empty values, strips quotes', async () => {
	const { parseEnv } = await load();
	const env = parseEnv('# comment\nA=1\nB="two"\nC=\nD = spaced \r\nlowercase=no\n');
	assert.deepEqual(env, { A: '1', B: 'two', D: 'spaced' });
});

test('each function only receives the variables meant for it', async () => {
	const { plan } = await load();
	const env = { APP_URL: 'u', STRATUS_BUCKET: 'b', CRM_WEBHOOK_SECRET: 's', ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'i', ZOHO_CLIENT_SECRET: 'x', ZOHO_REFRESH_TOKEN: 'r', WORKDRIVE_PARENT_FOLDER_ID: 'p', UNRELATED: 'z' };
	const { out, problems } = plan(env);
	assert.deepEqual(problems, []);
	assert.ok('CRM_WEBHOOK_SECRET' in out.api && !('CRM_WEBHOOK_SECRET' in out.jobs), 'the webhook secret is only for the api');
	assert.ok(!('STRATUS_BUCKET' in out.jobs));
	assert.deepEqual(Object.keys(out.events).sort(), ['APP_URL']);
	for (const fn of Object.values(out)) assert.ok(!('UNRELATED' in fn));
});

test('it refuses to deploy when a needed value is missing, or Zoho is half filled in', async () => {
	const { plan } = await load();
	assert.match(plan({ STRATUS_BUCKET: 'b' }).problems.join(), /api: APP_URL is empty/);
	assert.match(plan({ APP_URL: 'u', STRATUS_BUCKET: 'b', ZOHO_DC: 'in', ZOHO_CLIENT_ID: 'i' }).problems.join(), /half filled in: missing ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN/);
	assert.match(plan({ APP_URL: 'u', STRATUS_BUCKET: 'b' }, ['nope']).problems.join(), /Unknown function/);
	assert.deepEqual(plan({ APP_URL: 'u', STRATUS_BUCKET: 'b' }).problems, [], 'Zoho can be left out entirely');
});

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const cfgPath = (fn) => path.join(ROOT, 'functions', fn, 'catalyst-config.json');
const snapshot = () => Object.fromEntries(['api', 'jobs', 'events'].map((fn) => [fn, fs.readFileSync(cfgPath(fn), 'utf8')]));

function runScript(extraArgs, envText) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 've-env-test-'));
	const envFile = path.join(dir, 'fake.env');
	fs.writeFileSync(envFile, envText);
	// The fake deploy records what the config file contained at deploy time, and fails for the function named in FAIL_ON.
	const probe = path.join(dir, 'probe.js');
	const lines = [
		"const fs = require('fs');",
		"const fn = process.argv[2];",
		"const c = JSON.parse(fs.readFileSync(" + JSON.stringify(path.join(ROOT, 'functions')) + " + '/' + fn + '/catalyst-config.json', 'utf8'));",
		"fs.appendFileSync(" + JSON.stringify(path.join(dir, 'seen.log')) + ", fn + ':' + JSON.stringify(c.deployment.env_variables || null) + require('os').EOL);",
		"process.exit(process.env.FAIL_ON === fn ? 1 : 0);",
	];
	fs.writeFileSync(probe, lines.join(require('os').EOL));
	const res = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'deploy-env.mjs'), '--env-file', envFile, '--no-sync', '--deploy-command', `"${process.execPath}" "${probe}" {fn}`, ...extraArgs], {
		encoding: 'utf8',
		env: { ...process.env, FAIL_ON: process.env.FAIL_ON_TEST || '' },
	});
	const seen = fs.existsSync(path.join(dir, 'seen.log')) ? fs.readFileSync(path.join(dir, 'seen.log'), 'utf8').trim().split('\n') : [];
	return { res, seen };
}
const GOOD_ENV = 'APP_URL=https://example.test\nSTRATUS_BUCKET=bkt\nCRM_WEBHOOK_SECRET=hook\nZOHO_DC=in\nZOHO_CLIENT_ID=id1\nZOHO_CLIENT_SECRET=SECRET-ONE\nZOHO_REFRESH_TOKEN=REFRESH-ONE\n';

test('deploy-env: values are in the config only while deploying, then the files are restored exactly; no secret is printed', () => {
	const before = snapshot();
	const { res, seen } = runScript([], GOOD_ENV);
	assert.equal(res.status, 0, res.stderr);
	assert.equal(seen.length, 3);
	assert.match(seen.find((l) => l.startsWith('api:')), /"ZOHO_CLIENT_SECRET":"SECRET-ONE"/, 'api had the secret at deploy time');
	assert.doesNotMatch(seen.find((l) => l.startsWith('events:')), /SECRET-ONE/, 'events never gets the secret');
	assert.deepEqual(snapshot(), before, 'config files are back to their committed content');
	assert.doesNotMatch(res.stdout + res.stderr, /SECRET-ONE|REFRESH-ONE/, 'secrets are never printed');
});

test('deploy-env: a failing deploy stops, still restores the files, and exits with an error', () => {
	const before = snapshot();
	process.env.FAIL_ON_TEST = 'jobs';
	try {
		const { res, seen } = runScript([], GOOD_ENV);
		assert.notEqual(res.status, 0);
		assert.deepEqual(seen.map((l) => l.split(':')[0]), ['api', 'jobs'], 'events was not attempted after jobs failed');
	} finally {
		delete process.env.FAIL_ON_TEST;
	}
	assert.deepEqual(snapshot(), before);
});

test('deploy-env: an incomplete .env deploys nothing and changes nothing', () => {
	const before = snapshot();
	const { res, seen } = runScript([], 'STRATUS_BUCKET=bkt\n');
	assert.notEqual(res.status, 0);
	assert.match(res.stderr, /APP_URL is empty/);
	assert.equal(seen.length, 0);
	assert.deepEqual(snapshot(), before);
});

test('deploy-env: a leftover from a crashed run is cleaned up at the next start', () => {
	const before = snapshot();
	const backup = path.join(os.tmpdir(), 've-deploy-env-backup.json');
	// Simulate a crash: secrets are in the api config and the clean copy is in the backup file.
	const dirty = JSON.parse(before.api);
	dirty.deployment.env_variables = { ZOHO_CLIENT_SECRET: 'LEFTOVER-SECRET' };
	fs.writeFileSync(cfgPath('api'), JSON.stringify(dirty));
	fs.writeFileSync(backup, JSON.stringify({ api: before.api }));
	try {
		runScript(['--dry-run'], GOOD_ENV);
		assert.deepEqual(snapshot(), before, 'the next run put the clean file back');
		assert.equal(fs.existsSync(backup), false);
	} finally {
		fs.writeFileSync(cfgPath('api'), before.api);
		if (fs.existsSync(backup)) fs.unlinkSync(backup);
	}
});
