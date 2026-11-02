import { useEffect, useRef, useState } from 'react';
import { Clock, Hammer, Moon, ShieldCheck, Sun } from 'lucide-react';
import logo from '../assets/visual_exposure_logo.avif';
import { useTheme } from '../components/theme';
import './Login.css';

const SDK_SRC = 'https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js';
const INIT_SRC = '/__catalyst/sdk/init.js';
const FORM_ID = 'loginDivElementId';

declare global {
	interface Window {
		catalyst?: { auth: { signIn: (el: string, cfg?: object) => void; signOut: (redirect: string) => void } };
	}
}

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (document.querySelector(`script[src="${src}"]`)) return resolve();
		const s = document.createElement('script');
		s.src = src;
		s.async = false;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error(`Could not load ${src}`));
		document.head.appendChild(s);
	});
}

const YEAR = new Date().getFullYear();
const POINTS = [
	{ icon: Hammer, text: 'Design, fabrication and install in one place' },
	{ icon: ShieldCheck, text: 'SWMS signed before crews go on site' },
	{ icon: Clock, text: 'Hours and timesheets without the paperwork' },
];

/** The stylesheet Catalyst loads inside its form, one per theme (built by login-frame/build.mjs). */
const frameCss = (theme: string) => new URL(`css/login-frame-${theme}.css`, window.location.href).pathname;

/**
 * Sign-in page: a branded split screen around Catalyst's embedded login form. The form and the real
 * authentication behind it are Catalyst's; we supply the look (layout here, and a stylesheet inside the form).
 * The SDK and /__catalyst/sdk/init.js only exist when the page is served by Catalyst (deployed, or
 * `catalyst serve`), so plain `vite` shows the failure message.
 */
export function Login() {
	const { theme, toggleTheme } = useTheme();
	const [failed, setFailed] = useState(false);
	const ready = useRef<Promise<void> | null>(null);

	// Draw the form, and draw it again with the matching stylesheet when the theme changes.
	useEffect(() => {
		let cancelled = false;
		ready.current ??= loadScript(SDK_SRC).then(() => loadScript(INIT_SRC));
		ready.current
			.then(() => {
				if (cancelled) return;
				const box = document.getElementById(FORM_ID);
				if (box) box.innerHTML = '';
				window.catalyst?.auth.signIn(FORM_ID, { service_url: window.location.pathname, css_url: frameCss(theme) });
			})
			.catch(() => setFailed(true));
		return () => {
			cancelled = true;
		};
	}, [theme]);

	return (
		<div className="login">
			<aside className="login__brand">
				<img className="login__logo" src={logo} alt="Visual Exposure" />
				<div className="login__pitch">
					<p className="login__eyebrow login__eyebrow--light">Projects</p>
					<h2 className="login__headline">
						Signage.
						<br />
						Done properly.
					</h2>
					<ul className="login__points">
						{POINTS.map(({ icon: Icon, text }) => (
							<li key={text}>
								<Icon size={17} aria-hidden="true" />
								{text}
							</li>
						))}
					</ul>
				</div>
				<p className="login__legal">&copy; {YEAR} Visual Exposure Pty Ltd</p>
			</aside>

			<main className="login__main">
				<button
					type="button"
					className="icon-btn login__theme"
					onClick={toggleTheme}
					aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
				>
					{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
				</button>
				<div className="login__card">
					<p className="login__eyebrow">Welcome back</p>
					<h1 className="login__title">Sign in</h1>
					<p className="login__sub">Use your Visual Exposure account to open the project dashboard.</p>
					<div id={FORM_ID} className="login__form" />
					{failed && (
						<p role="alert" className="login__error">
							The sign-in form could not load. Open the app through Catalyst (the deployed address or <code>catalyst serve</code>), not plain <code>vite</code>.
						</p>
					)}
					<p className="login__foot">New to Visual Exposure? Ask an administrator to invite you.</p>
				</div>
			</main>
		</div>
	);
}

export function signOut() {
	window.catalyst?.auth.signOut(window.location.pathname);
}
