const assert = require('node:assert/strict');
const {
  parseQuizMarkdown,
  normalizeStoredQuiz,
  gradedCount,
  pointsPerQuestion,
  isScored,
  stepAt,
  questionForStep
} = require('./quiz-structure');

// --- legacy quizzes must be untouched ---

const legacy = parseQuizMarkdown([
  '# Intro to Python',
  '# Score 100',
  '',
  '## Q1: First?',
  '- [ ] no',
  '- [x] yes',
  '::time=15',
  '',
  '## Q2: Second?',
  '- [x] a',
  '- [ ] b'
].join('\n'));

assert.equal(legacy.title, 'Intro to Python', 'title parsed');
assert.equal(legacy.totalScore, 100, 'score parsed');
assert.equal(legacy.questions.length, 2, 'two questions');
assert.equal(legacy.steps.length, 2, 'a legacy quiz has one step per question');
assert.deepEqual(
  legacy.steps.map(s => s.kind),
  ['question', 'question'],
  'no section steps appear in a legacy quiz'
);
assert.equal(legacy.questions[0].timeLimit, 15, 'time limit parsed');
assert.equal(legacy.questions[1].timeLimit, 20, 'default time limit applied');
assert.deepEqual(legacy.questions[0].correctIndices, [1], 'correct index parsed');
assert.equal(legacy.questions[0].type, 'graded', 'default type is graded');
assert.equal(legacy.questions[0].gradedNumber, 1, 'graded numbering starts at 1');
assert.equal(legacy.questions[1].gradedNumber, 2, 'graded numbering increments');
assert.equal(legacy.questions[0].index, 0, 'question index is dense and 0-based');
assert.equal(legacy.questions[1].index, 1, 'question index is dense and 0-based');
assert.equal(legacy.questions[0].sectionTitle, null, 'no section title without a section');

// --- sections ---

const sectioned = parseQuizMarkdown([
  '# Course',
  '# Score 100',
  '',
  '# Section: Module 1 — Basics',
  '> Warm-up before we dig in.',
  '',
  '## Q1: First?',
  '- [x] yes',
  '',
  '# Section: Module 2 — Recursion',
  '',
  '## Q2: Second?',
  '- [x] yes'
].join('\n'));

assert.equal(sectioned.title, 'Course', 'a section heading does not clobber the quiz title');
assert.equal(sectioned.steps.length, 4, 'two sections plus two questions');
assert.deepEqual(
  sectioned.steps.map(s => s.kind),
  ['section', 'question', 'section', 'question'],
  'sections are interleaved in flow order'
);
assert.equal(sectioned.steps[0].title, 'Module 1 — Basics', 'section title parsed');
assert.equal(sectioned.steps[0].subtitle, 'Warm-up before we dig in.', 'section subtitle parsed');
assert.equal(sectioned.steps[2].subtitle, null, 'a section without a subtitle gets null');
assert.equal(sectioned.questions.length, 2, 'sections do not become questions');
assert.equal(sectioned.questions[0].index, 0, 'question indices ignore section steps');
assert.equal(sectioned.questions[1].index, 1, 'question indices stay dense');
assert.equal(sectioned.questions[0].sectionTitle, 'Module 1 — Basics', 'question carries its section');
assert.equal(sectioned.questions[1].sectionTitle, 'Module 2 — Recursion', 'section changes correctly');

const trailing = parseQuizMarkdown([
  '# Course',
  '## Q1: Only?',
  '- [x] yes',
  '',
  '# Section: Nothing follows this'
].join('\n'));

assert.equal(trailing.steps.length, 1, 'a section with no questions after it is dropped');
assert.deepEqual(trailing.steps.map(s => s.kind), ['question'], 'only the question step survives');

// --- question types ---

const typed = parseQuizMarkdown([
  '# Course',
  '# Score 100',
  '',
  '## Q1: Graded?',
  '- [x] yes',
  '',
  '## Q2: Fun one',
  '::type=ungraded',
  '- [x] yes',
  '',
  '## Q3: Also graded?',
  '- [x] yes'
].join('\n'));

assert.equal(typed.questions[0].type, 'graded', 'default stays graded');
assert.equal(typed.questions[1].type, 'ungraded', 'question-level type applied');
assert.equal(typed.questions[2].type, 'graded', 'type does not leak to the next question');
assert.equal(typed.questions[0].gradedNumber, 1, 'first graded question numbered 1');
assert.equal(typed.questions[1].gradedNumber, null, 'ungraded questions have no graded number');
assert.equal(typed.questions[2].gradedNumber, 2, 'graded numbering skips ungraded questions');

const sectionDefault = parseQuizMarkdown([
  '# Course',
  '# Section: Just for fun',
  '::type=ungraded',
  '',
  '## Q1: One?',
  '- [x] yes',
  '',
  '## Q2: Two?',
  '- [x] yes',
  '',
  '# Section: Back to work',
  '',
  '## Q3: Three?',
  '- [x] yes'
].join('\n'));

assert.equal(sectionDefault.questions[0].type, 'ungraded', 'section default inherited');
assert.equal(sectionDefault.questions[1].type, 'ungraded', 'section default inherited by all');
assert.equal(sectionDefault.questions[2].type, 'graded', 'a new section resets the default');

const override = parseQuizMarkdown([
  '# Course',
  '# Section: Fun',
  '::type=ungraded',
  '',
  '## Q1: Actually graded',
  '::type=graded',
  '- [x] yes'
].join('\n'));

assert.equal(override.questions[0].type, 'graded', 'question-level type overrides the section default');

const junk = parseQuizMarkdown([
  '# Course',
  '## Q1: One?',
  '::type=nonsense',
  '- [x] yes'
].join('\n'));

assert.equal(junk.questions[0].type, 'graded', 'an unrecognised type falls back to graded');

const surveyRejected = parseQuizMarkdown([
  '# Course',
  '## Q1: One?',
  '::type=survey',
  '- [x] yes'
].join('\n'));

assert.equal(
  surveyRejected.questions[0].type,
  'graded',
  'survey is not a valid quiz question type in this release'
);

// --- scoring shape ---

assert.equal(gradedCount(typed), 2, 'gradedCount counts only graded questions');
assert.equal(pointsPerQuestion(typed), 50, 'points divide across graded questions only');
assert.equal(pointsPerQuestion(legacy), 50, 'legacy scoring unchanged');

const allUngraded = parseQuizMarkdown([
  '# Course',
  '# Score 100',
  '## Q1: One?',
  '::type=ungraded',
  '- [x] yes'
].join('\n'));

assert.equal(gradedCount(allUngraded), 0, 'an all-ungraded quiz has no graded questions');
assert.equal(pointsPerQuestion(allUngraded), 0, 'no division by zero — returns 0, not NaN');
assert.ok(Number.isFinite(pointsPerQuestion(allUngraded)), 'points per question is always finite');

assert.equal(isScored({ type: 'graded' }), true, 'graded is scored');
assert.equal(isScored({ type: 'ungraded' }), false, 'ungraded is not scored');
assert.equal(isScored({}), true, 'a question with no type is treated as graded');

// --- step helpers ---

assert.equal(stepAt(sectioned, 0).kind, 'section', 'stepAt returns the section step');
assert.equal(stepAt(sectioned, 99), null, 'stepAt past the end returns null');
assert.equal(questionForStep(sectioned, 0), null, 'a section step has no question');
assert.equal(questionForStep(sectioned, 1).text, 'First?', 'questionForStep resolves the question');

// --- stored quizzes from before this release ---

const stored = normalizeStoredQuiz({
  title: 'Old',
  totalScore: 100,
  passingPercent: 70,
  questions: [
    { id: 1, text: 'A', options: ['x', 'y'], correctIndices: [0], timeLimit: 20 },
    { id: 2, text: 'B', options: ['x', 'y'], correctIndices: [1], timeLimit: 20 }
  ]
});

assert.equal(stored.steps.length, 2, 'steps are rebuilt for a quiz stored without them');
assert.equal(stored.questions[0].type, 'graded', 'stored questions default to graded');
assert.equal(stored.questions[0].index, 0, 'stored questions get dense indices');
assert.equal(stored.questions[1].gradedNumber, 2, 'stored questions get graded numbers');
assert.equal(gradedCount(stored), 2, 'a legacy stored quiz counts every question as graded');

// --- code blocks keep their internal indentation ---
//
// text is trimmed at the outer edges only. The parse loop appends the original
// `line`, never the trimmed one, so indentation inside a fenced block survives.
// If this ever breaks, every Python question renders wrong.

const codeQuiz = parseQuizMarkdown([
  '# Intro to Python',
  '# Score 100',
  '',
  '## Q1: What does this print?',
  '```python',
  'def greet(name):',
  '    print(f"Hello, {name}!")',
  '',
  'greet("Alice")',
  '```',
  '- [ ] Hello, name!',
  '- [x] Hello, Alice!',
  '::time=30',
  '',
  '## Q2: Next one?',
  '- [x] yes'
].join('\n'));

const codeText = codeQuiz.questions[0].text;

assert.ok(
  codeText.split('\n').some(l => l === '    print(f"Hello, {name}!")'),
  'four-space indentation inside a fenced code block is preserved exactly'
);
assert.ok(codeText.includes('```python'), 'the opening fence is preserved');
assert.ok(codeText.endsWith('```'), 'text is trimmed to end at the closing fence');
assert.ok(!codeText.startsWith('\n'), 'no leading newline survives the trim');
assert.equal(
  codeQuiz.questions[0].options.length, 2,
  'options after a code block are still parsed'
);
assert.deepEqual(
  codeQuiz.questions[0].correctIndices, [1],
  'the correct answer after a code block is still parsed'
);
assert.equal(codeQuiz.questions[0].timeLimit, 30, '::time after a code block still applies');
assert.equal(codeQuiz.questions[1].text, 'Next one?', 'the following question is unaffected');

// --- step index is not a question index ---
//
// Guards the class of bug where a flow (step) index is used to index into
// questions[]. With sections the two diverge, and the failure is silent.

const divergent = parseQuizMarkdown([
  '# Course',
  '# Score 100',
  '',
  '# Section: One',
  '## Q1: a?',
  '- [x] yes',
  '',
  '# Section: Two',
  '## Q2: b?',
  '- [x] yes'
].join('\n'));

assert.equal(divergent.steps.length, 4, 'four steps: two sections, two questions');
assert.equal(divergent.questions.length, 2, 'but only two questions');
assert.notEqual(
  divergent.steps.length,
  divergent.questions.length,
  'steps and questions diverge once sections exist — indexing one with the other is a bug'
);
assert.equal(questionForStep(divergent, 0), null, 'step 0 is a section, not a question');
assert.equal(questionForStep(divergent, 1).text, 'a?', 'step 1 resolves to the first question');
assert.equal(questionForStep(divergent, 2), null, 'step 2 is a section, not a question');
assert.equal(questionForStep(divergent, 3).text, 'b?', 'step 3 resolves to the second question');
assert.equal(questionForStep(divergent, 4), null, 'past the end returns null, not undefined');
assert.equal(questionForStep(divergent, -1), null, 'a negative index returns null');
assert.equal(
  divergent.questions[divergent.steps.length - 1],
  undefined,
  'indexing questions[] with a step index runs off the end — the bug this guards'
);

console.log('All quiz structure tests passed.');
