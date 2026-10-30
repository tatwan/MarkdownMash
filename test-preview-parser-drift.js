// Server and preview share a parser. Keep the public entry points aligned.
const assert = require('node:assert/strict');
const { parseQuizMarkdown } = require('./quiz-structure');
const { parseQuizMarkdownLocal } = require('./public/js/quiz-preview-parser');

function assertParsersAgree(markdown, label) {
  assert.deepStrictEqual(parseQuizMarkdownLocal(markdown), parseQuizMarkdown(markdown), label);
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
