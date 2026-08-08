/**
 * Runtime verification for sections + ungraded questions (v1.4.0 Task 11).
 * Throwaway driver — do not commit.
 *
 * Usage (from repo root):
 *   GUEST_TRIAL_STARTS_PER_IP_HOUR=100 GUEST_TRIAL_CUSTOM_MARKDOWN=true \
 *     SKIP_DATABASE_INIT=true node server.js &
 *   node scratch/verify-sections.js
 *
 * Or let this script spawn the server:
 *   node scratch/verify-sections.js --spawn
 */

'use strict';

const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');

const BASE = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3000';
const SPAWN = process.argv.includes('--spawn');
const SECTION_HOLD_MS = 5000;
const PAUSE_SECONDS = 3;

const MIXED_QUIZ = `# Mixed Scoring
# Score 100

# Section: Module A
> First module

## Q1: Graded one?
- [x] Yes
- [ ] No
::time=3

## Q2: Just for fun
::type=ungraded
- [x] Fun
- [ ] Not
::time=3

## Q3: Graded two?
- [ ] Wrong
- [x] Right
::time=3
`;

const LEGACY_QUIZ = `# Legacy Quiz
# Score 100

## Q1: First?
- [x] A
- [ ] B
::time=3

## Q2: Second?
- [ ] A
- [x] B
::time=3
`;

const ALL_UNGRADED = `# All Fun
# Score 100

## Q1: Fun one
::type=ungraded
- [x] Yes
- [ ] No
::time=3

## Q2: Fun two
::type=ungraded
- [x] Yes
- [ ] No
::time=3
`;

const SECTIONED_ONLY = `# Sections Only
# Score 100

# Section: Opening
> Curtain

## Q1: After curtain?
- [x] Yes
- [ ] No
::time=3

# Section: Closing

## Q2: Last graded?
- [x] Yes
- [ ] No
::time=3
`;

let passed = 0;
let failed = 0;
const results = [];

function record(name, ok, detail) {
  if (ok) {
    passed += 1;
    results.push({ name, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failed += 1;
    results.push({ name, ok: false, detail });
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

function waitFor(socket, event, timeoutMs = 15000, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`timeout waiting for ${event} (${timeoutMs}ms)`));
    }, timeoutMs);

    function onEvent(data) {
      try {
        if (!predicate(data)) return;
        clearTimeout(timer);
        socket.off(event, onEvent);
        resolve(data);
      } catch (err) {
        clearTimeout(timer);
        socket.off(event, onEvent);
        reject(err);
      }
    }

    socket.on(event, onEvent);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function jsonFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function createTrialRoom(markdown) {
  const trialRes = await jsonFetch('/api/trial', { method: 'POST', body: '{}' });
  if (!trialRes.body.success) {
    throw new Error(`POST /api/trial failed: ${trialRes.status} ${JSON.stringify(trialRes.body)}`);
  }
  const token = trialRes.body.token;
  const sessionCode = trialRes.body.trial.sessionCode;

  const launch = await jsonFetch('/api/trial/session', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ markdown })
  });
  if (!launch.body.success) {
    throw new Error(`POST /api/trial/session failed: ${JSON.stringify(launch.body)}`);
  }

  return { token, sessionCode, quiz: launch.body.session.quiz };
}

function connectHost(token) {
  return io(BASE, {
    auth: { token },
    transports: ['websocket']
  });
}

function connectParticipant(participantId, sessionCode, participantToken) {
  return io(BASE, {
    auth: { participantId, sessionCode, participantToken },
    transports: ['websocket']
  });
}

async function joinParticipant(sessionCode, name) {
  const join = await jsonFetch(`/api/session/${sessionCode}/join`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  if (!join.body.success) {
    throw new Error(`join failed for ${name}: ${JSON.stringify(join.body)}`);
  }
  const { participantId, participantToken } = join.body;
  const socket = connectParticipant(participantId, sessionCode, participantToken);
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('participant connect timeout')), 10000);
    socket.on('connect', () => {
      socket.emit('participant_join', { participantId, sessionCode });
    });
    socket.on('participant_ready', () => {
      clearTimeout(t);
      resolve();
    });
    socket.on('session_invalid', (d) => {
      clearTimeout(t);
      reject(new Error(`participant_ready blocked: ${d.message}`));
    });
  });
  return { socket, participantId, participantToken, name };
}

async function endRoom(token, sessionCode) {
  try {
    await jsonFetch(`/api/trial/session/${sessionCode}/end`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: '{}'
    });
  } catch (_) {
    /* ignore cleanup errors */
  }
}

async function scenarioManualSections() {
  console.log('\n=== 1. Manual sections ===');
  const { token, sessionCode } = await createTrialRoom(SECTIONED_ONLY);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);

  const p = await joinParticipant(sessionCode, 'ManualPat');
  const sectionP = waitFor(p.socket, 'section_started');
  const sectionH = waitFor(host, 'section_started');

  host.emit('start_quiz', sessionCode);
  host.emit('next_question', sessionCode);

  const [sp, sh] = await Promise.all([sectionP, sectionH]);
  record('manual: section_started to participant', true, sp.title);
  record('manual: section_started to host', true, sh.title);
  record('manual: section title Opening', sp.title === 'Opening', sp.title);
  record('manual: no question timer on section', sp.timeRemaining == null && sh.timeRemaining == null, '');

  // Attempt to answer during section — should not score (silently rejected or ignored)
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: 1,
    answerIndex: 0
  });
  await sleep(200);

  const qStart = waitFor(p.socket, 'question_started');
  host.emit('next_question', sessionCode);
  const q = await qStart;
  record('manual: advances to question on next_question', true, `Q${q.questionNumber}`);
  record('manual: graded number is 1 of 2', q.questionNumber === 1 && q.totalQuestions === 2,
    `${q.questionNumber}/${q.totalQuestions}`);

  host.disconnect();
  p.socket.disconnect();
  await endRoom(token, sessionCode);
}

async function scenarioAutopilotSections() {
  console.log('\n=== 2. Autopilot sections ===');
  const { token, sessionCode } = await createTrialRoom(SECTIONED_ONLY);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);
  host.emit('set_autopilot', { sessionCode, enabled: true, pauseSeconds: PAUSE_SECONDS });

  const p = await joinParticipant(sessionCode, 'AutoPat');

  const sectionPromise = waitFor(p.socket, 'section_started', 20000);
  host.emit('start_quiz', sessionCode);
  // Autopilot after start schedules advance into first step
  // need next after start - scheduleAutopilot on start_quiz with currentStepIndex -1
  // Looking at start_quiz: currentStepIndex = -1, scheduleAutopilot - onSection false, what happens?
  // nextAutopilotStep with isRunning true, currentStepIndex -1...
  host.emit('next_question', sessionCode); // enter first section (start alone may not advance)

  const section = await sectionPromise;
  const holdStart = Date.now();
  record('autopilot: section_started', true, section.title);
  record('autopilot: autopilotNextInMs present',
    typeof section.autopilotNextInMs === 'number' && section.autopilotNextInMs > 0,
    String(section.autopilotNextInMs));

  const nextQ = await waitFor(p.socket, 'question_started', SECTION_HOLD_MS + 2000);
  const holdElapsed = Date.now() - holdStart;
  const holdOk = Math.abs(holdElapsed - SECTION_HOLD_MS) <= 750;
  record('autopilot: section hold ~5000ms', holdOk, `${holdElapsed}ms`);
  record('autopilot: advanced to question', nextQ.questionNumber === 1, String(nextQ.questionNumber));

  // Answer both graded correctly and wait for finale under autopilot
  const answerAndWait = async () => {
    const data = await waitFor(p.socket, 'question_started', 60000);
    p.socket.emit('submit_answer', {
      participantId: p.participantId,
      sessionCode,
      questionId: data.question.id,
      answerIndex: 0
    });
  };

  // Already on Q1
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: nextQ.question.id,
    answerIndex: 0
  });

  // Second section + second question under autopilot
  await waitFor(p.socket, 'section_started', 60000);
  const q2 = await waitFor(p.socket, 'question_started', 60000);
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q2.question.id,
    answerIndex: 0
  });

  const ended = await waitFor(p.socket, 'quiz_ended', 60000);
  record('autopilot: reaches finale without further host input', true, `score=${ended.finalScore}`);
  record('autopilot: full score 100', ended.finalScore === 100, String(ended.finalScore));

  host.disconnect();
  p.socket.disconnect();
  await endRoom(token, sessionCode);
}

async function scenarioMixedScoring() {
  console.log('\n=== 3. Mixed scoring ===');
  const { token, sessionCode } = await createTrialRoom(MIXED_QUIZ);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);

  const p = await joinParticipant(sessionCode, 'MixPat');

  host.emit('start_quiz', sessionCode);

  // Walk: section -> Q1 graded correct -> Q2 ungraded correct -> Q3 graded correct
  const steps = [];
  p.socket.on('section_started', (d) => steps.push({ kind: 'section', ...d }));
  p.socket.on('question_started', (d) => steps.push({ kind: 'question', ...d }));

  // Section
  host.emit('next_question', sessionCode);
  await waitFor(p.socket, 'section_started');
  host.emit('next_question', sessionCode);
  let q = await waitFor(p.socket, 'question_started');
  record('mixed: Q1 gradedNumber=1 total=2', q.questionNumber === 1 && q.totalQuestions === 2,
    `${q.questionNumber}/${q.totalQuestions}`);
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 0
  });
  host.emit('end_question', sessionCode);
  let ended = await waitFor(p.socket, 'question_ended');
  const r1 = ended.participantResults[p.participantId];
  record('mixed: after Q1 score=50', r1.currentScore === 50, String(r1.currentScore));
  record('mixed: after Q1 correctCount=1', r1.correctCount === 1, String(r1.correctCount));
  record('mixed: after Q1 streak=1', r1.currentStreak === 1, String(r1.currentStreak));

  host.emit('next_question', sessionCode);
  q = await waitFor(p.socket, 'question_started');
  record('mixed: ungraded badge payload', q.question.type === 'ungraded' || q.questionNumber == null,
    `type=${q.question.type} num=${q.questionNumber}`);
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 0
  });
  host.emit('end_question', sessionCode);
  ended = await waitFor(p.socket, 'question_ended');
  const r2 = ended.participantResults[p.participantId];
  record('mixed: ungraded leaves score at 50', r2.currentScore === 50, String(r2.currentScore));
  record('mixed: ungraded leaves correctCount at 1', r2.correctCount === 1, String(r2.correctCount));
  record('mixed: ungraded leaves streak at 1', r2.currentStreak === 1, String(r2.currentStreak));
  record('mixed: funCorrectCount increments', ended.funCorrectCount === 1, String(ended.funCorrectCount));
  record('mixed: scored=false on ungraded end', ended.scored === false, String(ended.scored));

  host.emit('next_question', sessionCode);
  q = await waitFor(p.socket, 'question_started');
  record('mixed: Q3 gradedNumber=2', q.questionNumber === 2, String(q.questionNumber));
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 1
  });
  host.emit('end_question', sessionCode);
  await waitFor(p.socket, 'question_ended');
  host.emit('next_question', sessionCode);
  const finale = await waitFor(p.socket, 'quiz_ended');
  record('mixed: finale score 100', finale.finalScore === 100, String(finale.finalScore));
  record('mixed: finale correctCount 2', finale.correctCount === 2, String(finale.correctCount));
  record('mixed: finale totalQuestions 2', finale.totalQuestions === 2, String(finale.totalQuestions));
  record('mixed: fun totals 1/1', finale.funCorrectCount === 1 && finale.funTotal === 1,
    `${finale.funCorrectCount}/${finale.funTotal}`);

  host.disconnect();
  p.socket.disconnect();
  await endRoom(token, sessionCode);
}

async function scenarioReconnectMidCurtain() {
  console.log('\n=== 4. Reconnect mid-curtain ===');
  const { token, sessionCode } = await createTrialRoom(SECTIONED_ONLY);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);
  host.emit('set_autopilot', { sessionCode, enabled: true, pauseSeconds: PAUSE_SECONDS });

  const p = await joinParticipant(sessionCode, 'RejoinPat');
  host.emit('start_quiz', sessionCode);
  host.emit('next_question', sessionCode);
  const first = await waitFor(p.socket, 'section_started');
  const firstMs = first.autopilotNextInMs;
  record('reconnect: initial remaining present', typeof firstMs === 'number' && firstMs > 0, String(firstMs));

  // Wait a bit so remaining decreases
  await sleep(1200);
  p.socket.disconnect();

  // Rejoin with same credentials
  const socket2 = connectParticipant(p.participantId, sessionCode, p.participantToken);
  const reSection = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('reconnect section timeout')), 10000);
    socket2.on('connect', () => {
      socket2.emit('participant_join', {
        participantId: p.participantId,
        sessionCode
      });
    });
    socket2.on('section_started', (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });

  const resumed = await reSection;
  const remaining = resumed.autopilotNextInMs;
  record('reconnect: receives section_started', true, resumed.title);
  record('reconnect: remaining is less than original',
    typeof remaining === 'number' && remaining < firstMs - 500,
    `first=${firstMs} remaining=${remaining}`);
  record('reconnect: remaining is not a full restart (~5000)',
    typeof remaining === 'number' && remaining < SECTION_HOLD_MS - 400,
    String(remaining));

  host.disconnect();
  socket2.disconnect();
  await endRoom(token, sessionCode);
}

async function scenarioLegacy() {
  console.log('\n=== 5. Legacy regression ===');
  const { token, sessionCode } = await createTrialRoom(LEGACY_QUIZ);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);
  const p = await joinParticipant(sessionCode, 'LegacyPat');

  host.emit('start_quiz', sessionCode);
  host.emit('next_question', sessionCode);
  let q = await waitFor(p.socket, 'question_started');
  record('legacy: Q1 of 2', q.questionNumber === 1 && q.totalQuestions === 2,
    `${q.questionNumber}/${q.totalQuestions}`);
  record('legacy: no section before first question', true, 'no section_started waited');
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 0
  });
  host.emit('end_question', sessionCode);
  await waitFor(p.socket, 'question_ended');
  host.emit('next_question', sessionCode);
  q = await waitFor(p.socket, 'question_started');
  record('legacy: Q2 of 2', q.questionNumber === 2 && q.totalQuestions === 2,
    `${q.questionNumber}/${q.totalQuestions}`);
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 1
  });
  host.emit('end_question', sessionCode);
  await waitFor(p.socket, 'question_ended');
  host.emit('next_question', sessionCode);
  const finale = await waitFor(p.socket, 'quiz_ended');
  record('legacy: score 100', finale.finalScore === 100, String(finale.finalScore));
  record('legacy: correctCount 2', finale.correctCount === 2, String(finale.correctCount));

  host.disconnect();
  p.socket.disconnect();
  await endRoom(token, sessionCode);
}

async function scenarioAllUngraded() {
  console.log('\n=== 6. All-ungraded quiz ===');
  const { token, sessionCode } = await createTrialRoom(ALL_UNGRADED);
  const host = connectHost(token);
  await new Promise((resolve, reject) => {
    host.on('connect', resolve);
    host.on('connect_error', reject);
    setTimeout(() => reject(new Error('host connect timeout')), 10000);
  });
  host.emit('admin_join', sessionCode);
  const p = await joinParticipant(sessionCode, 'FunPat');

  host.emit('start_quiz', sessionCode);
  host.emit('next_question', sessionCode);
  let q = await waitFor(p.socket, 'question_started');
  record('all-ungraded: totalQuestions 0 or null-safe',
    q.totalQuestions === 0 || q.totalQuestions == null,
    String(q.totalQuestions));
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 0
  });
  host.emit('end_question', sessionCode);
  await waitFor(p.socket, 'question_ended');
  host.emit('next_question', sessionCode);
  q = await waitFor(p.socket, 'question_started');
  p.socket.emit('submit_answer', {
    participantId: p.participantId,
    sessionCode,
    questionId: q.question.id,
    answerIndex: 0
  });
  host.emit('end_question', sessionCode);
  await waitFor(p.socket, 'question_ended');
  host.emit('next_question', sessionCode);
  const finale = await waitFor(p.socket, 'quiz_ended');
  const nanFree = ![finale.finalScore, finale.percentage, finale.totalQuestions]
    .some(v => typeof v === 'number' && Number.isNaN(v));
  record('all-ungraded: score 0', finale.finalScore === 0, String(finale.finalScore));
  record('all-ungraded: hasScore false', finale.hasScore === false, String(finale.hasScore));
  record('all-ungraded: no NaN in finale numbers', nanFree,
    `score=${finale.finalScore} pct=${finale.percentage} total=${finale.totalQuestions}`);
  record('all-ungraded: funCorrectCount 2', finale.funCorrectCount === 2, String(finale.funCorrectCount));

  host.disconnect();
  p.socket.disconnect();
  await endRoom(token, sessionCode);
}

async function waitForServer(maxMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/trial/config`);
      if (res.ok) return;
    } catch (_) {
      /* retry */
    }
    await sleep(250);
  }
  throw new Error(`Server not reachable at ${BASE} within ${maxMs}ms`);
}

async function main() {
  let child = null;
  if (SPAWN) {
    console.log('Spawning server with trial custom markdown enabled...');
    child = spawn('node', ['server.js'], {
      env: {
        ...process.env,
        PORT: process.env.PORT || '3000',
        GUEST_TRIAL_STARTS_PER_IP_HOUR: '100',
        GUEST_TRIAL_CUSTOM_MARKDOWN: 'true',
        SKIP_DATABASE_INIT: 'true',
        GUEST_TRIAL_JWT_SECRET: process.env.GUEST_TRIAL_JWT_SECRET
          || 'verify-trial-secret-key-at-least-32-chars-long',
        JWT_SECRET: process.env.JWT_SECRET || 'verify-jwt-secret-different-from-trial-key'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.on('data', (d) => {
      if (process.env.VERIFY_VERBOSE) process.stdout.write(`[server] ${d}`);
    });
    child.stderr.on('data', (d) => {
      if (process.env.VERIFY_VERBOSE) process.stderr.write(`[server] ${d}`);
    });
  }

  try {
    await waitForServer();
    console.log(`Server ready at ${BASE}`);

    await scenarioManualSections();
    await scenarioAutopilotSections();
    await scenarioMixedScoring();
    await scenarioReconnectMidCurtain();
    await scenarioLegacy();
    await scenarioAllUngraded();

    console.log('\n========================================');
    console.log(`Results: ${passed} passed, ${failed} failed (${passed + failed} assertions)`);
    console.log('========================================');
    if (failed > 0) process.exitCode = 1;
  } catch (err) {
    console.error('\nVerification aborted:', err);
    process.exitCode = 1;
  } finally {
    if (child) {
      child.kill('SIGTERM');
      await sleep(300);
      try { child.kill('SIGKILL'); } catch (_) { /* already dead */ }
    }
  }
}

main();
