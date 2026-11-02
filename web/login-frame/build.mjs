// Builds the stylesheets Catalyst loads inside its sign-in frame, for each theme and each page of the flow:
//   Catalyst's own default sheet (unchanged)  +  theme colours  +  our overrides.
//   sign-in page   -> public/css/login-frame-light.css / -dark.css
//   password reset -> public/css/login-frame-reset-light.css / -dark.css
// Run with: node login-frame/build.mjs   (output goes to public/css, which is deployed with the app)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const overrides = readFileSync(join(here, 'overrides.css'), 'utf8');

// Same values as src/styles/tokens.css, so the form matches the page around it.
const THEMES = {
	light: { ink: '#1b1b1e', 'ink-2': '#44484c', muted: '#5f6368', line: '#cdd1cc', 'input-bg': '#ffffff', brand: '#68b04d', 'brand-hover': '#5a9a41', 'brand-strong': '#3f7a2b', 'brand-soft': '#e8f2e2', 'on-brand': '#10190b', danger: '#e02424' },
	dark: { ink: '#eceeef', 'ink-2': '#c3c7ca', muted: '#9aa0a5', line: '#3b3f44', 'input-bg': '#16181a', brand: '#68b04d', 'brand-hover': '#79bd5c', 'brand-strong': '#86c96a', 'brand-soft': '#1f2e18', 'on-brand': '#10190b', danger: '#ff6b63' },
};

// The reset page keeps its own title (the sign-in page's title is supplied by our page instead).
const PAGES = [
	{ out: 'login-frame', base: 'embedded_signin.base.css', extra: '' },
	{ out: 'login-frame-reset', base: 'embedded_password_reset.base.css', extra: '\n#headtitle { display: block !important; margin: 0 0 14px !important; font-size: 17px !important; font-weight: 700 !important; color: var(--f-ink) !important; }\n.signin_head, .alt_signin_head { margin-bottom: 8px !important; }\n' },
];

// The font address contains semicolons, so match up to the closing bracket of url(...), not the first semicolon.
const importLine = overrides.match(/@import url\([^)]*\);/)?.[0] ?? '';
const body = overrides.replace(importLine, '');

mkdirSync(join(here, '..', 'public', 'css'), { recursive: true });
for (const page of PAGES) {
	const base = readFileSync(join(here, page.base), 'utf8');
	for (const [name, vars] of Object.entries(THEMES)) {
		// color-scheme matters: if the frame's scheme differs from the page's, the browser paints an opaque white backdrop.
		const root = ':root {\n' + Object.entries(vars).map(([k, v]) => `\t--f-${k}: ${v};`).join('\n') + `\n\tcolor-scheme: ${name};\n}\n`;
		// @import must come first in a stylesheet, so it is placed at the top.
		const css = `${importLine}\n/* Catalyst default stylesheet (unchanged) */\n${base}\n/* Visual Exposure theme: ${name} */\n${root}${body}${page.extra}`;
		writeFileSync(join(here, '..', 'public', 'css', `${page.out}-${name}.css`), css);
		console.log(`${page.out}-${name}.css`, css.length, 'bytes');
	}
}
