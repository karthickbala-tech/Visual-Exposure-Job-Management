'use strict';

/**
 * Sends email through Catalyst Mail. A sender address must be configured and verified in the
 * Catalyst console first, then set as MAIL_FROM. Until then nothing is sent and callers are told why,
 * so features never fail just because email is not set up yet.
 * APP_URL (optional) is used to build links back to the app.
 */
const fromAddress = () => process.env.MAIL_FROM || '';
const appUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '');

/** A link to a page of the app, or '' when APP_URL is not configured. */
const linkTo = (path) => (appUrl() ? `${appUrl()}/app/index.html#${path}` : '');

function createMailer(app) {
	return {
		async send({ to, subject, html }) {
			const from = fromAddress();
			if (!from) return { sent: false, reason: 'no_sender' };
			if (!to || to.length === 0) return { sent: false, reason: 'no_recipients' };
			await app.email().sendMail({ from_email: from, to_email: to, subject, content: html });
			return { sent: true, count: to.length };
		},
	};
}

module.exports = { createMailer, linkTo, fromAddress };
