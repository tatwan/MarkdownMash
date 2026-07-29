function normalizeId(value) {
  return value === null || value === undefined ? null : String(value);
}

function canAdminAccessStoredSession(admin, sessionRecord) {
  if (!admin || !sessionRecord) return false;
  if (admin.role === 'master') return true;
  return normalizeId(sessionRecord.owner_id) === normalizeId(admin.id);
}

function canControlSession(principal, session) {
  if (!principal || !session || !session.controller) return false;

  if (session.kind === 'trial') {
    return principal.type === 'trial'
      && normalizeId(principal.id) === normalizeId(session.controller.id);
  }

  if (principal.type !== 'admin') return false;
  if (principal.role === 'master') return true;

  return session.controller.type === 'admin'
    && normalizeId(principal.id) === normalizeId(session.controller.id);
}

module.exports = {
  canAdminAccessStoredSession,
  canControlSession
};
