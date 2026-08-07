// Two markdown parsers exist for the same quiz format: quiz-structure.js's
// parseQuizMarkdown (server, authoritative — scores and runs the quiz) and
// public/js/quiz-preview-parser.js's parseQuizMarkdownLocal (admin studio's
// inline preview / mobile simulator, client-side, no server round trip).
//
// This test is what stops them diverging. It runs the same markdown through
// both and asserts they agree on every field they share. If it fails, a host
// previewing a quiz would see something different from what the class
// actually gets — that is the failure mode this guards against.
//
// The intended long-term fix is a single shared parsing module; keeping two
// copies in sync by hand (with this test as the tripwire) is a deliberate,
// accepted-for-now shortcut for this release, not an oversight.
//
// Fields intentionally NOT compared: quiz.totalScore and quiz.passingPercent
// exist only on the server's quiz object — the preview never scores
// anything, so parseQuizMarkdownLocal doesn't produce them. That is
// intentional, not a gap to "fix" here.

const assert = require('node:assert/strict');
const { parseQuizMarkdown } = require('./quiz-structure');
const { parseQuizMarkdownLocal } = require('./public/js/quiz-preview-parser');

const QUESTION_FIELDS = ['text', 'options', 'correctIndices', 'timeLimit', 'type', 'gradedNumber', 'sectionTitle'];

function assertParsersAgree(markdown, label) {
  const server = parseQuizMarkdown(markdown);
  const preview = parseQuizMarkdownLocal(markdown);

  assert.deepStrictEqual(preview.steps, server.steps, `${label}: steps disagree`);
  assert.equal(preview.questions.length, server.questions.length, `${label}: question count disagrees`);

  server.questions.forEach((serverQuestion, i) => {
    const previewQuestion = preview.questions[i];
    for (const field of QUESTION_FIELDS) {
      assert.deepStrictEqual(
        previewQuestion[field],
        serverQuestion[field],
        `${label}: question ${i} field "${field}" disagrees (server=${JSON.stringify(serverQuestion[field])}, preview=${JSON.stringify(previewQuestion[field])})`
      );
    }
  });
}

// --- a plain legacy quiz (no sections, one question without ::time=,
//     exercising the DEFAULT_TIME_LIMIT fallback in both parsers) ---

assertParsersAgree([
  '# Intro Quiz',
  '# Score 100',
  '',
  '## Q1: What is 2 + 2?',
  '- [ ] 3',
  '- [x] 4',
  '- [ ] 5',
  '::time=15',
  '',
  '## Q2: What is the capital of Japan?',
  '- [ ] Seoul',
  '- [x] Tokyo',
  '- [ ] Beijing'
].join('\n'), 'plain legacy quiz');

// --- two sections, one with a subtitle, one without ---

assertParsersAgree([
  '# Two Section Quiz',
  '# Score 100',
  '',
  '# Section: Warm Up',
  '> Let\'s get started.',
  '',
  '## Q1: 1 + 1?',
  '- [ ] 1',
  '- [x] 2',
  '- [ ] 3',
  '::time=10',
  '',
  '# Section: Main Event',
  '',
  '## Q2: 3 + 3?',
  '- [ ] 5',
  '- [x] 6',
  '- [ ] 7',
  '::time=10'
].join('\n'), 'two sections, one with a subtitle');

// --- section-level ::type=ungraded inherited by both of its questions ---

assertParsersAgree([
  '# Section Type Quiz',
  '# Score 50',
  '',
  '# Section: Bonus',
  '::type=ungraded',
  '',
  '## Q1: Just for fun?',
  '- [x] Yes',
  '- [ ] No',
  '::time=10',
  '',
  '## Q2: Another fun one?',
  '- [x] Sure',
  '- [ ] Nope',
  '::time=10'
].join('\n'), 'section-level ::type=ungraded inherited');

// --- question-level ::type= overriding a section default ---

assertParsersAgree([
  '# Override Quiz',
  '# Score 100',
  '',
  '# Section: Mixed',
  '::type=ungraded',
  '',
  '## Q1: Ungraded by default?',
  '- [x] Yes',
  '- [ ] No',
  '::time=10',
  '',
  '## Q2: But this one counts',
  '- [x] Correct',
  '- [ ] Wrong',
  '::time=10',
  '::type=graded'
].join('\n'), 'question-level ::type= overrides section default');

// --- unrecognised ::type= falls back to graded ---

assertParsersAgree([
  '# Unknown Type Quiz',
  '# Score 100',
  '',
  '## Q1: What happens with a bogus type?',
  '::type=banana',
  '- [x] Falls back to graded',
  '- [ ] Does not',
  '::time=10'
].join('\n'), 'unrecognised ::type= falls back to graded');

// --- a trailing section with no question after it never becomes a step ---

assertParsersAgree([
  '# Trailing Section Quiz',
  '# Score 100',
  '',
  '## Q1: Only real question?',
  '- [x] Yes',
  '- [ ] No',
  '::time=10',
  '',
  '# Section: Never Reached',
  '> This section has no questions following it.'
].join('\n'), 'trailing section with no questions after it');

// --- a question containing a fenced code block with four-space indentation ---

assertParsersAgree([
  '# Code Quiz',
  '# Score 100',
  '',
  '## Q1: What does this code print?',
  '',
  '    def greet():',
  '        print("hello")',
  '',
  '    greet()',
  '- [ ] goodbye',
  '- [x] hello',
  '- [ ] error',
  '::time=30'
].join('\n'), 'question with a four-space-indented code block');

console.log('All preview-parser drift tests passed.');
