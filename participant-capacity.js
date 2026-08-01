function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolvePersistentParticipantLimit({ hostedMode, configuredLimit }) {
  if (!hostedMode) return null;
  return parsePositiveInteger(configuredLimit, 50);
}

function resolveParticipantLimitForAdmin(admin, hostedParticipantLimit) {
  if (admin?.role === 'master') return null;
  return hostedParticipantLimit;
}

function getParticipantAdmission(session, { isValidRejoin = false } = {}) {
  if (isValidRejoin) {
    return { allowed: true, isRejoin: true };
  }

  const limit = Number.isInteger(session?.participantLimit) && session.participantLimit > 0
    ? session.participantLimit
    : null;
  const joinedParticipantCount = Object.keys(session?.participants || {}).length;
  const pendingParticipantCount = Number.isInteger(session?.pendingParticipantJoins)
    && session.pendingParticipantJoins > 0
    ? session.pendingParticipantJoins
    : 0;
  const participantCount = joinedParticipantCount + pendingParticipantCount;

  if (limit !== null && participantCount >= limit) {
    return {
      allowed: false,
      code: 'ROOM_FULL',
      participantCount,
      participantLimit: limit
    };
  }

  return {
    allowed: true,
    isRejoin: false,
    participantCount,
    participantLimit: limit
  };
}

module.exports = {
  getParticipantAdmission,
  parsePositiveInteger,
  resolveParticipantLimitForAdmin,
  resolvePersistentParticipantLimit
};
