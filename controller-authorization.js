function normalizeId(value) {
  return value === null || value === undefined ? null : String(value);
}

// Which owner_id the history and analytics queries should be scoped to.
// The value feeds the SQL guard ($1::integer IS NULL OR owner_id = $1), so
// returning null would disable filtering and pull in every account's rows.
// Every admin, master included, sees only their own sessions: the master's
// dashboard is their host dashboard, not an operator view. Cross-account
// figures belong in a separate aggregate-only surface that never exposes
// quiz content, participant names, or per-session detail.
function ownerFilterFor(admin) {
  return admin.id;
}

// Stored sessions carry a host's quiz content, participant names, and answers.
// Ownership is the only key, for the master as much as anyone: an operator
// needing to investigate goes to the database, not through another host's
// analytics screens. Live-room control is handled separately by
// canControlSession, which does keep a master branch on purpose.
// A null owner_id predates the column (db.js:211) and therefore predates
// multi-admin, so it can only be a session the master created when they were
// the only account. createSession has always passed req.admin.id since the
// column existed (server.js:1443), so new rows are never null. Once the
// backfill migration has run on a deployment, this branch is dead and can go.
function canAdminAccessStoredSession(admin, sessionRecord) {
  if (!admin || !sessionRecord) return false;
  if (sessionRecord.owner_id === null || sessionRecord.owner_id === undefined) {
    return admin.role === 'master';
  }
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
  ownerFilterFor,
  canAdminAccessStoredSession,
  canControlSession
};
