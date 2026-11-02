// Builds the two stylesheets Catalyst loads inside its sign-in frame (one per theme):
//   Catalyst's own default sheet (unchanged)  +  theme colours  +  our overrides.
// Run with: node login-frame/build.mjs   (output goes to public/css, which is deployed with the app)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const base = readFileSync(join(here, 'embedded_signin.base.css'), 'utf8');
const overrides = readFileSync(join(here, 'overrides.css'), 'utf8');

// Same values as src/styles/tokens.css, so the form matches the page around it.
const THEMES = {
	light: { ink: '#1b1b1e', 'ink-2': '#44484c', muted: '#5f6368', line: '#cdd1cc', 'input-bg': '#ffffff', brand: '#68b04d', 'brand-hover': '#5a9a41', 'brand-strong': '#3f7a2b', 'brand-soft': '#e8f2e2', 'on-brand': '#10190b', danger: '#e02424' },
	dark: { ink: '#eceeef', 'ink-2': '#c3c7ca', muted: '#9aa0a5', line: '#3b3f44', 'input-bg': '#16181a', brand: '#68b04d', 'brand-hover': '#79bd5c', 'brand-strong': '#86c96a', 'brand-soft': '#1f2e18', 'on-brand': '#10190b', danger: '#ff6b63' },
};

mkdirSync(join(here, '..', 'public', 'css'), { recursive: true });
for (const [name, vars] of Object.entries(THEMES)) {
	const root = ':root {\n' + Object.entries(vars).map(([k, v]) => `\t--f-${k}: ${v};`).join('\n') + '\n}\n';
	// @import must come first in a stylesheet, so it is lifted out of the overrides and placed at the top.
	// (the font address contains semicolons, so match up to the closing bracket of url(...), not the first semicolon)
	const importLine = overrides.match(/@import url\([^)]*\);/)?.[0] ?? '';
	const body = overrides.replace(importLine, '');
	const css = `${importLine}\n/* Catalyst default embedded sign-in stylesheet (unchanged) */\n${base}\n/* Visual Exposure theme: ${name} */\n${root}${body}`;
	writeFileSync(join(here, '..', 'public', 'css', `login-frame-${name}.css`), css);
	console.log(`login-frame-${name}.css`, css.length, 'bytes');
}
