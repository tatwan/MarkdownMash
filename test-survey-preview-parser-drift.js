const assert = require('node:assert/strict');
const { parseSurveyMarkdown } = require('./survey-structure');
const { parseSurveyMarkdown: parseSurveyPreview } = require('./public/js/survey-preview-parser');

function assertParsersAgree(markdown, label) {
  assert.deepStrictEqual(
    parseSurveyPreview(markdown),
    parseSurveyMarkdown(markdown),
    `${label}: the browser preview differs from the live survey parser`
  );
}

assertParsersAgree([
  '# Classroom pulse',
  '# Score 100',
  '',
  '# Section: Warm-up',
  '> Start with a quick check-in.',
  '',
  '## Q1: How is the pace?',
  '- [ ] Too slow',
  '- [x] Just right',
  '- [ ] Too fast',
  '::time=25',
  '',
  '# Section: Reflection',
  '',
  '## Q2: Which topic should we revisit?',
  '- Dictionaries',
  '- Loops',
  '- Functions',
  '::type=graded'
].join('\n'), 'sections and mixed option syntax');

assertParsersAgree([
  '# Developer pulse',
  '',
  '## Q1: Which line felt clearest?',
  '',
  '    trip.get("tip", 0.0)',
  '',
  '- The fallback',
  '- The method name',
  '- Neither',
  '::time=40'
].join('\n'), 'multiline question with code');

console.log('All survey preview-parser drift tests passed.');
