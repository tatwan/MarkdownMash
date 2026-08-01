const crypto = require('crypto');
const manifest = require('./assets/sidekicks/manifest.json');

const SIDEKICK_IDS = Object.freeze(manifest.sidekicks.map(sidekick => sidekick.id));

function shuffledCopy(ids, randomInt = crypto.randomInt) {
  const deck = [...ids];
  for (let index = deck.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

function createSidekickState({ enabled = true, ids = SIDEKICK_IDS, randomInt } = {}) {
  return {
    enabled,
    deck: shuffledCopy(ids, randomInt),
    cursor: 0
  };
}

function drawSidekick(state, { excludeId = null } = {}) {
  if (!state?.enabled || !Array.isArray(state.deck) || state.deck.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < state.deck.length; attempt++) {
    const sidekickId = state.deck[state.cursor % state.deck.length];
    state.cursor += 1;
    if (sidekickId !== excludeId || state.deck.length === 1) {
      return sidekickId;
    }
  }

  return null;
}

function getShuffleAvailability(session, participant) {
  if (!session?.sidekickState?.enabled || !participant?.avatarId) {
    return { allowed: false, code: 'SIDEKICKS_DISABLED' };
  }
  if (session.quizState?.isRunning) {
    return { allowed: false, code: 'QUIZ_ALREADY_STARTED' };
  }
  if (participant.avatarShuffled) {
    return { allowed: false, code: 'SIDEKICK_SHUFFLE_USED' };
  }
  return { allowed: true };
}

module.exports = {
  SIDEKICK_IDS,
  createSidekickState,
  drawSidekick,
  getShuffleAvailability,
  shuffledCopy
};
