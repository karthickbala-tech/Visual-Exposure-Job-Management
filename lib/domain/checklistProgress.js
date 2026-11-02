'use strict';

/**
 * Checklist template shape (stored as JSON in checklist_template.definition):
 * {
 *   sections: [{
 *     key: 'arrival', title: 'Arrival',
 *     questions: [{
 *       key: 'site_safe', label: '...', type: 'yesno' | 'text' | 'number' | 'choice' | 'photo',
 *       required: true,
 *       options: ['A', 'B'],                    // choice only
 *       showIf: { key: 'other_q', equals: 'no' } // optional: only asked when another answer matches
 *       raiseIssueOn: 'no'                       // optional: this answer should raise an issue
 *     }]
 *   }]
 * }
 * Answers are a flat object { questionKey: value }. Pure functions, no I/O.
 */

const TYPES = ['yesno', 'text', 'number', 'choice', 'photo'];

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Questions that apply given the current answers (showIf resolved), in template order. */
function activeQuestions(definition, answers = {}) {
	const out = [];
	for (const section of definition?.sections ?? []) {
		for (const q of section.questions ?? []) {
			if (q.showIf && answers[q.showIf.key] !== q.showIf.equals) continue;
			out.push({ ...q, section: section.key });
		}
	}
	return out;
}

/** Is this one answer acceptable for the question? Returns an error message or null. */
function checkAnswer(question, value) {
	if (isBlank(value)) return null; // blank is handled by "required" at completion time
	switch (question.type) {
		case 'yesno':
			return value === 'yes' || value === 'no' ? null : 'Answer yes or no';
		case 'number':
			return typeof value === 'number' && Number.isFinite(value) ? null : 'Enter a number';
		case 'choice':
			return (question.options ?? []).includes(value) ? null : 'Pick one of the listed options';
		case 'text':
			return typeof value === 'string' && value.length <= 2000 ? null : 'Text is too long (2000 characters max)';
		case 'photo':
			return typeof value === 'string' && /^\d{6,}$/.test(value) ? null : 'Attach a photo';
		default:
			return 'Unknown question type';
	}
}

/** Validate a template before it is saved. Returns a list of problems (empty = fine). */
function validateDefinition(definition) {
	const problems = [];
	const seen = new Set();
	if (!Array.isArray(definition?.sections) || definition.sections.length === 0) {
		return ['A template needs at least one section'];
	}
	for (const section of definition.sections) {
		for (const q of section.questions ?? []) {
			if (!q.key) problems.push('A question has no key');
			else if (seen.has(q.key)) problems.push(`Duplicate question key: ${q.key}`);
			seen.add(q.key);
			if (!TYPES.includes(q.type)) problems.push(`Question ${q.key}: unknown type ${q.type}`);
			if (q.type === 'choice' && !(q.options ?? []).length) problems.push(`Question ${q.key}: choice needs options`);
		}
	}
	for (const section of definition.sections) {
		for (const q of section.questions ?? []) {
			if (q.showIf && !seen.has(q.showIf.key)) problems.push(`Question ${q.key}: showIf points at unknown ${q.showIf.key}`);
		}
	}
	return problems;
}

/**
 * Where a checklist stands.
 * - answered/total count only active questions, so hidden ones never block completion.
 * - missing lists active required questions still blank, in order.
 * - issues lists answers that should raise an issue.
 */
function progressOf(definition, answers = {}) {
	const active = activeQuestions(definition, answers);
	const missing = active.filter((q) => q.required && isBlank(answers[q.key])).map((q) => q.key);
	const answered = active.filter((q) => !isBlank(answers[q.key])).length;
	const issues = active.filter((q) => q.raiseIssueOn !== undefined && answers[q.key] === q.raiseIssueOn).map((q) => q.key);
	return {
		total: active.length,
		answered,
		percent: active.length === 0 ? 100 : Math.round((answered / active.length) * 100),
		missing,
		issues,
		canComplete: missing.length === 0,
	};
}

/** The first active question still unanswered, or null when nothing is left (drives the "next" endpoint). */
function nextQuestion(definition, answers = {}) {
	return activeQuestions(definition, answers).find((q) => isBlank(answers[q.key])) ?? null;
}

module.exports = { TYPES, activeQuestions, checkAnswer, validateDefinition, progressOf, nextQuestion };
