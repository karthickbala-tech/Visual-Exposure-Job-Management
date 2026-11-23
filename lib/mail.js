'use strict';

/**
 * Sends email through Catalyst Mail. The sender is MAIL_FROM: an address on a domain verified in the Catalyst console.
 * With no MAIL_FROM nothing is sent and callers are told why, so features never fail just because email is not set up yet.
 * APP_URL (optional) is used to build links back to the app.
 * (SMTP was tried for demos and is not used: all mail goes out from the company's verified Catalyst Mail sender.)
 */
const fromAddress = () => process.env.MAIL_FROM || '';
const appUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '');

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

/** `options.env` exists so tests can run without real settings. */
function createMailer(app, options = {}) {
	const env = options.env || process.env;
	return {
		async send({ to, subject, html }) {
			const from = env.MAIL_FROM || '';
			if (!from) return { sent: false, reason: 'no_sender' };
			if (!to || to.length === 0) return { sent: false, reason: 'no_recipients' };
			await app.email().sendMail({ from_email: from, to_email: to, subject, content: html });
			return { sent: true, count: to.length };
		},
	};
}

module.exports = { createMailer, linkTo, fromAddress, htmlToText };
