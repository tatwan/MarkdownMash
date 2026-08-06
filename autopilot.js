// Pure decision logic for hands-free quiz flow.
// No timers, no sockets, no database — server.js owns all of that.

const DEFAULT_PAUSE_SECONDS = 8;
const MIN_PAUSE_SECONDS = 3;
const MAX_PAUSE_SECONDS = 30;
const ALL_ANSWERED_BEAT_MS = 2000;

// Clamps host-supplied pause values and rejects anything non-numeric.
function normalizePauseSeconds(value) {
  if (value === undefined || value === null) return DEFAULT_PAUSE_SECONDS;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_PAUSE_SECONDS;

  const rounded = Math.round(parsed);
  if (rounded < MIN_PAUSE_SECONDS) return MIN_PAUSE_SECONDS;
  if (rounded > MAX_PAUSE_SECONDS) return MAX_PAUSE_SECONDS;
  return rounded;
}

// An empty room never counts: with nobody present there is nothing to wait for,
// and returning true would close every question instantly.
function everyoneAnswered(session, questionId) {
  const participants = Object.values(session?.participants || {});
  if (participants.length === 0) return false;
  return participants.every(p => p?.answers?.[questionId] !== undefined);
}

function isEngaged(session) {
  return session?.quizState?.autopilot === true && session.quizState.isRunning === true;
}

function shouldCloseEarly(session, questionId) {
  if (!isEngaged(session)) return false;
  if (session.quizState.showingResults) return false;
  return everyoneAnswered(session, questionId);
}

function pauseMs(session) {
  return normalizePauseSeconds(session?.quizState?.autopilotPauseSeconds) * 1000;
}

// Returns the single action autopilot should schedule from the current state,
// or null when it should stay out of the way.
function nextAutopilotStep(session, questionId) {
  if (!isEngaged(session)) return null;

  // Sitting on results, or freshly started before the first question: advance.
  if (session.quizState.showingResults || session.quizState.currentQuestionIndex < 0) {
    return { action: 'advance', delayMs: pauseMs(session) };
  }

  // Mid-question: close early only once the whole room is in.
  if (questionId !== undefined && shouldCloseEarly(session, questionId)) {
    return { action: 'close', delayMs: ALL_ANSWERED_BEAT_MS };
  }

  return null;
}

module.exports = {
  DEFAULT_PAUSE_SECONDS,
  MIN_PAUSE_SECONDS,
  MAX_PAUSE_SECONDS,
  ALL_ANSWERED_BEAT_MS,
  normalizePauseSeconds,
  everyoneAnswered,
  shouldCloseEarly,
  nextAutopilotStep
};
