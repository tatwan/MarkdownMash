const DEFAULT_INVITE_TTL_HOURS = 72;
const MAX_INVITE_TTL_HOURS = 168;
const MIN_INVITE_PASSWORD_LENGTH = 12;
const MAX_BCRYPT_PASSWORD_BYTES = 72;

function resolveInviteTtlHours(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_INVITE_TTL_HOURS;
  return Math.min(parsed, MAX_INVITE_TTL_HOURS);
}

function invitationExpiry(ttlHours, now = Date.now()) {
  return new Date(now + resolveInviteTtlHours(ttlHours) * 60 * 60 * 1000);
}

function maskEmail(email) {
  const [localPart, domain] = String(email || '').split('@');
  if (!localPart || !domain) return '';
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(2, localPart.length - visible.length))}@${domain}`;
}

function buildInvitationUrl(baseUrl, token) {
  const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
  if (!normalizedBase || !token) return null;
  return `${normalizedBase}/admin.html#invite=${encodeURIComponent(token)}`;
}

function getInvitationPasswordError(password) {
  if (typeof password !== 'string' || password.length < MIN_INVITE_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_INVITE_PASSWORD_LENGTH} characters`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_BCRYPT_PASSWORD_BYTES) {
    return `Password must be ${MAX_BCRYPT_PASSWORD_BYTES} bytes or fewer`;
  }
  return null;
}

module.exports = {
  DEFAULT_INVITE_TTL_HOURS,
  MAX_BCRYPT_PASSWORD_BYTES,
  MAX_INVITE_TTL_HOURS,
  MIN_INVITE_PASSWORD_LENGTH,
  buildInvitationUrl,
  getInvitationPasswordError,
  invitationExpiry,
  maskEmail,
  resolveInviteTtlHours
};
