const crypto = require('crypto');

function createPersistentSessionRepository(db, sessionId, sessionCode) {
  return {
    kind: 'persistent',
    createParticipant(name, socketId = null) {
      return db.createParticipant(sessionId, name, socketId);
    },
    updateStatus(status) {
      return db.updateSessionStatus(sessionCode, status);
    },
    updateParticipantSocket(participantId, socketId) {
      return db.updateParticipantSocket(participantId, socketId);
    },
    isParticipantKicked(participantId) {
      return db.isParticipantKicked(participantId);
    },
    kickParticipant(participantId) {
      return db.kickParticipant(participantId);
    },
    recordAnswer(participantId, questionIndex, answerIndex, isCorrect, responseTimeMs) {
      return db.recordAnswer(
        sessionId,
        participantId,
        questionIndex,
        answerIndex,
        isCorrect,
        responseTimeMs
      );
    },
    updateParticipantScore(participantId, score, correctCount) {
      return db.updateParticipantScore(participantId, score, correctCount);
    },
    deleteSession() {
      return db.deleteSession(sessionCode);
    }
  };
}

function createTransientSessionRepository(options = {}) {
  const kickedParticipants = new Set();
  const idFactory = options.idFactory
    || (() => crypto.randomBytes(9).toString('base64url'));

  return {
    kind: 'transient',
    async createParticipant(name) {
      return {
        id: idFactory(),
        name
      };
    },
    async updateStatus() {},
    async updateParticipantSocket() {},
    async isParticipantKicked(participantId) {
      return kickedParticipants.has(participantId);
    },
    async kickParticipant(participantId) {
      kickedParticipants.add(participantId);
    },
    async recordAnswer() {},
    async updateParticipantScore() {},
    async deleteSession() {}
  };
}

module.exports = {
  createPersistentSessionRepository,
  createTransientSessionRepository
};
