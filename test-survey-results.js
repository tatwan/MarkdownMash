const assert = require('node:assert/strict');
const { summarizeSurveyQuestion, buildSurveySummary } = require('./survey-results');

const question = summarizeSurveyQuestion({
  text: 'Preferred pace?',
  options: ['Faster', 'Keep it', 'Slower'],
  counts: [2, 5, 5],
  displayNumber: 3
}, 15, 2);

assert.equal(question.responseCount, 12);
assert.equal(question.responseRate, 80);
assert.deepEqual(question.topOptionIndices, [1, 2]);
assert.deepEqual(question.topOptions, ['Keep it', 'Slower']);
assert.deepEqual(question.optionDistribution.map(option => option.percent), [17, 42, 42]);
assert.equal(question.displayNumber, 3);

const summary = buildSurveySummary([
  { text: 'One?', options: ['A', 'B'], counts: [3, 1] },
  { text: 'Two?', options: ['C', 'D'], counts: [2, 2] }
], 5);

assert.equal(summary.participantCount, 5);
assert.equal(summary.questionCount, 2);
assert.equal(summary.responseCount, 8);
assert.equal(summary.responseRate, 80);
assert.deepEqual(summary.questions[1].topOptionIndices, [0, 1]);

const empty = buildSurveySummary([{ text: 'Empty?', options: ['A'], counts: [] }], 0);
assert.equal(empty.responseCount, 0);
assert.equal(empty.responseRate, 0);
assert.deepEqual(empty.questions[0].topOptions, []);

console.log('Survey result summaries passed');
