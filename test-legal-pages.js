const assert = require('assert');
const fs = require('fs');
const path = require('path');

function readPublic(file) {
  return fs.readFileSync(path.join(__dirname, 'public', file), 'utf8');
}

const terms = readPublic('terms.html');
const privacy = readPublic('privacy.html');
const refunds = readPublic('refunds.html');
const landing = readPublic('index.html');
const admin = readPublic('admin.html');
const player = readPublic('play.html');

for (const [name, page] of Object.entries({ terms, privacy, refunds })) {
  assert.match(page, /Effective August 3, 2026/, `${name} must show an effective date`);
  assert.match(page, /info@markdownmash\.com/, `${name} must show the support email`);
  assert.match(page, /Markdown Mash by Ensemble Methods/, `${name} must identify the operator`);
}

assert.match(terms, /recurring annual subscription/);
assert.match(terms, /Independent copies deployed from the public GitHub repository/);
assert.match(privacy, /Participants do not create hosted accounts/);
assert.match(privacy, /do not sell personal information/);
assert.match(privacy, /Render for application hosting/);
assert.match(privacy, /Supabase for the PostgreSQL database/);
assert.match(privacy, /Stripe for billing/);
assert.match(privacy, /Resend for transactional email/);
assert.match(refunds, /seven calendar days of your initial subscription payment/);

for (const page of [landing, admin]) {
  assert.match(page, /href="\/terms\.html"/);
  assert.match(page, /href="\/privacy\.html"/);
  assert.match(page, /href="\/refunds\.html"/);
  assert.match(page, /mailto:info@markdownmash\.com/);
}
assert.match(player, /How Markdown Mash handles participant data/);

console.log('Legal, privacy, refund, and support links passed');
