import logo from '../assets/visual_exposure_logo.avif';
import { useEffect, useRef, useState } from 'react';
import './Login.css';

const SDK_SRC = 'https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js';
const INIT_SRC = '/__catalyst/sdk/init.js';

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

const POINTS = ['Design, fabrication and install in one place', 'SWMS signed before crews go on site', 'Hours and timesheets without the paperwork'];

/**
 * Sign-in page: a branded split screen around Catalyst's embedded login form. The form itself (and the
 * real authentication behind it) is Catalyst's; this page only provides the look. The SDK and
 * /__catalyst/sdk/init.js only exist when the page is served by Catalyst (deployed, or `catalyst serve`),
 * so plain `vite` shows the failure message.
 */
export function Login() {
	const [failed, setFailed] = useState(false);
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		(async () => {
			try {
				await loadScript(SDK_SRC);
				await loadScript(INIT_SRC);
				window.catalyst?.auth.signIn('loginDivElementId', { service_url: window.location.pathname });
			} catch {
				setFailed(true);
			}
		})();
	}, []);

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
						{POINTS.map((p) => (
							<li key={p}>{p}</li>
						))}
					</ul>
				</div>
				<p className="login__legal">&copy; {new Date().getFullYear()} Visual Exposure Pty Ltd</p>
			</aside>

			<main className="login__main">
				<div className="login__card">
					<p className="login__eyebrow">Welcome back</p>
					<h1 className="page-title login__title">Sign in</h1>
					<p className="login__sub">Use your Visual Exposure account to open the project dashboard.</p>
					<div id="loginDivElementId" className="login__form" />
					{failed && (
						<p role="alert" className="login__error">
							The sign-in form could not load. Open the app through Catalyst (the deployed address or{' '}
							<code>catalyst serve</code>), not plain <code>vite</code>.
						</p>
					)}
				</div>
			</main>
		</div>
	);
}

export function signOut() {
	window.catalyst?.auth.signOut(window.location.pathname);
}
