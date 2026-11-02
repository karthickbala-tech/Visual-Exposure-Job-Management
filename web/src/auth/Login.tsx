import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Clock, Eye, EyeOff, Hammer, Moon, ShieldCheck, Sun } from 'lucide-react';
import logo from '../assets/visual_exposure_logo.avif';
import { useTheme } from '../components/theme';
import { openForgotPassword, submitCredentials } from './catalystFrame';
import './Login.css';

const SDK_SRC = 'https://static.zohocdn.com/catalyst/sdk/js/4.6.2/catalystWebSDK.js';
const INIT_SRC = '/__catalyst/sdk/init.js';
const FORM_ID = 'loginDivElementId';
const EMAIL_KEY = 've-login-email';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

const read = (k: string) => {
	try {
		return localStorage.getItem(k) ?? '';
	} catch {
		return '';
	}
};
const write = (k: string, v: string | null) => {
	try {
		if (v === null) localStorage.removeItem(k);
		else localStorage.setItem(k, v);
	} catch {
		/* storage blocked: the field simply starts empty next time */
	}
};

/** The stylesheet Catalyst loads inside its form, one per theme (built by login-frame/build.mjs). */
const frameCss = (theme: string, page: 'login-frame' | 'login-frame-reset' = 'login-frame') => new URL(`css/${page}-${theme}.css`, window.location.href).pathname;

/**
 * Sign-in page: a branded split screen with one ordinary form (email and password together).
 * The sign-in itself is Catalyst's real authentication. Behind this form sits Catalyst's own two-step form
 * in a hidden frame, which we fill in and submit for the person (see catalystFrame.ts). If Catalyst asks
 * for something we do not drive (a one-time code, a captcha) or the person taps "Forgot password?",
 * Catalyst's own form is shown instead, so sign-in can never get stuck.
 * The SDK and /__catalyst/sdk/init.js only exist when the page is served by Catalyst (deployed, or
 * `catalyst serve`), so plain `vite` shows the failure message.
 */
export function Login() {
	const { theme, toggleTheme } = useTheme();
	const [email, setEmail] = useState(() => read(EMAIL_KEY));
	const [password, setPassword] = useState('');
	const [remember, setRemember] = useState(() => read(EMAIL_KEY) !== '');
	const [showPw, setShowPw] = useState(false);
	const [busy, setBusy] = useState(false);
	const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
	const [manual, setManual] = useState(false);
	const [failed, setFailed] = useState(false);
	const ready = useRef<Promise<void> | null>(null);

	/** Draw Catalyst's form (with the stylesheet for the current theme) in the hidden frame. */
	const draw = useCallback(() => {
		ready.current ??= loadScript(SDK_SRC).then(() => loadScript(INIT_SRC));
		return ready.current
			.then(() => {
				const box = document.getElementById(FORM_ID);
				if (box) box.innerHTML = '';
				window.catalyst?.auth.signIn(FORM_ID, {
					service_url: window.location.pathname,
					css_url: frameCss(theme),
					is_customize_forgot_password: true,
					forgot_password_id: FORM_ID,
					forgot_password_css_url: frameCss(theme, 'login-frame-reset'),
				});
			})
			.catch(() => setFailed(true));
	}, [theme]);

	useEffect(() => {
		void draw();
	}, [draw]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		const next: typeof errors = {};
		if (!email.trim()) next.email = 'Enter your email address.';
		else if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
		if (!password) next.password = 'Enter your password.';
		setErrors(next);
		if (next.email || next.password) return;

		setBusy(true);
		const result = await submitCredentials(FORM_ID, email.trim(), password);
		write(EMAIL_KEY, remember ? email.trim() : null);

		if (result.kind === 'error') {
			setErrors({ [result.field]: result.message });
			if (result.field === 'password') setPassword('');
			setBusy(false);
		} else if (result.kind === 'manual') {
			setManual(true);
			setBusy(false);
		} else {
			// Credentials accepted: Catalyst redirects the page. If nothing happens, offer its own form.
			setTimeout(() => {
				setBusy(false);
				setErrors({ form: 'Still signing in? If nothing happens, use the form below.' });
				setManual(true);
			}, 15000);
		}
	};

	const forgot = () => {
		openForgotPassword(FORM_ID);
		setManual(true);
	};

	const backToForm = () => {
		setManual(false);
		setErrors({});
		void draw();
	};

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
				<button type="button" className="icon-btn login__theme" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
					{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
				</button>
				<div className="login__card">
					<p className="login__eyebrow">Welcome back</p>
					<h1 className="login__title">Sign in</h1>
					<p className="login__sub">Use your Visual Exposure account to open the project dashboard.</p>

					{!manual && (
						<form className="login__formbox" onSubmit={submit} noValidate>
							<div className="login__field">
								<label htmlFor="login-email">Email</label>
								<input
									id="login-email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									autoComplete="username"
									autoFocus
									aria-invalid={!!errors.email || undefined}
									aria-describedby={errors.email ? 'login-email-err' : undefined}
								/>
								{errors.email && (
									<p id="login-email-err" className="login__err" role="alert">
										{errors.email}
									</p>
								)}
							</div>

							<div className="login__field">
								<label htmlFor="login-password">Password</label>
								<div className="login__pw">
									<input
										id="login-password"
										type={showPw ? 'text' : 'password'}
										value={password}
										onChange={(e) => setPassword(e.target.value)}
										autoComplete="current-password"
										aria-invalid={!!errors.password || undefined}
										aria-describedby={errors.password ? 'login-password-err' : undefined}
									/>
									<button type="button" className="login__pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'}>
										{showPw ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
									</button>
								</div>
								{errors.password && (
									<p id="login-password-err" className="login__err" role="alert">
										{errors.password}
									</p>
								)}
							</div>

							<div className="login__row">
								<label className="login__check">
									<input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember my email
								</label>
								<button type="button" className="login__link" onClick={forgot}>
									Forgot password?
								</button>
							</div>

							{errors.form && <p className="login__err" role="alert">{errors.form}</p>}
							<button className="btn login__submit" disabled={busy}>
								{busy ? 'Signing in...' : 'Sign in'}
							</button>
						</form>
					)}

					{manual && (
						<button type="button" className="login__link login__back" onClick={backToForm}>
							&larr; Back to sign in
						</button>
					)}

					{/* Catalyst's own form: hidden behind ours, shown when it needs the person (code, captcha, password reset). */}
					<div id={FORM_ID} className={'login__frame' + (manual ? ' login__frame--manual' : '')} />

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
