const assert = require('node:assert/strict');
const {
  buildInvitationUrl,
  getInvitationPasswordError,
  invitationExpiry,
  maskEmail,
  resolveInviteTtlHours
} = require('./account-invitations');

assert.equal(resolveInviteTtlHours(undefined), 72);
assert.equal(resolveInviteTtlHours('24'), 24);
assert.equal(resolveInviteTtlHours('999'), 168);
assert.equal(resolveInviteTtlHours('0'), 72);
assert.equal(
  invitationExpiry(24, Date.parse('2026-08-02T00:00:00Z')).toISOString(),
  '2026-08-03T00:00:00.000Z'
);
assert.equal(maskEmail('teacher@example.com'), 'te*****@example.com');
assert.equal(maskEmail('a@example.com'), 'a**@example.com');
assert.equal(maskEmail('invalid'), '');
assert.equal(
  buildInvitationUrl('https://mash.example/', 'secret/token'),
  'https://mash.example/admin.html#invite=secret%2Ftoken'
);
assert.equal(getInvitationPasswordError('short'), 'Password must be at least 12 characters');
assert.equal(getInvitationPasswordError('correct horse battery staple'), null);
assert.equal(
  getInvitationPasswordError('🔐'.repeat(19)),
  'Password must be 72 bytes or fewer'
);

console.log('Hosted account invitation tests passed');
