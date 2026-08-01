const assert = require('assert');
const net = require('net');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');
const {
  createOpaqueToken,
  escapeCSV,
  hashOpaqueToken,
  verifyOpaqueToken
} = require('./security-utils');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function waitForSocket(socket, event, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = data => {
      clearTimeout(timeout);
      resolve(data);
    };
    socket.once(event, handler);
  });
}

function connectSocket(baseUrl, auth = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth,
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function jsonFetch(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  assert.ok(response.ok, `${path} failed with ${response.status}: ${data.error}`);
  return data;
}

async function waitForServer(baseUrl, child, output) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`Security test server exited early:\n${output.join('')}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/trial/config`);
      if (response.ok) return;
    } catch (error) {
      // The child process is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Security test server did not start:\n${output.join('')}`);
}

async function run() {
  const opaqueToken = createOpaqueToken();
  const digest = hashOpaqueToken(opaqueToken);
  assert.equal(verifyOpaqueToken(opaqueToken, digest), true);
  assert.equal(verifyOpaqueToken(`${opaqueToken}x`, digest), false);
  assert.equal(escapeCSV('=2+2'), "'=2+2");
  assert.equal(escapeCSV('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  assert.equal(escapeCSV('safe, value'), '"safe, value"');

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const sockets = [];
  const child = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      ADMIN_PASSWORD: 'test-admin-password',
      DATABASE_URL: 'postgresql://localhost/markdown_mash_security_test',
      GUEST_TRIAL_ENABLED: 'true',
      GUEST_TRIAL_JWT_SECRET: 'b'.repeat(64),
      JWT_SECRET: 'a'.repeat(64),
      NODE_ENV: 'production',
      PORT: String(port),
      SKIP_DATABASE_INIT: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', chunk => output.push(chunk.toString()));
  child.stderr.on('data', chunk => output.push(chunk.toString()));

  let trialToken;
  let sessionCode;
  try {
    await waitForServer(baseUrl, child, output);

    const landing = await fetch(`${baseUrl}/`);
    assert.equal(landing.headers.has('x-powered-by'), false);
    assert.match(landing.headers.get('content-security-policy') || '', /script-src 'self'/);
    assert.match(landing.headers.get('strict-transport-security') || '', /max-age=31536000/);
    assert.match(landing.headers.get('permissions-policy') || '', /camera=\(\)/);
    for (const page of ['admin.html', 'play.html', 'present.html']) {
      const html = await (await fetch(`${baseUrl}/${page}`)).text();
      assert.doesNotMatch(html, /https:\/\/(?:cdn\.jsdelivr|cdnjs\.cloudflare)/);
      assert.match(html, /\/vendor\/dompurify\.js/);
      assert.match(html, /\/js\/markdown\.js/);
    }

    const trial = await jsonFetch(baseUrl, '/api/trial', { method: 'POST' });
    trialToken = trial.token;
    const launched = await jsonFetch(baseUrl, '/api/trial/session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${trialToken}` }
    });
    sessionCode = launched.session.code;
    const presenterUrl = new URL(launched.session.presenterUrl);
    const presenterParams = new URLSearchParams(presenterUrl.hash.slice(1));
    const presenterToken = presenterParams.get('token');
    assert.equal(presenterParams.get('session'), sessionCode);
    assert.ok(presenterToken);

    const joinHeaders = { 'Content-Type': 'application/json' };
    const participantA = await jsonFetch(baseUrl, `/api/session/${sessionCode}/join`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({ name: 'Security Alpha' })
    });
    const participantB = await jsonFetch(baseUrl, `/api/session/${sessionCode}/join`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({ name: 'Security Beta' })
    });
    assert.ok(participantA.participantToken);
    assert.notEqual(participantA.participantToken, participantB.participantToken);
    assert.ok(participantA.avatarId);
    assert.ok(participantB.avatarId);
    assert.notEqual(participantA.avatarId, participantB.avatarId);
    assert.equal(participantA.canShuffleAvatar, true);

    const shuffledA = await jsonFetch(baseUrl, `/api/session/${sessionCode}/sidekick/shuffle`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({
        participantId: participantA.participantId,
        participantToken: participantA.participantToken
      })
    });
    assert.notEqual(shuffledA.avatarId, participantA.avatarId);
    assert.equal(shuffledA.canShuffleAvatar, false);

    const repeatedShuffle = await fetch(`${baseUrl}/api/session/${sessionCode}/sidekick/shuffle`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({
        participantId: participantA.participantId,
        participantToken: participantA.participantToken
      })
    });
    assert.equal(repeatedShuffle.status, 409);
    assert.equal((await repeatedShuffle.json()).code, 'SIDEKICK_SHUFFLE_USED');

    const rejoinedA = await jsonFetch(baseUrl, `/api/session/${sessionCode}/join`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({
        name: 'Security Alpha',
        existingParticipantId: participantA.participantId,
        existingParticipantToken: participantA.participantToken
      })
    });
    assert.equal(rejoinedA.avatarId, shuffledA.avatarId);
    assert.equal(rejoinedA.canShuffleAvatar, false);

    const forgedShuffle = await fetch(`${baseUrl}/api/session/${sessionCode}/sidekick/shuffle`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({
        participantId: participantA.participantId,
        participantToken: participantB.participantToken
      })
    });
    assert.equal(forgedShuffle.status, 403);

    const [admin, presenter, unauthorizedPresenter, playerA, playerB, impersonator] =
      await Promise.all([
        connectSocket(baseUrl, { token: trialToken }),
        connectSocket(baseUrl, { token: presenterToken }),
        connectSocket(baseUrl),
        connectSocket(baseUrl, {
          participantId: participantA.participantId,
          participantToken: participantA.participantToken,
          sessionCode
        }),
        connectSocket(baseUrl, {
          participantId: participantB.participantId,
          participantToken: participantB.participantToken,
          sessionCode
        }),
        connectSocket(baseUrl, {
          participantId: participantA.participantId,
          participantToken: participantB.participantToken,
          sessionCode
        })
      ]);
    sockets.push(admin, presenter, unauthorizedPresenter, playerA, playerB, impersonator);

    const adminReady = waitForSocket(admin, 'quiz_loaded');
    admin.emit('admin_join', sessionCode);
    await adminReady;

    const presenterReady = waitForSocket(presenter, 'quiz_loaded');
    presenter.emit('presenter_join', sessionCode);
    await presenterReady;

    const unauthorized = waitForSocket(unauthorizedPresenter, 'presenter_unauthorized');
    unauthorizedPresenter.emit('presenter_join', sessionCode);
    assert.match((await unauthorized).message, /instructor studio/i);

    const readyA = waitForSocket(playerA, 'participant_ready');
    const readyB = waitForSocket(playerB, 'participant_ready');
    playerA.emit('participant_join', {
      participantId: participantA.participantId,
      sessionCode
    });
    playerB.emit('participant_join', {
      participantId: participantB.participantId,
      sessionCode
    });
    const [readyPayloadA, readyPayloadB] = await Promise.all([readyA, readyB]);
    assert.equal(readyPayloadA.avatarId, shuffledA.avatarId);
    assert.equal(readyPayloadA.canShuffleAvatar, false);
    assert.equal(readyPayloadB.avatarId, participantB.avatarId);
    assert.equal(readyPayloadB.canShuffleAvatar, true);

    const impersonationRejected = waitForSocket(impersonator, 'session_invalid');
    impersonator.emit('participant_join', {
      participantId: participantA.participantId,
      sessionCode
    });
    assert.match((await impersonationRejected).message, /access expired/i);

    const quizStarted = waitForSocket(admin, 'quiz_started');
    admin.emit('start_quiz', sessionCode);
    await quizStarted;

    const lateShuffle = await fetch(`${baseUrl}/api/session/${sessionCode}/sidekick/shuffle`, {
      method: 'POST',
      headers: joinHeaders,
      body: JSON.stringify({
        participantId: participantB.participantId,
        participantToken: participantB.participantToken
      })
    });
    assert.equal(lateShuffle.status, 409);
    assert.equal((await lateShuffle.json()).code, 'QUIZ_ALREADY_STARTED');

    const presenterControlRejected = waitForSocket(presenter, 'control_error');
    presenter.emit('next_question', sessionCode);
    assert.match((await presenterControlRejected).message, /permission/i);

    const presenterQuestion = waitForSocket(presenter, 'question_started');
    const playerQuestion = waitForSocket(playerA, 'question_started');
    admin.emit('next_question', sessionCode);
    const [presenterPayload, participantPayload] = await Promise.all([
      presenterQuestion,
      playerQuestion
    ]);
    assert.equal('correctIndices' in presenterPayload.question, false);
    assert.equal('correctIndices' in participantPayload.question, false);

    const invalidAnswerRejected = waitForSocket(playerA, 'answer_rejected');
    playerA.emit('submit_answer', {
      participantId: participantA.participantId,
      sessionCode,
      questionId: participantPayload.question.id,
      answerIndex: -1
    });
    assert.match((await invalidAnswerRejected).message, /invalid answer/i);

    const answerA = waitForSocket(playerA, 'answer_confirmed');
    const answerB = waitForSocket(playerB, 'answer_confirmed');
    playerA.emit('submit_answer', {
      participantId: participantA.participantId,
      sessionCode,
      questionId: participantPayload.question.id,
      answerIndex: 2
    });
    playerB.emit('submit_answer', {
      participantId: participantB.participantId,
      sessionCode,
      questionId: participantPayload.question.id,
      answerIndex: 1
    });
    await Promise.all([answerA, answerB]);

    const resultsA = waitForSocket(playerA, 'question_ended');
    const resultsB = waitForSocket(playerB, 'question_ended');
    admin.emit('end_question', sessionCode);
    const [payloadA, payloadB] = await Promise.all([resultsA, resultsB]);
    assert.deepStrictEqual(
      Object.keys(payloadA.participantResults),
      [participantA.participantId]
    );
    assert.deepStrictEqual(
      Object.keys(payloadB.participantResults),
      [participantB.participantId]
    );
  } finally {
    if (trialToken && sessionCode) {
      await fetch(`${baseUrl}/api/trial/session/${sessionCode}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${trialToken}` }
      }).catch(() => {});
    }
    sockets.forEach(socket => socket.close());
    child.kill('SIGTERM');
  }

  console.log('Security regression tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
