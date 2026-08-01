const assert = require('node:assert/strict');
const {
  getAccountAuthenticationFailure,
  isValidEmail,
  normalizeEmail
} = require('./account-identity');

assert.equal(normalizeEmail(' Teacher@Example.COM '), 'teacher@example.com');
assert.equal(normalizeEmail('  '), null);
assert.equal(isValidEmail('teacher@example.com'), true);
assert.equal(isValidEmail(' Teacher@Example.COM '), true);
assert.equal(isValidEmail('not-an-email'), false);
assert.equal(isValidEmail('teacher@localhost'), false);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'admin',
    is_active: true,
    account_status: 'active',
    auth_source: 'hosted',
    email_verified_at: new Date()
  }, { hostedMode: true }),
  null,
  'verified hosted instructors should authenticate'
);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'admin',
    is_active: true,
    account_status: 'active',
    auth_source: 'hosted',
    email_verified_at: null
  }, { hostedMode: true }).code,
  'EMAIL_NOT_VERIFIED'
);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'master',
    is_active: true,
    account_status: 'active',
    auth_source: 'deployment',
    email_verified_at: null
  }, { hostedMode: true }),
  null,
  'the deployment master should not require hosted email verification'
);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'admin',
    is_active: true,
    account_status: 'suspended',
    auth_source: 'hosted',
    email_verified_at: new Date()
  }, { hostedMode: true }).code,
  'ACCOUNT_UNAVAILABLE'
);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'admin',
    is_active: true,
    account_status: 'past_due',
    auth_source: 'hosted',
    email_verified_at: new Date()
  }, { hostedMode: true }),
  null,
  'past-due accounts should remain available during the billing grace period'
);

assert.equal(
  getAccountAuthenticationFailure({
    role: 'admin',
    is_active: false,
    account_status: 'active'
  }).code,
  'ACCOUNT_DISABLED'
);

console.log('Account identity tests passed');
