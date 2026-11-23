'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, htmlToText } = require('../lib/mail');

const catalystApp = (sent) => ({ email: () => ({ sendMail: async (m) => sent.push(m) }) });

test('with no sender configured nothing is sent and the reason is given', async () => {
	const out = await createMailer(catalystApp([]), { env: {} }).send({ to: ['a@x.test'], subject: 's', html: '<p>h</p>' });
	assert.deepEqual(out, { sent: false, reason: 'no_sender' });
});

test('Catalyst Mail is used with MAIL_FROM as the sender; no recipients is not an error', async () => {
	const sent = [];
	const mailer = createMailer(catalystApp(sent), { env: { MAIL_FROM: 'noreply@example.test' } });
	assert.deepEqual(await mailer.send({ to: [], subject: 's', html: 'h' }), { sent: false, reason: 'no_recipients' });
	assert.deepEqual(await mailer.send({ to: ['a@x.test'], subject: 'Hi', html: '<p>h</p>' }), { sent: true, count: 1 });
	assert.equal(sent[0].from_email, 'noreply@example.test');
});

test('SMTP settings are ignored: mail always goes through Catalyst Mail from MAIL_FROM', async () => {
	const sent = [];
	const mailer = createMailer(catalystApp(sent), {
		env: { SMTP_USER: 'me@gmail.test', SMTP_PASS: 'app-pass', MAIL_FROM: 'noreply@example.test' },
	});
	assert.deepEqual(await mailer.send({ to: ['a@x.test'], subject: 's', html: 'h' }), { sent: true, count: 1 });
	assert.equal(sent[0].from_email, 'noreply@example.test');
});

test('SMTP settings alone send nothing, because there is no Catalyst Mail sender', async () => {
	const sent = [];
	const out = await createMailer(catalystApp(sent), { env: { SMTP_USER: 'me@gmail.test', SMTP_PASS: 'app-pass' } })
		.send({ to: ['a@x.test'], subject: 's', html: 'h' });
	assert.deepEqual(out, { sent: false, reason: 'no_sender' });
	assert.equal(sent.length, 0);
});

test('html to text keeps paragraphs and decodes the usual entities', () => {
	assert.equal(htmlToText('<p>A &lt;b&gt;</p><p>&quot;q&quot; &#39;s&#39;</p>'), 'A <b>\n"q" \'s\'');
});
