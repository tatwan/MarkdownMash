const assert = require('node:assert/strict');
const {
  SAVED_MASH_KINDS,
  MAX_SAVED_MASHES_PER_OWNER,
  MAX_NAME_LENGTH,
  normalizeKind,
  validateSavedMashInput,
  canCreateAnother,
  summarizeSavedMash
} = require('./saved-mash');

// Parsers are injected so this file never loads quiz-structure or
// survey-structure; the stubs return whatever question count a case needs.
const parsers = {
  parseQuiz: markdown => ({ questions: markdown.includes('##') ? [{}, {}] : [] }),
  parseSurvey: markdown => ({ questions: markdown.includes('##') ? [{}] : [] })
};

// --- kinds ---
assert.deepEqual([...SAVED_MASH_KINDS], ['quiz', 'survey']);
assert.equal(normalizeKind('quiz'), 'quiz');
assert.equal(normalizeKind(' Survey '), 'survey');
assert.equal(normalizeKind('poll'), null, 'unknown kinds are null, never a silent default');
assert.equal(normalizeKind(undefined), null);
assert.equal(normalizeKind(42), null);

// --- validateSavedMashInput: happy paths ---
const quiz = validateSavedMashInput(
  { name: '  Week 3 warm-up  ', kind: 'quiz', markdown: '# T\n## Q1: a?\n- [x] y' },
  parsers
);
assert.equal(quiz.ok, true);
assert.deepEqual(quiz.value, {
  name: 'Week 3 warm-up',
  kind: 'quiz',
  markdown: '# T\n## Q1: a?\n- [x] y',
  questionCount: 2
});

const survey = validateSavedMashInput(
  { name: 'Pulse', kind: 'survey', markdown: '## Q1: mood?\n- ok' },
  parsers
);
assert.equal(survey.ok, true);
assert.equal(survey.value.questionCount, 1, 'survey count comes from the survey parser');

// --- validateSavedMashInput: rejections ---
function rejects(input, pattern, label) {
  const result = validateSavedMashInput(input, parsers);
  assert.equal(result.ok, false, `${label} must be rejected`);
  assert.equal(result.status, 400, `${label} is a 400`);
  assert.match(result.error, pattern, `${label} message`);
}

rejects({ name: 'x', kind: 'poll', markdown: '## Q' }, /quiz or survey/i, 'unknown kind');
rejects({ name: '', kind: 'quiz', markdown: '## Q' }, /name/i, 'empty name');
rejects({ name: '   ', kind: 'quiz', markdown: '## Q' }, /name/i, 'whitespace name');
rejects({ name: 'a'.repeat(MAX_NAME_LENGTH + 1), kind: 'quiz', markdown: '## Q' }, /80/, 'name too long');
rejects({ name: 'ok', kind: 'quiz', markdown: '' }, /markdown/i, 'empty markdown');
rejects({ name: 'ok', kind: 'quiz', markdown: '   \n ' }, /markdown/i, 'blank markdown');
rejects({ name: 'ok', kind: 'quiz', markdown: '# Title only' }, /Quiz needs at least one question/, 'zero quiz questions');
rejects({ name: 'ok', kind: 'survey', markdown: '# Title only' }, /Survey needs at least one question with options/, 'zero survey questions');

assert.equal(
  validateSavedMashInput({ name: 'a'.repeat(MAX_NAME_LENGTH), kind: 'quiz', markdown: '## Q' }, parsers).ok,
  true,
  'a name of exactly the maximum length is accepted'
);

assert.throws(
  () => validateSavedMashInput({ name: 'ok', kind: 'quiz', markdown: '## Q' }, {}),
  /No parser/,
  'a missing parser is a programming error, not a user error'
);

// --- cap ---
assert.equal(MAX_SAVED_MASHES_PER_OWNER, 200);
assert.equal(canCreateAnother(0), true);
assert.equal(canCreateAnother(199), true);
assert.equal(canCreateAnother(200), false);
assert.equal(canCreateAnother(-1), false);
assert.equal(canCreateAnother('3'), false, 'only integers count');

// --- summary shape ---
const summary = summarizeSavedMash({
  id: '12',                      // pg returns bigint as a string
  owner_id: 7,
  name: 'Pulse',
  kind: 'survey',
  markdown: '## secret',
  question_count: '3',
  created_at: '2026-09-21T10:00:00.000Z',
  updated_at: '2026-09-21T11:00:00.000Z'
});
assert.deepEqual(summary, {
  id: 12,
  name: 'Pulse',
  kind: 'survey',
  questionCount: 3,
  createdAt: '2026-09-21T10:00:00.000Z',
  updatedAt: '2026-09-21T11:00:00.000Z'
});
assert.equal('markdown' in summary, false, 'list rows never carry the Markdown body');
assert.equal('owner_id' in summary, false);

console.log('saved-mash tests passed');
