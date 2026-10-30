const assert = require('node:assert/strict');
const { getQuestionForParticipants } = require('./question-payload');
const { parseQuizMarkdown } = require('./quiz-structure');

const quiz = parseQuizMarkdown([
  ':::case current | Current reference', ':::panel Text', 'Safe reference', ':::endcase',
  ':::case future | Future reference', ':::panel Text', 'Future secret', ':::endcase',
  '## Q1: Current question', '::case=current', '- [x] Yes', '- [ ] No',
  '## Q2: Future question', '::case=future', '- [x] Answer key'
].join('\n'));
const question = quiz.questions[0];
// Even incidental fields on persisted objects cannot widen the public payload.
question.futureQuestions = quiz.questions.slice(1);
const reference = quiz.caseStudies[0];
reference.correctIndices = [0];
reference.panels[0].answerKey = 'Secret';
const payload = getQuestionForParticipants(question, quiz);
assert.equal(payload.caseStudy.panels[0].text, 'Safe reference');
assert.doesNotMatch(JSON.stringify(payload), /correctIndices|answerKey|futureQuestions|Future secret|Future question|Answer key/);
assert.notEqual(payload.caseStudy, reference);
assert.notEqual(payload.caseStudy.panels[0], reference.panels[0]);
assert.equal(getQuestionForParticipants({ id: 1 }).caseStudy, null, 'legacy questions have no references');
console.log('All question payload tests passed.');
