const assert = require('assert');
const {
  SIDEKICK_IDS,
  createSidekickState,
  drawSidekick,
  getShuffleAvailability
} = require('./sidekick-assignment');

assert.equal(SIDEKICK_IDS.length, 16);
assert.equal(new Set(SIDEKICK_IDS).size, 16);

const state = createSidekickState({
  ids: ['shades', 'boo', 'zap'],
  randomInt: () => 0
});
const firstCycle = [drawSidekick(state), drawSidekick(state), drawSidekick(state)];
assert.equal(new Set(firstCycle).size, 3, 'A room must use the full deck before duplicates');
assert.ok(firstCycle.includes(drawSidekick(state)), 'The deck may repeat after it is exhausted');

const shuffleState = createSidekickState({
  ids: ['shades', 'boo'],
  randomInt: max => max - 1
});
const initialAvatar = drawSidekick(shuffleState);
const replacementAvatar = drawSidekick(shuffleState, { excludeId: initialAvatar });
assert.notEqual(replacementAvatar, initialAvatar, 'A shuffle must change the Sidekick');

const participant = { avatarId: 'shades', avatarShuffled: false };
const waitingSession = {
  sidekickState: createSidekickState(),
  quizState: { isRunning: false }
};
assert.deepStrictEqual(getShuffleAvailability(waitingSession, participant), { allowed: true });

participant.avatarShuffled = true;
assert.equal(getShuffleAvailability(waitingSession, participant).code, 'SIDEKICK_SHUFFLE_USED');
participant.avatarShuffled = false;
waitingSession.quizState.isRunning = true;
assert.equal(getShuffleAvailability(waitingSession, participant).code, 'QUIZ_ALREADY_STARTED');

console.log('Sidekick assignment tests passed');
