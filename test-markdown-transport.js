const assert = require('node:assert/strict');
const { decodeMarkdownPayload, MAX_MARKDOWN_BYTES } = require('./markdown-transport');
const { parseQuizMarkdown } = require('./quiz-structure');

const technicalQuiz = [
  '# Week 2 Day 2 Exit Ticket',
  '# Score 100',
  '## Q1: A script fails with `KeyError: \'tip\'` while reading a dictionary named `trip`. Which fix is safest when `tip` is optional?',
  '- [ ] Rename the dictionary to `tips`',
  '- [x] Use `trip.get("tip", 0.0)`',
  '- [ ] Convert the dictionary to a list',
  '- [ ] Delete the record',
  '::time=40',
  '## Q2: Which command should you use from the local Day 2 UV project to run a completed script?',
  '- [ ] `pip run python script.py`',
  '- [ ] `python -m pip script.py`',
  '- [ ] `conda run script.py`',
  '- [x] `uv run python script.py`',
  '::time=40'
].join('\n');
const encoded = Buffer.from(technicalQuiz, 'utf8').toString('base64');

assert.equal(decodeMarkdownPayload({ markdownBase64: encoded }), technicalQuiz);
assert.equal(parseQuizMarkdown(decodeMarkdownPayload({ markdownBase64: encoded })).questions.length, 2);
assert.equal(decodeMarkdownPayload({ markdown: technicalQuiz }), technicalQuiz);
assert.equal(decodeMarkdownPayload({}), '');
assert.throws(() => decodeMarkdownPayload({ markdownBase64: 'not base64!' }), /encoding is invalid/);
assert.throws(
  () => decodeMarkdownPayload({ markdown: 'x'.repeat(MAX_MARKDOWN_BYTES + 1) }),
  /too large/
);

console.log('Markdown transport tests passed');
