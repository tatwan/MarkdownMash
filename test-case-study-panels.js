const assert = require('node:assert/strict');
const { parseQuizMarkdown, gradedCount, pointsPerQuestion, normalizeStoredQuiz } = require('./quiz-structure');
const { parseSurveyMarkdown, normalizeStoredSurvey } = require('./survey-structure');
const { parseQuizMarkdownLocal } = require('./public/js/quiz-preview-parser');
const { caseStudyForQuestion } = require('./public/js/mash-parser');
const { parseSurveyMarkdown: parseSurveyPreview } = require('./public/js/survey-preview-parser');

const source = [
  '# Cases', '# Score 120', '# Section: Analysis', '::type=ungraded',
  ':::case services | Service review',
  ':::panel Background', '# Background heading', '## This is not a question',
  '- [x] This is a reference list', '::time=999', '::case=not-a-link',
  ':::panel Data', '| Service | ms |', '| --- | ---: |', '| A | 10 |',
  ':::panel Code', '````markdown', '# Score 999', '# Section: Fake',
  '## Q99: Fake question', '- [x] Fake answer', '::type=graded',
  ':::panel Not a panel', ':::endcase', '```', '  indentation', '`````',
  ':::panel Diagram', '![Architecture](https://example.com/architecture.png)',
  ':::endcase',
  '## Q1: Best service?', '::case=services', '- [x] A', '- [ ] B', '::time=60',
  '## Q2: Explain the tradeoff?', '::case=services', '::type=graded', '- [ ] A', '- [x] B',
  '## Q3: Independent?', '::type=graded', '- [x] Yes',
  // Unused future reference definitions must never attach to another question.
  ':::case future | Future reference', ':::panel Future data', 'Secret future scenario', ':::endcase'
].join('\n');

for (const [parse, preview, normalize] of [
  [parseQuizMarkdown, parseQuizMarkdownLocal, normalizeStoredQuiz],
  [parseSurveyMarkdown, parseSurveyPreview, normalizeStoredSurvey]
]) {
  const quiz = parse(source);
  assert.deepEqual(preview(source), quiz, 'preview and server use identical structures');
  assert.equal(quiz.questions.length, 3);
  assert.deepEqual(quiz.steps.map(step => step.kind), ['section', 'question', 'question', 'question']);
  assert.deepEqual(quiz.questions.map(q => q.index), [0, 1, 2]);
  const reference = caseStudyForQuestion(quiz, quiz.questions[0]);
  assert.equal(reference.title, 'Service review');
  assert.equal(reference.panels.length, 4);
  assert.match(reference.panels[0].text, /## This is not a question/);
  assert.match(reference.panels[0].text, /- \[x\] This is a reference list/);
  assert.match(reference.panels[2].text, /:::endcase/);
  assert.match(reference.panels[2].text, /  indentation/);
  assert.deepEqual(caseStudyForQuestion(quiz, quiz.questions[1]), reference);
  assert.equal(caseStudyForQuestion(quiz, quiz.questions[2]), null, 'reference links do not leak to the next question');
  assert.equal(quiz.questions[0].timeLimit, 60);
  assert.deepEqual(quiz.questions[0].options, ['A', 'B']);
  assert.equal(quiz.caseStudies.length, 2, 'definitions are stored once');
  assert.equal(quiz.questions[0].caseStudyId, 'services');
  assert.equal(quiz.questions[0].caseStudy, undefined, 'questions only store a reference id');
  const stored = normalize(JSON.parse(JSON.stringify(quiz)));
  assert.deepEqual(caseStudyForQuestion(stored, stored.questions[0]), reference);

  for (const fence of ['```', '~~~~']) {
    const fenced = parse([
      '# Literal code', '## Q1: Read this', `${fence}markdown`, '# Score 999',
      '# Section: Fake', '## Q99: Fake', '- [x] Fake', '::time=999',
      '::case=missing', ':::case fake | Fake', ':::endcase',
      fence[0] === '`' ? '~~~' : '```', // Opposite character does not close.
      fence.slice(1), // A shorter fence does not close.
      '## Still code', fence + fence[0], '- [x] Real', '::time=35',
      '## Q2: Real second', '- [x] Yes'
    ].join('\n'));
    assert.deepEqual(preview([
      '# Test', '## One', fence, '## Literal', fence, '- [x] Yes'
    ].join('\n')), parse([
      '# Test', '## One', fence, '## Literal', fence, '- [x] Yes'
    ].join('\n')));
    assert.equal(fenced.title, 'Literal code');
    assert.equal(fenced.questions.length, 2);
    assert.equal(fenced.steps.length, 2);
    assert.match(fenced.questions[0].text, /## Still code/);
    assert.equal(fenced.questions[0].timeLimit, 35);
    assert.deepEqual(fenced.questions[0].options, ['Real']);
  }
  const forward = parse('## Q1: Forward?\n::case=later\n- [x] Yes\n:::case later | Later\n:::panel Text\nContent\n:::endcase');
  assert.equal(caseStudyForQuestion(forward, forward.questions[0]).id, 'later');
  for (const invalid of [
    '## Q1: Missing\n::case=missing',
    '::case=orphan',
    ':::panel Orphan',
    ':::endcase',
    ':::case bad | Bad\n:::panel Empty\n:::endcase',
    ':::case bad | Bad\n:::endcase',
    ':::case bad | Bad\nText outside a panel\n:::endcase',
    ':::case bad | Bad\n```\n:::endcase',
    ':::case bad | Bad\n:::panel Text\nContent',
    ':::case bad | Bad\n:::case nested | Nested',
    ':::case bad | Bad\n:::panel Text\nContent\n:::endcase\n:::case bad | Duplicate',
    ':::case Bad_Id | Bad',
    '## Q1: Duplicate\n::case=a\n::case=b'
  ]) {
    assert.throws(() => parse(invalid), error => error.code === 'MARKDOWN_STRUCTURE_INVALID');
    assert.throws(() => preview(invalid), error => error.code === 'MARKDOWN_STRUCTURE_INVALID');
  }
}

const scored = parseQuizMarkdown(source);
assert.equal(scored.totalScore, 120);
assert.equal(gradedCount(scored), 2);
assert.equal(pointsPerQuestion(scored), 60);
assert.deepEqual(scored.questions.map(q => q.gradedNumber), [null, 1, 2]);
const surveyed = parseSurveyMarkdown(source);
assert.deepEqual(surveyed.questions.map(q => q.displayNumber), [1, 2, 3]);
assert.ok(surveyed.questions.every(q => !q.correctIndices.length));
console.log('All case-study panel structure tests passed.');
