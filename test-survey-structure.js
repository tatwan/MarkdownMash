const assert = require('node:assert/strict');
const {
  parseSurveyMarkdown,
  normalizeStoredSurvey,
  questionCount,
  isSurveyPayload,
  stepAt,
  questionForStep
} = require('./survey-structure');

const basic = parseSurveyMarkdown([
  '# Pulse check',
  '',
  '## How was the pace?',
  '- Just right',
  '- A bit fast',
  '- A bit slow',
  '::time=15',
  '',
  '## Favorite snack?',
  '- [ ] Fruit',
  '- [x] Chips',
  '- [ ] Candy'
].join('\n'));

assert.equal(basic.title, 'Pulse check');
assert.equal(basic.sessionKind, 'survey');
assert.equal(basic.totalScore, 0);
assert.equal(basic.questions.length, 2);
assert.equal(basic.questions[0].timeLimit, 15);
assert.deepEqual(basic.questions[0].options, ['Just right', 'A bit fast', 'A bit slow']);
assert.deepEqual(basic.questions[0].correctIndices, []);
assert.equal(basic.questions[0].type, 'survey');
assert.equal(basic.questions[0].displayNumber, 1);
assert.equal(basic.questions[1].displayNumber, 2);
// Checkbox form is accepted; [x] does not mark correctness.
assert.deepEqual(basic.questions[1].options, ['Fruit', 'Chips', 'Candy']);
assert.deepEqual(basic.questions[1].correctIndices, []);
assert.equal(questionCount(basic), 2);

const withScore = parseSurveyMarkdown([
  '# With score noise',
  '# Score 100',
  '## Q1: Still a survey?',
  '- Yes',
  '- No',
  '::type=graded'
].join('\n'));
assert.equal(withScore.totalScore, 0, '# Score is ignored');
assert.equal(withScore.questions[0].type, 'survey', '::type is ignored');
assert.deepEqual(withScore.questions[0].correctIndices, []);

const sectioned = parseSurveyMarkdown([
  '# Classroom pulse',
  '# Section: Warm-up',
  '> Getting started',
  '## Energy today?',
  '- High',
  '- Medium',
  '- Low',
  '# Section: Topics',
  '## Revisit?',
  '- Recursion',
  '- Testing'
].join('\n'));

assert.equal(sectioned.steps[0].kind, 'section');
assert.equal(sectioned.steps[0].title, 'Warm-up');
assert.equal(sectioned.steps[0].subtitle, 'Getting started');
assert.equal(sectioned.steps[1].kind, 'question');
assert.equal(sectioned.questions[0].sectionTitle, 'Warm-up');
assert.equal(stepAt(sectioned, 0).kind, 'section');
assert.equal(questionForStep(sectioned, 1).text, 'Energy today?');

const stored = normalizeStoredSurvey({
  title: 'Old',
  questions: [
    { text: 'A?', options: ['1', '2'], correctIndices: [0], type: 'graded' }
  ]
});
assert.equal(stored.sessionKind, 'survey');
assert.equal(stored.questions[0].type, 'survey');
assert.deepEqual(stored.questions[0].correctIndices, []);
assert.equal(stored.questions[0].displayNumber, 1);
assert.ok(isSurveyPayload(stored));
assert.equal(isSurveyPayload({ questions: [{ type: 'graded' }] }), false);

console.log('All survey structure tests passed.');
