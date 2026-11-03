/**
 * Catalyst's sign-in is a two-step form (email, then password) that lives in an iframe. To offer one
 * ordinary form (email and password together) we fill in and submit Catalyst's own form on the person's
 * behalf. The real authentication still happens in Catalyst: we only type into its fields and click its
 * buttons, exactly as the person would. The frame is served from our own address, so the page may touch it.
 *
 * This depends on Catalyst's form markup (the element ids below). If anything is not as expected, or
 * Catalyst asks for something we do not drive (a code, a captcha), we return 'manual' and the page shows
 * Catalyst's own form instead, so sign-in never gets stuck.
 */
export type FrameResult =
	| { kind: 'pending' } // credentials were sent; Catalyst is signing the person in and will redirect
	| { kind: 'error'; field: 'email' | 'password'; message: string }
	| { kind: 'manual' }; // show Catalyst's own form

const POLL_MS = 100;
const STEP_TIMEOUT_MS = 12000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function frameDocument(containerId: string): Document | null {
	try {
		return document.querySelector<HTMLIFrameElement>(`#${containerId} iframe`)?.contentDocument ?? null;
	} catch {
		return null; // a frame from another address cannot be read
	}
}

/**
 * Is this element of the Catalyst form really on screen? Elements inside the frame belong to another
 * window, so `instanceof` cannot be used; and a field inside a collapsed (zero-height, clipped) section
 * still has a size of its own, so every ancestor is checked too.
 */
const shown = (el: Element | null | undefined): el is HTMLElement => {
	const view = el?.ownerDocument.defaultView;
	if (!el || !view) return false;
	for (let node: Element | null = el; node && node.tagName !== 'HTML'; node = node.parentElement) {
		const style = view.getComputedStyle(node);
		if (style.display === 'none' || style.visibility === 'hidden') return false;
		const box = node.getBoundingClientRect();
		if (node === el ? box.width === 0 || box.height === 0 : style.overflow === 'hidden' && box.height === 0) return false;
	}
	return true;
};

/** Type into a field the way a person would, so the form's own scripts notice the change. */
function setValue(input: HTMLInputElement, value: string) {
	const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
	(setter ?? Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value')?.set)?.call(input, value);
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function waitFor<T>(check: () => T | null | undefined | false): Promise<T | null> {
	const end = Date.now() + STEP_TIMEOUT_MS;
	while (Date.now() < end) {
		const v = check();
		if (v) return v;
		await sleep(POLL_MS);
	}
	return null;
}

/** The first visible, non-empty error line inside a container of the Catalyst form. */
const errorIn = (doc: Document, containerSelector: string): string | null => {
	for (const el of doc.querySelectorAll(`${containerSelector} .fielderror, ${containerSelector} .errorlabel`)) {
		const text = el.textContent?.trim();
		if (text && shown(el)) return text;
	}
	return null;
};

/** Wipe the messages left by an earlier attempt, so a message we read afterwards belongs to this attempt. */
const clearErrors = (doc: Document) => {
	doc.querySelectorAll('.fielderror, .errorlabel').forEach((el) => {
		el.textContent = '';
	});
	doc.querySelectorAll('.errorborder').forEach((el) => el.classList.remove('errorborder'));
};

/** Does Catalyst now want something we do not handle (a code, a captcha)? */
const needsPerson = (doc: Document) => ['#captcha_container', '#otp_container', '#mfa_totp_container', '#mfa_otp_container'].some((s) => shown(doc.querySelector(s)));

export async function submitCredentials(containerId: string, email: string, password: string): Promise<FrameResult> {
	const doc = frameDocument(containerId);
	const emailBox = doc?.getElementById('login_id') as HTMLInputElement | null;
	const next = doc?.getElementById('nextbtn') as HTMLButtonElement | null;
	if (!doc || !emailBox || !next) return { kind: 'manual' };

	// If an earlier attempt left the form on the password step, go back to the email step first.
	const passwordBox = () => doc.getElementById('password') as HTMLInputElement | null;
	if (shown(passwordBox())) {
		doc.querySelector<HTMLElement>('.Notyou')?.click();
		await waitFor(() => !shown(passwordBox()));
	}

	// Step 1: the email.
	setValue(emailBox, email);
	clearErrors(doc);
	next.click();
	const step1 = await waitFor(() => {
		const message = errorIn(doc, '#login_id_container');
		if (message) return { message } as const;
		if (needsPerson(doc)) return 'manual' as const;
		if (shown(passwordBox())) return 'password' as const;
		return null;
	});
	if (step1 === null || step1 === 'manual') return { kind: 'manual' };
	if (typeof step1 === 'object') return { kind: 'error', field: 'email', message: step1.message };

	// Step 2: the password.
	const pw = passwordBox();
	if (!pw) return { kind: 'manual' };
	setValue(pw, password);
	clearErrors(doc);
	(doc.getElementById('nextbtn') as HTMLButtonElement | null)?.click();
	const step2 = await waitFor(() => {
		const message = errorIn(doc, '#password_container');
		if (message) return { message } as const;
		if (needsPerson(doc)) return 'manual' as const;
		// Success: Catalyst navigates the frame away from the sign-in form.
		if (!frameDocument(containerId)?.getElementById('login_id')) return 'done' as const;
		return null;
	});
	if (step2 === 'manual') return { kind: 'manual' };
	if (step2 !== null && typeof step2 === 'object') return { kind: 'error', field: 'password', message: step2.message };
	return { kind: 'pending' };
}

/** Open Catalyst's own "forgot password" flow (it lives in the frame). Returns false if it cannot be found. */
export function openForgotPassword(containerId: string): boolean {
	const doc = frameDocument(containerId);
	const link = doc?.querySelector<HTMLElement>('#forgotpassword a, #forgotpassword, #blueforgotpassword');
	if (!link) return false;
	link.click();
	return true;
}
