const assert = require('assert');
const fs = require('fs');
const path = require('path');

const adminHtml = fs.readFileSync(path.join(__dirname, 'public', 'admin.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, 'public', 'js', 'admin.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'style.css'), 'utf8');

for (const id of [
  'instructor-home-section',
  'home-host-btn',
  'home-survey-btn',
  'home-analytics-btn',
  'home-account-btn',
  'open-template-btn',
  'template-modal',
  'analytics-empty-state',
  'analytics-empty-host-btn'
]) {
  assert.match(adminHtml, new RegExp(`id=["']${id}["']`), `${id} must exist`);
}

for (const sidekick of ['zap', 'booky', 'chestie', 'byte', 'rocketo', 'popstar', 'luna']) {
  assert.ok(
    fs.existsSync(path.join(__dirname, 'assets', 'sidekicks', 'webp', '256', `${sidekick}.webp`)),
    `${sidekick} Sidekick must exist`
  );
}

assert.match(adminHtml, />Create host account<\/button>/);
assert.match(adminHtml, /class="hosted-plan-sticker"/);
assert.match(adminHtml, /Unlimited Mashes \+ saved analytics/);
assert.match(adminHtml, /Up to 50 per Mash · 1 live room/);
assert.match(styleCss, /\.hosted-plan-sticker\s*\{/);
assert.match(adminHtml, /Email verification required · 7-day money-back guarantee/);
assert.match(adminHtml, />Open studio</);
assert.match(adminHtml, /placeholder="Mash group \(optional\)"/);
assert.match(indexHtml, />\s*Host a Mash\s*</);
assert.match(adminJs, /function showInstructorHome\(\)/);
assert.match(adminJs, /homeHostBtn\?\.addEventListener\('click'/);
assert.match(adminJs, /homeAnalyticsBtn\?\.addEventListener\('click', showAnalytics\)/);
assert.match(adminJs, /homeAccountBtn\?\.addEventListener\('click', openSettings\)/);
assert.match(adminJs, /analyticsEmptyState\.classList\.toggle\('hidden', hasSessions\)/);
assert.match(adminJs, /Cancellation scheduled/);
assert.match(adminJs, /Cancels on/);
assert.match(adminJs, /Billing: cancellation scheduled/);
assert.match(adminJs, /identity\.className = 'instructor-account-identity'/);
assert.match(styleCss, /\.instructor-account-row\s*\{[^}]*flex-wrap: wrap/s);
assert.match(styleCss, /\.instructor-account-meta\s*\{[^}]*flex: 1 0 100%/s);
for (const template of ['math', 'python', 'data-science', 'marvel', 'music', 'history']) {
  assert.match(adminHtml, new RegExp(`data-template=["']${template}["']`));
  // Keys may be bare (math:) or quoted ('data-science':).
  const keyPattern = template.includes('-')
    ? `['"]${template.replace(/-/g, '\\-')}['"]`
    : template;
  assert.match(
    adminJs,
    new RegExp(`${keyPattern}\\s*:\\s*['"]/templates/${template.replace(/-/g, '\\-')}\\.md['"]`),
    `studio must map ${template} to /templates/${template}.md`
  );
  assert.ok(
    fs.existsSync(path.join(__dirname, 'templates', `${template}.md`)),
    `templates/${template}.md must exist for the starter gallery`
  );
}
assert.match(adminHtml, /Marvel Movies &amp; TV/);
assert.match(adminHtml, /Music &amp; Lyrics/);
assert.match(adminHtml, /History Highlights/);
assert.match(adminJs, /const STARTER_TEMPLATE_FILES = Object\.freeze/);
assert.match(adminJs, /fetch\(templateUrl/);
assert.match(adminJs, /sessionType/);
assert.match(adminJs, /studioMode/);
assert.match(adminJs, /Replace the Markdown currently in the editor/);
for (const survey of ['survey-food', 'survey-movies', 'survey-sports']) {
  assert.ok(
    fs.existsSync(path.join(__dirname, 'templates', `${survey}.md`)),
    `templates/${survey}.md must exist`
  );
}
assert.match(adminHtml, /\/js\/settings-state\.js/);
assert.doesNotMatch(adminJs, /event\.currentTarget\.reset\(\)/);
assert.doesNotMatch(adminJs, /const STARTER_TEMPLATES = Object\.freeze/);
assert.ok(
  !fs.existsSync(path.join(__dirname, 'sample-quiz.md')),
  'sample-quiz.md was replaced by the templates/ folder'
);

console.log('Host home, starter templates, and empty analytics contract passed');
