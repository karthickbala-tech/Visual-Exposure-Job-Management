'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMailer, htmlToText } = require('../lib/mail');

const catalystApp = (sent) => ({ email: () => ({ sendMail: async (m) => sent.push(m) }) });

test('with no sender configured nothing is sent and the reason is given', async () => {
	const out = await createMailer(catalystApp([]), { env: {} }).send({ to: ['a@x.test'], subject: 's', html: '<p>h</p>' });
	assert.deepEqual(out, { sent: false, reason: 'no_sender' });
});

test('Catalyst Mail is used when only MAIL_FROM is set; no recipients is not an error', async () => {
	const sent = [];
	const mailer = createMailer(catalystApp(sent), { env: { MAIL_FROM: 'noreply@example.test' } });
	assert.deepEqual(await mailer.send({ to: [], subject: 's', html: 'h' }), { sent: false, reason: 'no_recipients' });
	assert.deepEqual(await mailer.send({ to: ['a@x.test'], subject: 'Hi', html: '<p>h</p>' }), { sent: true, count: 1 });
	assert.equal(sent[0].from_email, 'noreply@example.test');
});

test('SMTP is used when SMTP_USER and SMTP_PASS are set, with a text twin, and Catalyst Mail is left alone', async () => {
	const smtp = [];
	const config = [];
	const catalyst = [];
	const mailer = createMailer(catalystApp(catalyst), {
		env: { SMTP_USER: 'me@gmail.test', SMTP_PASS: 'app-pass', MAIL_FROM: 'ignored@example.test' },
		smtpFactory: (c) => (config.push(c), { sendMail: async (m) => smtp.push(m) }),
	});
	const out = await mailer.send({ to: ['a@x.test', 'b@x.test'], subject: 'Weekly', html: '<h2>Title</h2><p>One &amp; two</p>' });
	assert.deepEqual(out, { sent: true, count: 2 });
	assert.equal(catalyst.length, 0);
	assert.equal(smtp[0].from, '"Visual Exposure" <me@gmail.test>');
	assert.equal(smtp[0].to, 'a@x.test, b@x.test');
	assert.equal(smtp[0].text, 'Title\nOne & two');
	assert.deepEqual([config[0].host, config[0].port, config[0].secure], ['smtp.gmail.com', 465, true]);
	assert.equal(config[0].auth.pass, 'app-pass');
});

test('a failing SMTP send raises, so the notification log records "failed" with the reason', async () => {
	const mailer = createMailer(catalystApp([]), {
		env: { SMTP_USER: 'other@gmail.test', SMTP_PASS: 'x' },
		smtpFactory: () => ({ sendMail: async () => { throw new Error('Invalid login'); } }),
	});
	await assert.rejects(mailer.send({ to: ['a@x.test'], subject: 's', html: 'h' }), /Invalid login/);
});

test('html to text keeps paragraphs and decodes the usual entities', () => {
	assert.equal(htmlToText('<p>A &lt;b&gt;</p><p>&quot;q&quot; &#39;s&#39;</p>'), 'A <b>\n"q" \'s\'');
});
