const AUTHENTICATABLE_ACCOUNT_STATUSES = new Set(['active', 'past_due']);
const HOSTED_AUTH_SOURCE = 'hosted';

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return Boolean(
    email
    && email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function getAccountAuthenticationFailure(account, { hostedMode = false } = {}) {
  if (!account || account.is_active === false) {
    return {
      code: 'ACCOUNT_DISABLED',
      message: 'This instructor account is not available.'
    };
  }

  const status = account.account_status || 'active';
  if (!AUTHENTICATABLE_ACCOUNT_STATUSES.has(status)) {
    return {
      code: 'ACCOUNT_UNAVAILABLE',
      message: 'This instructor account is not available.'
    };
  }

  if (hostedMode
    && account.role !== 'master'
    && account.auth_source === HOSTED_AUTH_SOURCE
    && !account.email_verified_at) {
    return {
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Verify your email before signing in.'
    };
  }

  return null;
}

module.exports = {
  AUTHENTICATABLE_ACCOUNT_STATUSES,
  HOSTED_AUTH_SOURCE,
  getAccountAuthenticationFailure,
  isValidEmail,
  normalizeEmail
};
