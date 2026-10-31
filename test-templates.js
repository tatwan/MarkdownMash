const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { parseQuizMarkdown, gradedCount } = require('./quiz-structure');

const templatesDir = path.join(__dirname, 'templates');
const studioKeys = ['math', 'python', 'data-science', 'marvel', 'music', 'history'];
const surveyKeys = ['survey-food', 'survey-movies', 'survey-sports'];
const showcase = 'classroom-modules';

assert.ok(fs.existsSync(templatesDir), 'templates/ directory must exist');
assert.ok(fs.existsSync(path.join(templatesDir, 'README.md')), 'templates/README.md must exist');

for (const key of studioKeys) {
  const filePath = path.join(templatesDir, `${key}.md`);
  assert.ok(fs.existsSync(filePath), `templates/${key}.md must exist`);
  const markdown = fs.readFileSync(filePath, 'utf8');
  const quiz = parseQuizMarkdown(markdown);
  assert.ok(quiz.title, `${key} must parse a title`);
  assert.ok(quiz.questions.length >= 1, `${key} must have at least one question`);
  assert.ok(
    gradedCount(quiz) >= 1 || quiz.questions.every(q => q.type === 'ungraded'),
    `${key} must either have graded questions or be intentionally all-ungraded`
  );
}

const showcasePath = path.join(templatesDir, `${showcase}.md`);
assert.ok(fs.existsSync(showcasePath), 'templates/classroom-modules.md showcase must exist');
const showcaseQuiz = parseQuizMarkdown(fs.readFileSync(showcasePath, 'utf8'));
assert.ok(
  showcaseQuiz.steps.some(step => step.kind === 'section'),
  'classroom-modules showcase must include at least one section'
);
assert.ok(
  showcaseQuiz.questions.some(q => q.type === 'ungraded'),
  'classroom-modules showcase must include at least one ungraded question'
);
assert.equal(gradedCount(showcaseQuiz), 3, 'classroom-modules has three graded questions');

const history = parseQuizMarkdown(
  fs.readFileSync(path.join(templatesDir, 'history.md'), 'utf8')
);
assert.ok(history.steps.some(step => step.kind === 'section'), 'history starter uses a section');
assert.ok(
  history.questions.some(q => q.type === 'ungraded'),
  'history starter includes an ungraded question'
);

const python = parseQuizMarkdown(
  fs.readFileSync(path.join(templatesDir, 'python.md'), 'utf8')
);
assert.ok(python.steps.some(step => step.kind === 'section'), 'python starter uses sections');
assert.ok(
  python.questions.some(q => q.type === 'ungraded'),
  'python starter includes an ungraded question'
);

const { parseSurveyMarkdown } = require('./survey-structure');
const { parseQuizMarkdownLocal } = require('./public/js/quiz-preview-parser');
const { parseSurveyMarkdown: parseSurveyPreview } = require('./public/js/survey-preview-parser');
const { caseStudyForQuestion } = require('./public/js/mash-parser');
const guestMarkdown = fs.readFileSync(path.join(__dirname, 'demo-quizzes', 'quick-wins.md'), 'utf8');
const guestQuiz = parseQuizMarkdown(guestMarkdown);
assert.deepEqual(parseQuizMarkdownLocal(guestMarkdown), guestQuiz, 'guest mission preview matches the launched quiz');
assert.equal(guestQuiz.questions.length, 5, 'guest mission stays short');
assert.equal(gradedCount(guestQuiz), 4, 'the bonus does not affect the score');
assert.equal(guestQuiz.totalScore, 100);
assert.ok(guestQuiz.questions.every(q => q.timeLimit <= 45), 'guest questions keep a quick pace');
assert.ok(guestQuiz.questions.some(q => q.correctIndices.length > 1 && q.type !== 'ungraded'), 'guest mission demonstrates multiple valid answers');
assert.ok(guestQuiz.steps.some(step => step.kind === 'section'), 'guest mission demonstrates a section curtain');
const guestReference = caseStudyForQuestion(guestQuiz, guestQuiz.questions[0]);
assert.equal(guestReference.panels.length, 3);
assert.ok(guestReference.panels.some(panel => panel.text.includes('```mermaid')), 'guest mission includes a route diagram');
assert.ok(guestReference.panels.some(panel => panel.text.includes('| Robot |')), 'guest mission includes a clue table');
assert.equal(caseStudyForQuestion(guestQuiz, guestQuiz.questions[4]), null, 'the bonus does not carry stale mission references');

for (const [key, parse, preview, count] of [
  ['quiz-field-trip', parseQuizMarkdown, parseQuizMarkdownLocal, 3],
  ['survey-field-trip', parseSurveyMarkdown, parseSurveyPreview, 2]
]) {
  const markdown = fs.readFileSync(path.join(templatesDir, `${key}.md`), 'utf8');
  const mash = parse(markdown);
  assert.deepEqual(preview(markdown), mash, `${key} preview matches server`);
  assert.equal(mash.questions.length, count);
  assert.equal(mash.caseStudies.length, 1);
  assert.equal(mash.steps.length, count);
  const panels = caseStudyForQuestion(mash, mash.questions[0]).panels;
  assert.equal(panels.length, 2);
  assert.match(panels[0].text, /!\[.+\]\(https:\/\//);
  assert.match(panels[1].text, /\| Route \| Walking time \|/);
  assert.ok(mash.questions.every(q => q.caseStudyId === 'trip' && q.options.length === 3));
  if (key.startsWith('survey')) assert.ok(mash.questions.every(q => q.correctIndices.length === 0));
  else assert.ok(mash.questions.every(q => q.correctIndices.length === 1));
}
for (const key of surveyKeys) {
  const filePath = path.join(templatesDir, `${key}.md`);
  assert.ok(fs.existsSync(filePath), `templates/${key}.md must exist`);
  const survey = parseSurveyMarkdown(fs.readFileSync(filePath, 'utf8'));
  assert.equal(survey.sessionKind, 'survey');
  assert.ok(survey.questions.length >= 2, `${key} needs at least two questions`);
  assert.ok(
    survey.questions.every(q => q.correctIndices.length === 0),
    `${key} must not mark correct answers`
  );
}

console.log('Template gallery contract passed');
