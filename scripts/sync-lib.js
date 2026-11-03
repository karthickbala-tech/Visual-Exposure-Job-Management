'use strict';
/**
 * Copies the shared lib/ into each function (functions/<name>/lib) before deploy.
 * Catalyst packages one folder per function, so shared code must live inside it.
 * The copies are build output: git-ignored, never edit them.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'lib');
const functionsDir = path.join(root, 'functions');

for (const name of fs.readdirSync(functionsDir)) {
	const dir = path.join(functionsDir, name);
	if (!fs.statSync(dir).isDirectory()) continue;
	const target = path.join(dir, 'lib');
	fs.rmSync(target, { recursive: true, force: true });
	fs.cpSync(source, target, { recursive: true });
	console.log(`synced lib -> functions/${name}/lib`);
}
