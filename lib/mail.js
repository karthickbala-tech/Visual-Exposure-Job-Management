'use strict';

/**
 * Sends email. Two ways, chosen by what is configured:
 *   1. SMTP (SMTP_USER and SMTP_PASS, for example a Gmail address with an app password). Needs no verified domain, so it suits
 *      testing and demos. Host and port default to Gmail (smtp.gmail.com, 465) and can be changed with SMTP_HOST and SMTP_PORT.
 *   2. Catalyst Mail (MAIL_FROM), which needs a sender address on a verified domain in the Catalyst console.
 * With neither, nothing is sent and callers are told why, so features never fail just because email is not set up yet.
 * APP_URL (optional) is used to build links back to the app.
 */
const fromAddress = () => process.env.SMTP_USER || process.env.MAIL_FROM || '';
const appUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '');
const DISPLAY_NAME = 'Visual Exposure';

/** A link to a page of the app, or '' when APP_URL is not configured. */
const linkTo = (path) => (appUrl() ? `${appUrl()}/app/index.html#${path}` : '');

/** The plain-text twin of an HTML email (mail programs and spam filters like having one). */
const htmlToText = (html) =>
	String(html || '')
		.replace(/<\/(p|div|h\d|li|tr)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, '\n\n')
		.trim();

let smtpTransport = null; // one connection setup per running function, reused

function smtpFor(env, factory) {
	if (smtpTransport && smtpTransport.user === env.SMTP_USER) return smtpTransport.transport;
	const make = factory || require('nodemailer').createTransport;
	const transport = make({
		host: env.SMTP_HOST || 'smtp.gmail.com',
		port: Number(env.SMTP_PORT) || 465,
		secure: (Number(env.SMTP_PORT) || 465) === 465,
		auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
		connectionTimeout: 10000,
		greetingTimeout: 10000,
		socketTimeout: 20000,
	});
	smtpTransport = { user: env.SMTP_USER, transport };
	return transport;
}

/** `options.env` and `options.smtpFactory` exist so tests can run without real settings. */
function createMailer(app, options = {}) {
	const env = options.env || process.env;
	return {
		async send({ to, subject, html }) {
			const useSmtp = !!(env.SMTP_USER && env.SMTP_PASS);
			const from = useSmtp ? env.SMTP_USER : env.MAIL_FROM;
			if (!from) return { sent: false, reason: 'no_sender' };
			if (!to || to.length === 0) return { sent: false, reason: 'no_recipients' };
			if (useSmtp) {
				await smtpFor(env, options.smtpFactory).sendMail({ from: `"${DISPLAY_NAME}" <${from}>`, to: to.join(', '), subject, html, text: htmlToText(html) });
				return { sent: true, count: to.length };
			}
			await app.email().sendMail({ from_email: from, to_email: to, subject, content: html });
			return { sent: true, count: to.length };
		},
	};
}

module.exports = { createMailer, linkTo, fromAddress, htmlToText };
