const assert = require('node:assert/strict');
const { createEmailService, escapeHtml } = require('./email-service');

assert.equal(escapeHtml('<Teacher & Co>'), '&lt;Teacher &amp; Co&gt;');

let captured;
const service = createEmailService({
  apiKey: 're_test',
  from: 'Markdown Mash <info@mail.example.com>',
  replyTo: 'info@example.com',
  fetchImpl: async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: 'email_123' }) };
  }
});

(async () => {
  const result = await service.sendAccountVerification({
    to: 'teacher@example.com',
    displayName: '<Teacher>',
    inviteUrl: 'https://mash.example/admin.html#invite=secret',
    invitationId: 42,
    expiresAt: '2030-01-02T03:04:05.000Z'
  });
  assert.equal(result.id, 'email_123');
  assert.equal(captured.url, 'https://api.resend.com/emails');
  assert.equal(captured.options.headers['Idempotency-Key'], 'markdown-mash-verification-42');
  const body = JSON.parse(captured.options.body);
  assert.equal(body.reply_to, 'info@example.com');
  assert.match(body.html, /&lt;Teacher&gt;/);
  assert.doesNotMatch(body.html, /<Teacher>/);
  assert.match(body.text, /Wed, 02 Jan 2030 03:04:05 GMT/);
  console.log('Transactional email tests passed');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
