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

/**
 * Catalyst embedded login. The SDK and /__catalyst/sdk/init.js only exist when the page is
 * served by Catalyst (deployed, or `catalyst serve`), so plain `vite` shows the failure message.
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
			<header className="login__band">
				<span className="login__logo" aria-hidden="true" />
				<span className="login__name">Visual<br />Exposure</span>
			</header>
			<main className="login__card">
				<h1 className="page-title">Sign in</h1>
				<div id="loginDivElementId" className="login__form" />
				{failed && (
					<p role="alert" className="login__error">
						The sign-in form could not load. Open the app through Catalyst (the deployed address or{' '}
						<code>catalyst serve</code>), not plain <code>vite</code>.
					</p>
				)}
			</main>
		</div>
	);
}

export function signOut() {
	window.catalyst?.auth.signOut(window.location.pathname);
}
