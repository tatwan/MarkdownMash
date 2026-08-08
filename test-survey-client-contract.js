const assert = require('node:assert/strict');
const fs = require('node:fs');

const adminHtml = fs.readFileSync('public/admin.html', 'utf8');
const adminJs = fs.readFileSync('public/js/admin.js', 'utf8');
const playHtml = fs.readFileSync('public/play.html', 'utf8');
const playJs = fs.readFileSync('public/js/play.js', 'utf8');
const presentHtml = fs.readFileSync('public/present.html', 'utf8');
const presentJs = fs.readFileSync('public/js/present.js', 'utf8');
const serverJs = fs.readFileSync('server.js', 'utf8');

for (const [html, js, id] of [
  [playHtml, playJs, 'survey-response-section'],
  [playHtml, playJs, 'survey-complete-section'],
  [presentHtml, presentJs, 'survey-locked-section'],
  [presentHtml, presentJs, 'survey-finale-section']
]) {
  assert.match(html, new RegExp(`id="${id}"`), `${id} must exist in its page`);
  const variableName = id.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  assert.match(js, new RegExp(`${variableName}\\.classList\\.add\\('hidden'\\)`), `${id} must be hidden by hideAllSections`);
}

assert.match(adminHtml, /id="session-type-filter"/, 'analytics must offer a type filter');
assert.match(adminHtml, /<th>Type<\/th>/, 'analytics rows must identify the session type');
assert.match(playHtml, /Join the Mash/, 'the pre-join action must be neutral for quizzes and surveys');
assert.doesNotMatch(playHtml, /Join the quiz/i, 'the participant entry screen must not assume quiz mode');
assert.match(adminJs, /data\.mode === 'survey'/, 'live results must branch for survey summaries');
assert.doesNotMatch(adminJs, /\balert\s*\(/, 'native alerts must not bypass the styled dialog');
assert.doesNotMatch(adminJs, /\bconfirm\s*\(/, 'native confirms must not bypass the styled dialog');
assert.match(serverJs, /session\.surveyCounts\[question\.index\] = distribution\.counts\.slice\(\)/, 'survey totals must be detached before personal choices are cleared');
assert.match(serverJs, /delete participant\.answers\[question\.id\]/, 'closed survey choices must not remain linked to participant identity');

console.log('All survey client contract tests passed.');
