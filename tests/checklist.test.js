'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../lib/domain/checklistProgress');

const def = {
	sections: [
		{
			key: 'arrival',
			title: 'Arrival',
			questions: [
				{ key: 'site_safe', label: 'Site safe?', type: 'yesno', required: true, raiseIssueOn: 'no' },
				{ key: 'hazard_note', label: 'Describe the hazard', type: 'text', required: true, showIf: { key: 'site_safe', equals: 'no' } },
				{ key: 'weather', label: 'Weather', type: 'choice', options: ['Fine', 'Rain'], required: false },
			],
		},
		{ key: 'closure', title: 'Closure', questions: [{ key: 'photo_done', label: 'Finished photo', type: 'photo', required: true }] },
	],
};

test('hidden questions do not count and never block completion', () => {
	const p = c.progressOf(def, { site_safe: 'yes', photo_done: '123456789012' });
	assert.equal(p.total, 3);
	assert.deepEqual(p.missing, []);
	assert.equal(p.canComplete, true);
});

test('answering "no" reveals the follow-up and flags an issue', () => {
	const p = c.progressOf(def, { site_safe: 'no', photo_done: '123456789012' });
	assert.equal(p.total, 4);
	assert.deepEqual(p.missing, ['hazard_note']);
	assert.deepEqual(p.issues, ['site_safe']);
	assert.equal(p.canComplete, false);
});

test('progress percent counts answered active questions', () => {
	assert.equal(c.progressOf(def, {}).percent, 0);
	assert.equal(c.progressOf(def, { site_safe: 'yes' }).percent, 33);
	assert.equal(c.progressOf({ sections: [] }, {}).percent, 100);
});

test('blank strings count as unanswered', () => {
	assert.deepEqual(c.progressOf(def, { site_safe: '   ' }).missing, ['site_safe', 'photo_done']);
});

test('next question follows template order and skips hidden ones', () => {
	assert.equal(c.nextQuestion(def, {}).key, 'site_safe');
	assert.equal(c.nextQuestion(def, { site_safe: 'yes' }).key, 'weather');
	assert.equal(c.nextQuestion(def, { site_safe: 'no' }).key, 'hazard_note');
	assert.equal(c.nextQuestion(def, { site_safe: 'yes', weather: 'Fine', photo_done: '123456789012' }), null);
});

test('answers are checked by type', () => {
	const q = (type, extra) => ({ key: 'k', type, ...extra });
	assert.equal(c.checkAnswer(q('yesno'), 'yes'), null);
	assert.ok(c.checkAnswer(q('yesno'), 'maybe'));
	assert.equal(c.checkAnswer(q('number'), 4.5), null);
	assert.ok(c.checkAnswer(q('number'), '4.5'));
	assert.ok(c.checkAnswer(q('choice', { options: ['A'] }), 'B'));
	assert.ok(c.checkAnswer(q('text'), 'x'.repeat(2001)));
	assert.ok(c.checkAnswer(q('photo'), 'abc'));
	assert.equal(c.checkAnswer(q('number'), ''), null, 'blank is not a type error');
});

test('template validation catches duplicates, bad types, empty choices and dangling showIf', () => {
	assert.deepEqual(c.validateDefinition(def), []);
	assert.ok(c.validateDefinition({ sections: [] }).length);
	const bad = {
		sections: [
			{ key: 's', questions: [
				{ key: 'a', type: 'yesno' },
				{ key: 'a', type: 'weird' },
				{ key: 'b', type: 'choice' },
				{ key: 'c', type: 'text', showIf: { key: 'zzz', equals: 'x' } },
			] },
		],
	};
	const problems = c.validateDefinition(bad).join('|');
	assert.match(problems, /Duplicate question key: a/);
	assert.match(problems, /unknown type weird/);
	assert.match(problems, /choice needs options/);
	assert.match(problems, /unknown zzz/);
});
