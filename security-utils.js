const crypto = require('crypto');

function createOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashOpaqueToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest();
}

function verifyOpaqueToken(token, expectedDigest) {
  if (!token || !Buffer.isBuffer(expectedDigest)) return false;
  const actualDigest = hashOpaqueToken(token);
  return actualDigest.length === expectedDigest.length
    && crypto.timingSafeEqual(actualDigest, expectedDigest);
}

function escapeCSV(value) {
  if (value == null) return '';

  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

module.exports = {
  createOpaqueToken,
  escapeCSV,
  hashOpaqueToken,
  verifyOpaqueToken
};
