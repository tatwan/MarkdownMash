const assert = require('node:assert/strict');
const {
  DEFAULT_PAUSE_SECONDS,
  MIN_PAUSE_SECONDS,
  MAX_PAUSE_SECONDS,
  ALL_ANSWERED_BEAT_MS,
  normalizePauseSeconds,
  everyoneAnswered,
  shouldCloseEarly,
  nextAutopilotStep
} = require('./autopilot');

function makeSession(overrides = {}) {
  return {
    participants: {
      a: { id: 'a', answers: {} },
      b: { id: 'b', answers: {} }
    },
    quizState: {
      isRunning: true,
      currentStepIndex: 0,
      showingResults: false,
      autopilot: true,
      autopilotPauseSeconds: DEFAULT_PAUSE_SECONDS,
      autopilotResumeAt: null
    },
    ...overrides
  };
}

// --- normalizePauseSeconds ---

assert.equal(normalizePauseSeconds(12), 12, 'passes a valid value through');
assert.equal(normalizePauseSeconds(1), MIN_PAUSE_SECONDS, 'clamps below the floor');
assert.equal(normalizePauseSeconds(120), MAX_PAUSE_SECONDS, 'clamps above the ceiling');
assert.equal(normalizePauseSeconds(7.6), 8, 'rounds fractional input');
assert.equal(normalizePauseSeconds('10'), 10, 'accepts a numeric string from the client');
assert.equal(normalizePauseSeconds(undefined), DEFAULT_PAUSE_SECONDS, 'defaults on undefined');
assert.equal(normalizePauseSeconds(null), DEFAULT_PAUSE_SECONDS, 'defaults on null');
assert.equal(normalizePauseSeconds('abc'), DEFAULT_PAUSE_SECONDS, 'defaults on junk');
assert.equal(normalizePauseSeconds(NaN), DEFAULT_PAUSE_SECONDS, 'defaults on NaN');
assert.equal(normalizePauseSeconds(Infinity), DEFAULT_PAUSE_SECONDS, 'defaults on Infinity');
assert.equal(normalizePauseSeconds(0), MIN_PAUSE_SECONDS, 'clamps zero to the floor rather than defaulting');
assert.equal(normalizePauseSeconds(-5), MIN_PAUSE_SECONDS, 'clamps a negative to the floor rather than defaulting');

// --- everyoneAnswered ---

const empty = makeSession({ participants: {} });
assert.equal(everyoneAnswered(empty, 1), false, 'an empty room never counts as everyone answered');

const partial = makeSession();
partial.participants.a.answers[1] = 0;
assert.equal(everyoneAnswered(partial, 1), false, 'one of two answered is not everyone');

const ghost = makeSession();
ghost.participants.a.answers[1] = 0;
ghost.participants.b.answers[2] = 1; // answered a different question
assert.equal(everyoneAnswered(ghost, 1), false, 'answers to other questions do not count');

const complete = makeSession();
complete.participants.a.answers[1] = 0;
complete.participants.b.answers[1] = 2;
assert.equal(everyoneAnswered(complete, 1), true, 'all participants answered this question');

const zeroIndex = makeSession();
zeroIndex.participants.a.answers[1] = 0;
zeroIndex.participants.b.answers[1] = 0; // answer index 0 is falsy but valid
assert.equal(everyoneAnswered(zeroIndex, 1), true, 'answer index 0 counts as answered');

// --- shouldCloseEarly ---

const ready = makeSession();
ready.participants.a.answers[1] = 0;
ready.participants.b.answers[1] = 1;
assert.equal(shouldCloseEarly(ready, 1), true, 'closes early when all answered and autopilot on');

const autopilotOff = makeSession();
autopilotOff.quizState.autopilot = false;
autopilotOff.participants.a.answers[1] = 0;
autopilotOff.participants.b.answers[1] = 1;
assert.equal(shouldCloseEarly(autopilotOff, 1), false, 'never closes early with autopilot off');

const alreadyShowing = makeSession();
alreadyShowing.quizState.showingResults = true;
alreadyShowing.participants.a.answers[1] = 0;
alreadyShowing.participants.b.answers[1] = 1;
assert.equal(shouldCloseEarly(alreadyShowing, 1), false, 'does not close a question twice');

// --- nextAutopilotStep ---

assert.equal(nextAutopilotStep(autopilotOff), null, 'no step when autopilot is off');

const notRunning = makeSession();
notRunning.quizState.isRunning = false;
assert.equal(nextAutopilotStep(notRunning), null, 'no step when the quiz is not running');

const justStarted = makeSession();
justStarted.quizState.currentStepIndex = -1;
assert.deepEqual(
  nextAutopilotStep(justStarted),
  { action: 'advance', delayMs: DEFAULT_PAUSE_SECONDS * 1000 },
  'advances into the first question after Start'
);

const showingResults = makeSession();
showingResults.quizState.showingResults = true;
assert.deepEqual(
  nextAutopilotStep(showingResults),
  { action: 'advance', delayMs: DEFAULT_PAUSE_SECONDS * 1000 },
  'advances to the next question after the results pause'
);

const customPause = makeSession();
customPause.quizState.showingResults = true;
customPause.quizState.autopilotPauseSeconds = 15;
assert.deepEqual(
  nextAutopilotStep(customPause),
  { action: 'advance', delayMs: 15000 },
  'honours a custom pause'
);

const junkPause = makeSession();
junkPause.quizState.showingResults = true;
junkPause.quizState.autopilotPauseSeconds = 999;
assert.deepEqual(
  nextAutopilotStep(junkPause),
  { action: 'advance', delayMs: MAX_PAUSE_SECONDS * 1000 },
  'clamps a stored out-of-range pause'
);

const allIn = makeSession();
allIn.participants.a.answers[1] = 0;
allIn.participants.b.answers[1] = 1;
assert.deepEqual(
  nextAutopilotStep(allIn, 1),
  { action: 'close', delayMs: ALL_ANSWERED_BEAT_MS },
  'schedules an early close once everyone has answered'
);

const stillWaiting = makeSession();
stillWaiting.participants.a.answers[1] = 0;
assert.equal(
  nextAutopilotStep(stillWaiting, 1),
  null,
  'no step while the room is still answering'
);

assert.equal(
  nextAutopilotStep(makeSession()),
  null,
  'no step mid-question when no questionId is supplied'
);

// --- section steps ---

const { SECTION_HOLD_MS } = require('./autopilot');

assert.equal(SECTION_HOLD_MS, 5000, 'section hold is a fixed five seconds');

const onSection = makeSession();
onSection.quizState.showingResults = false;
assert.deepEqual(
  nextAutopilotStep(onSection, undefined, { onSection: true }),
  { action: 'advance', delayMs: SECTION_HOLD_MS },
  'a section step advances after the fixed hold'
);

const sectionOff = makeSession();
sectionOff.quizState.autopilot = false;
assert.equal(
  nextAutopilotStep(sectionOff, undefined, { onSection: true }),
  null,
  'a section step does not auto-advance when autopilot is off'
);

const sectionNoClose = makeSession();
sectionNoClose.participants.a.answers[1] = 0;
sectionNoClose.participants.b.answers[1] = 0;
assert.deepEqual(
  nextAutopilotStep(sectionNoClose, 1, { onSection: true }),
  { action: 'advance', delayMs: SECTION_HOLD_MS },
  'a section step never triggers an early close, even with a stale questionId'
);

console.log('All autopilot tests passed.');
