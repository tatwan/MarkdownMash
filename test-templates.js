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
