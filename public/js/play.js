// DOM Elements
const markdown = MarkdownMashMarkdown;
const joinSection = document.getElementById('join-section');
const joinForm = document.getElementById('join-form');
const joinError = document.getElementById('join-error');
const playerNameInput = document.getElementById('player-name');
const sessionCodeInput = document.getElementById('session-code');
const rejoinPanel = document.getElementById('rejoin-panel');
const rejoinOptions = document.getElementById('rejoin-options');
const joinDifferentBtn = document.getElementById('join-different-btn');

const sessionEndedSection = document.getElementById('session-ended-section');
const sessionEndedMessage = document.getElementById('session-ended-message');

const waitingSection = document.getElementById('waiting-section');
const welcomeName = document.getElementById('welcome-name');
const quizTitleDisplay = document.getElementById('quiz-title-display');
const waitingSessionCode = document.getElementById('waiting-session-code');
const waitingSidekickCard = document.getElementById('waiting-sidekick-card');
const waitingSidekickSource = document.getElementById('waiting-sidekick-source');
const waitingSidekick = document.getElementById('waiting-sidekick');
const waitingSidekickName = document.getElementById('waiting-sidekick-name');
const sidekickShuffleBtn = document.getElementById('sidekick-shuffle-btn');
const sidekickShuffleStatus = document.getElementById('sidekick-shuffle-status');

const sectionIntroSection = document.getElementById('section-intro-section');
const sectionIntroTitle = document.getElementById('section-intro-title');
const sectionIntroSubtitle = document.getElementById('section-intro-subtitle');
const sectionIntroCountdown = document.getElementById('section-intro-countdown');

const questionSection = document.getElementById('question-section');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const playerQnum = document.querySelector('.player-qnum');
const playerQbadge = document.getElementById('player-qbadge');
const scoreDisplay = document.getElementById('score-display');
const timer = document.getElementById('timer');
const timerProgress = document.getElementById('timer-progress');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const answerStatus = document.getElementById('answer-status');
const allAnsweredBanner = document.getElementById('all-answered-banner');
const timerRing = document.querySelector('.player-timer-ring');

const resultsSection = document.getElementById('results-section');
const resultIcon = document.getElementById('result-icon');
const resultText = document.getElementById('result-text');
const currentScoreEl = document.getElementById('current-score');
const yourAnswer = document.getElementById('your-answer');
const correctAnswer = document.getElementById('correct-answer');
const resultRank = document.getElementById('result-rank');
const resultStreak = document.getElementById('result-streak');
const resultMovement = document.getElementById('result-movement');
const resultResponseTotal = document.getElementById('result-response-total');
const resultsDistribution = document.getElementById('results-distribution');
const resultSidekick = document.getElementById('result-sidekick');
const resultWaiting = document.getElementById('result-waiting');
const surveyResponseSection = document.getElementById('survey-response-section');
const surveyResponseTitle = document.getElementById('survey-response-title');
const surveyResponseCopy = document.getElementById('survey-response-copy');
const surveyResponseProgress = document.getElementById('survey-response-progress');
const surveyResponseWaiting = document.getElementById('survey-response-waiting');

const endedSection = document.getElementById('ended-section');
const finalIcon = document.getElementById('final-icon');
const finalStatus = document.getElementById('final-status');
const finalScoreValue = document.getElementById('final-score-value');
const finalScoreMax = document.getElementById('final-score-max');
const finalPercentage = document.getElementById('final-percentage');
const finalMessage = document.getElementById('final-message');
const finalRank = document.getElementById('final-rank');
const finalCorrect = document.getElementById('final-correct');
const finalStreak = document.getElementById('final-streak');
const finalSidekick = document.getElementById('final-sidekick');
const surveyCompleteSection = document.getElementById('survey-complete-section');
const surveyCompleteParticipants = document.getElementById('survey-complete-participants');
const surveyCompleteRate = document.getElementById('survey-complete-rate');
const playerScore = document.querySelector('.player-score');
const participantStore = MarkdownMashParticipantStorage.createParticipantStore(
  window.sessionStorage,
  window.localStorage
);

// State
let socket = null;
let participantId = null;
let participantToken = null;
let sessionCode = null;
let currentQuestion = null;
let selectedAnswer = null;
let timerInterval = null;
let timerDuration = 20;
let nextQuestionCountdown = null;
let currentScore = 0;
let avatarId = null;
let canShuffleAvatar = false;
let isFirstConnect = true; // Tracks whether this is the initial connection or a reconnect
let currentSessionMode = 'quiz';
let sectionExitTimer = null;

// Motivating messages
const motivatingMessages = [
  "Keep learning! Every expert was once a beginner.",
  "Progress, not perfection! Review and try again.",
  "Learning takes time. You've got this!",
  "Each question is a chance to grow. Keep going!",
  "Success is built on practice. Don't give up!"
];

// Check for session code in URL on page load
function init() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlSessionCode = urlParams.get('session');
  if (urlSessionCode) {
    const code = urlSessionCode.toUpperCase();
    sessionCodeInput.value = code;
    const activeIdentity = participantStore.getActive(code);
    if (activeIdentity?.name) {
      playerNameInput.value = activeIdentity.name;
    }
    renderRejoinOptions(code);
  }
}

// Join quiz
let isJoining = false;
const joinSubmitBtn = joinForm.querySelector('button[type="submit"]');
const joinSubmitMarkup = joinSubmitBtn.innerHTML;

function normalizeName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function renderRejoinOptions(code) {
  if (!code || code.length !== 6) {
    rejoinPanel.classList.add('hidden');
    return;
  }

  const saved = participantStore.getRecoveries(code);
  const active = participantStore.getActive(code);
  if (active && !saved.some(entry => entry.id === active.id)) {
    saved.unshift(active);
  }

  rejoinOptions.innerHTML = '';
  saved.forEach(identity => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rejoin-option';
    button.innerHTML = `
      <span class="rejoin-avatar">${escapeText(identity.name).charAt(0).toUpperCase()}</span>
      <span><strong>${escapeText(identity.name)}</strong><small>Continue in ${code}</small></span>
      <svg aria-hidden="true"><use href="/assets/icons.svg#chevron-right"></use></svg>
    `;
    button.addEventListener('click', () => {
      sessionCodeInput.value = code;
      playerNameInput.value = identity.name;
      attemptJoin(identity.id, identity.accessToken);
    });
    rejoinOptions.appendChild(button);
  });

  rejoinPanel.classList.toggle('hidden', saved.length === 0);
}

function escapeText(value) {
  const div = document.createElement('div');
  div.textContent = String(value || '');
  return div.innerHTML;
}

function sidekickName(id) {
  if (!id) return '';
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function sidekickAsset(id, size = 256, format = 'webp') {
  return `/assets/sidekicks/${format}/${size}/${encodeURIComponent(id)}.${format}`;
}

function renderPersonalSidekick() {
  if (!avatarId) {
    waitingSidekickCard.classList.add('hidden');
    resultSidekick.classList.add('hidden');
    finalSidekick.classList.add('hidden');
    return;
  }

  waitingSidekickSource.srcset = sidekickAsset(avatarId, 256);
  waitingSidekick.src = `/assets/sidekicks/png/256/${encodeURIComponent(avatarId)}.png`;
  waitingSidekickName.textContent = `You’re ${sidekickName(avatarId)}!`;
  waitingSidekickCard.classList.remove('hidden');
  sidekickShuffleBtn.disabled = !canShuffleAvatar;
  sidekickShuffleBtn.textContent = canShuffleAvatar ? 'Shuffle once' : 'Sidekick locked in';

  [resultSidekick, finalSidekick].forEach(image => {
    image.src = sidekickAsset(avatarId, 256);
    image.classList.remove('hidden');
  });
}

function clearCurrentIdentity({ forgetRecovery = false, clearSession = false } = {}) {
  const code = sessionCode || sessionCodeInput.value.trim().toUpperCase();
  const active = code ? participantStore.getActive(code) : null;
  const id = participantId || active?.id;

  if (code && clearSession) {
    participantStore.clearSessionRecoveries(code);
  } else if (code && id && forgetRecovery) {
    participantStore.removeRecovery(code, id);
  }
  participantStore.clearActive(code || null);
  participantStore.clearLegacyIdentity();
}

async function attemptJoin(
  requestedParticipantId = null,
  requestedParticipantToken = null
) {
  if (isJoining) return;
  const name = playerNameInput.value.trim();
  const code = sessionCodeInput.value.trim().toUpperCase();

  if (!name) return;
  if (!code || code.length !== 6) {
    showError('Please enter a valid 6-character session code');
    return;
  }

  let existingParticipantId = requestedParticipantId;
  let existingParticipantToken = requestedParticipantToken;
  if (!existingParticipantId) {
    const active = participantStore.getActive(code);
    if (active && normalizeName(active.name) === normalizeName(name)) {
      existingParticipantId = active.id;
      existingParticipantToken = active.accessToken;
    }
  }

  isJoining = true;
  joinSubmitBtn.disabled = true;
  joinSubmitBtn.textContent = 'Joining...';

  try {
    const res = await fetch(`/api/session/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        existingParticipantId,
        existingParticipantToken
      })
    });

    const data = await res.json();
    if (data.success) {
      participantId = data.participantId;
      participantToken = data.participantToken;
      sessionCode = data.sessionCode;
      currentSessionMode = data.sessionType === 'survey' ? 'survey' : 'quiz';
      avatarId = data.avatarId || null;
      canShuffleAvatar = Boolean(data.canShuffleAvatar);

      participantStore.setActive(
        sessionCode,
        participantId,
        name,
        participantToken
      );
      participantStore.rememberRecovery(
        sessionCode,
        participantId,
        name,
        participantToken
      );
      participantStore.clearLegacyIdentity();

      hideAllSections();
      waitingSection.classList.remove('hidden');
      welcomeName.textContent = `Welcome, ${name}!`;
      quizTitleDisplay.textContent = data.quizTitle;
      waitingSessionCode.textContent = sessionCode;
      sidekickShuffleStatus.textContent = '';
      renderPersonalSidekick();

      initSocket();
    } else {
      showError(data.error);
      isJoining = false;
      joinSubmitBtn.disabled = false;
      joinSubmitBtn.innerHTML = joinSubmitMarkup;
    }
  } catch (err) {
    showError('Connection error. Please try again.');
    isJoining = false;
    joinSubmitBtn.disabled = false;
    joinSubmitBtn.innerHTML = joinSubmitMarkup;
  }
}

joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  attemptJoin();
});

sidekickShuffleBtn.addEventListener('click', async () => {
  if (!canShuffleAvatar || !avatarId || !participantId || !participantToken || !sessionCode) return;

  canShuffleAvatar = false;
  sidekickShuffleBtn.disabled = true;
  sidekickShuffleBtn.setAttribute('aria-busy', 'true');
  sidekickShuffleStatus.textContent = 'Finding a new Sidekick…';

  try {
    const response = await fetch(`/api/session/${sessionCode}/sidekick/shuffle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, participantToken })
    });
    const data = await response.json();
    if (!response.ok) {
      canShuffleAvatar = response.status >= 500;
      sidekickShuffleStatus.textContent = data.error || 'Unable to shuffle your Sidekick.';
      renderPersonalSidekick();
      return;
    }

    avatarId = data.avatarId;
    canShuffleAvatar = false;
    sidekickShuffleStatus.textContent = `${sidekickName(avatarId)} is ready!`;
    renderPersonalSidekick();
  } catch (error) {
    sidekickShuffleStatus.textContent = 'Connection interrupted. Your current Sidekick is safe.';
  } finally {
    sidekickShuffleBtn.removeAttribute('aria-busy');
  }
});

sessionCodeInput.addEventListener('input', () => {
  const code = sessionCodeInput.value.trim().toUpperCase();
  renderRejoinOptions(code);
});

joinDifferentBtn.addEventListener('click', () => {
  const code = sessionCodeInput.value.trim().toUpperCase();
  participantStore.clearActive(code || null);
  playerNameInput.value = '';
  rejoinPanel.classList.add('hidden');
  playerNameInput.focus();
});

// Initialize Socket.IO
function initSocket() {
  socket = io({
    auth: {
      participantId,
      participantToken,
      sessionCode
    }
  });

  isFirstConnect = true; // Reset on each new initSocket call

  socket.on('connect', () => {
    socket.emit('participant_join', {
      participantId,
      sessionCode
    });
    isFirstConnect = false;
  });

  socket.on('session_invalid', (data) => {
    if (isFirstConnect) {
      // True first connection — session genuinely doesn't exist, clear credentials
      clearCurrentIdentity({ forgetRecovery: true });

      stopSectionCountdown();
      hideAllSections();
      sessionEndedMessage.textContent = data.message || 'This session is no longer available.';
      sessionEndedSection.classList.remove('hidden');
    } else {
      // This is a reconnect after a server restart.
      // Don't wipe credentials — show a retry banner so student can rejoin
      // once the teacher restarts the quiz (or navigate back to join form).
      showReconnectBanner(data.message);
    }
  });

  socket.on('clear_participant_id', () => {
    clearCurrentIdentity({ forgetRecovery: true });
    participantId = null;
    participantToken = null;
    sessionCode = null;
    avatarId = null;
    canShuffleAvatar = false;
  });

  socket.on('participant_ready', data => {
    avatarId = data.avatarId || avatarId;
    canShuffleAvatar = Boolean(data.canShuffleAvatar);
    renderPersonalSidekick();
  });

  socket.on('sidekicks_setting_changed', data => {
    document.body.classList.toggle('sidekicks-disabled', data.enabled === false);
  });

  socket.on('kicked', (data) => {
    // Clear stored credentials
    clearCurrentIdentity({ forgetRecovery: true });
    participantId = null;
    participantToken = null;
    sessionCode = null;
    avatarId = null;
    canShuffleAvatar = false;

    // Show kicked message
    stopSectionCountdown();
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'You have been removed from this session.';
    sessionEndedSection.classList.remove('hidden');

    // Disconnect socket
    if (socket) {
      socket.disconnect();
    }
  });

  socket.on('session_ended', (data) => {
    clearInterval(timerInterval);
    stopSectionCountdown();

    // Show session ended screen
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'This session has ended.';
    sessionEndedSection.classList.remove('hidden');

    // Clear stored credentials
    clearCurrentIdentity({ clearSession: true });
    participantId = null;
    participantToken = null;
    sessionCode = null;
    avatarId = null;
    canShuffleAvatar = false;
  });

  socket.on('trial_expired', (data) => {
    clearInterval(timerInterval);
    stopSectionCountdown();
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'This temporary practice room has expired.';
    sessionEndedSection.classList.remove('hidden');
    clearCurrentIdentity({ clearSession: true });
    participantId = null;
    participantToken = null;
    sessionCode = null;
    avatarId = null;
    canShuffleAvatar = false;
  });

  socket.on('quiz_started', (data) => {
    currentSessionMode = data.mode === 'survey' ? 'survey' : 'quiz';
    quizTitleDisplay.textContent = data.title;
    totalQNum.textContent = data.totalQuestions;
    currentScore = 0;
    scoreDisplay.textContent = '0';
    canShuffleAvatar = false;
    renderPersonalSidekick();
  });

  socket.on('section_started', (data) => {
    hideAllAnsweredBanner();
    stopNextQuestionCountdown();
    stopSectionCountdown();

    sectionIntroTitle.textContent = data.title;
    sectionIntroSubtitle.textContent = data.subtitle || '';
    sectionIntroSubtitle.classList.toggle('hidden', !data.subtitle);
    sectionIntroSection.classList.remove('section-transition-opening');

    startSectionCountdown(data.autopilotNextInMs);

    hideAllSections();
    sectionIntroSection.classList.remove('hidden');
  });

  socket.on('question_started', (data) => {
    const leavingSection = !sectionIntroSection.classList.contains('hidden');
    hideAllAnsweredBanner();
    stopNextQuestionCountdown();
    stopSectionCountdown();

    currentQuestion = data.question;
    selectedAnswer = null;
    timerDuration = data.timeRemaining;

    currentSessionMode = data.mode === 'survey' ? 'survey' : currentSessionMode;
    const isSurvey = currentSessionMode === 'survey';
    const isUngraded = data.question.type === 'ungraded' && !isSurvey;
    playerQnum.classList.toggle('hidden', isUngraded);
    playerQbadge.classList.toggle('hidden', !isUngraded);
    playerScore.classList.toggle('hidden', isSurvey);
    if (!isUngraded) {
      currentQNum.textContent = data.questionNumber;
      totalQNum.textContent = data.totalQuestions;
    }
    questionText.innerHTML = markdown.block(data.question.text);
    answerStatus.classList.add('hidden');

    renderOptions(data.question.options);
    startTimer(data.timeRemaining);

    hideAllSections();
    questionSection.classList.remove('hidden');
    if (leavingSection && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sectionIntroSection.classList.add('section-transition-opening');
      sectionIntroSection.classList.remove('hidden');
      sectionExitTimer = setTimeout(() => {
        sectionIntroSection.classList.add('hidden');
        sectionIntroSection.classList.remove('section-transition-opening');
        sectionExitTimer = null;
      }, 520);
    }
  });

  socket.on('answer_confirmed', () => {
    answerStatus.classList.remove('hidden');
  });

  socket.on('all_answered', () => {
    showAllAnsweredBanner();
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);
    hideAllAnsweredBanner();
    startNextQuestionCountdown(data.autopilotNextInMs);
    if (data.question) {
      currentQuestion = data.question;
    }

    if (data.mode === 'survey') {
      const yourAnswerIdx = data.yourAnswer;
      if (yourAnswerIdx === undefined && !data.responseRecorded) {
        surveyResponseTitle.textContent = 'This question has closed.';
        surveyResponseCopy.textContent = `No response was recorded. ${data.answered || 0} people responded.`;
      } else if (yourAnswerIdx === undefined) {
        surveyResponseTitle.textContent = 'Thanks — your choice is locked in.';
        surveyResponseCopy.textContent = 'Your response was recorded anonymously.';
      } else {
        const opt = currentQuestion?.options?.[yourAnswerIdx];
        surveyResponseTitle.textContent = 'Thanks — your choice is locked in.';
        surveyResponseCopy.textContent = opt
          ? `You selected ${String.fromCharCode(65 + yourAnswerIdx)}. ${opt}`
          : 'Your response was recorded anonymously.';
      }
      const completed = Number(data.questionsAnswered || 0);
      const total = Number(data.totalQuestions || 0);
      surveyResponseProgress.style.width = total > 0 ? `${Math.round((completed * 100) / total)}%` : '0%';
      hideAllSections();
      surveyResponseSection.classList.remove('hidden');
      return;
    }

    // Get my results from participantResults
    const myResults = data.participantResults?.[participantId] || {
      yourAnswer: data.yourAnswer
    };
    const yourAnswerIdx = myResults.yourAnswer;
    const correctIdx = data.correctIndices[0];
    const isCorrect = yourAnswerIdx !== undefined && data.correctIndices.includes(yourAnswerIdx);

    document.querySelector('.result-score-display')?.classList.remove('hidden');
    document.querySelector('.personal-result-grid')?.classList.remove('hidden');

    currentScore = myResults.currentScore || 0;
    scoreDisplay.textContent = currentScore;
    currentScoreEl.textContent = currentScore;

      if (yourAnswerIdx === undefined) {
        resultIcon.className = 'result-icon timeout';
        resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#clock"></use></svg>';
        resultText.textContent = "Time's up!";
        yourAnswer.textContent = 'No answer';
      } else if (isCorrect) {
        resultIcon.className = 'result-icon correct';
        resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#check-circle"></use></svg>';
        resultText.textContent = 'Correct!';
        yourAnswer.innerHTML = `${String.fromCharCode(65 + yourAnswerIdx)}. ${markdown.inline(currentQuestion.options[yourAnswerIdx])}`;
      } else {
        resultIcon.className = 'result-icon incorrect';
        resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#x-circle"></use></svg>';
        resultText.textContent = 'Incorrect';
        yourAnswer.innerHTML = `${String.fromCharCode(65 + yourAnswerIdx)}. ${markdown.inline(currentQuestion.options[yourAnswerIdx])}`;
      }

      resultRank.textContent = myResults.rank ? `#${myResults.rank}` : '—';
      resultStreak.textContent = myResults.currentStreak || 0;
      if (myResults.movement > 0) {
        resultMovement.textContent = `+${myResults.movement}`;
      } else if (myResults.movement < 0) {
        resultMovement.textContent = `${myResults.movement}`;
      } else {
        resultMovement.textContent = myResults.previousRank ? 'Held' : 'New';
      }

    correctAnswer.innerHTML = `${String.fromCharCode(65 + correctIdx)}. ${markdown.inline(currentQuestion.options[correctIdx])}`;
    document.querySelector('.result-detail-row.correct').style.display = isCorrect ? 'none' : 'flex';

    // Show results chart
    showResultsChart(data);

    hideAllSections();
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', (data) => {
    clearInterval(timerInterval);
    stopNextQuestionCountdown();
    stopSectionCountdown();

    if (data.mode === 'survey') {
      surveyCompleteParticipants.textContent = data.participantCount || 0;
      surveyCompleteRate.textContent = `${data.responseRate || 0}%`;
      hideAllSections();
      surveyCompleteSection.classList.remove('hidden');
      return;
    }

    // Get my final results
    const myResults = data.participantResults ? data.participantResults[participantId] : null;

    if (myResults || data.finalScore !== undefined) {
      const finalScore = data.finalScore !== undefined ? data.finalScore : (myResults?.currentScore || 0);
      const percentage = data.percentage !== undefined ? data.percentage : Math.round((myResults?.correctCount || 0) / data.totalQuestions * 100);
      const passed = typeof data.passed === 'boolean'
        ? data.passed
        : percentage >= (data.passingPercent || 70);

      finalScoreValue.textContent = finalScore;
      finalScoreMax.textContent = data.totalScore;
      finalPercentage.textContent = `${percentage}%`;
      finalRank.textContent = data.rank
        ? `#${data.rank}${data.participantCount ? ` of ${data.participantCount}` : ''}`
        : '—';
      finalCorrect.textContent = `${data.correctCount ?? myResults?.correctCount ?? 0} / ${data.totalQuestions || 0}`;
      finalStreak.textContent = data.bestStreak ?? myResults?.bestStreak ?? 0;

      if (passed) {
        finalIcon.className = 'final-icon passed';
        finalIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#trophy"></use></svg>';
        finalStatus.textContent = 'Congratulations!';
        finalPercentage.className = 'final-pct passed';
        finalMessage.textContent = `You cleared the ${data.passingPercent || 70}% mark.`;
      } else {
        finalIcon.className = 'final-icon failed';
        finalIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#book"></use></svg>';
        finalStatus.textContent = 'Keep Practicing!';
        finalPercentage.className = 'final-pct failed';
        finalMessage.textContent = motivatingMessages[Math.floor(Math.random() * motivatingMessages.length)];
      }
    }

    hideAllSections();
    endedSection.classList.remove('hidden');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected');
  });
}

function hideAllAnsweredBanner() {
  allAnsweredBanner.classList.add('hidden');
  timerRing.classList.remove('hidden');
}

function showAllAnsweredBanner() {
  clearInterval(timerInterval);
  timerRing.classList.add('hidden');
  allAnsweredBanner.classList.remove('hidden');
}

function stopNextQuestionCountdown() {
  clearInterval(nextQuestionCountdown);
  nextQuestionCountdown = null;
  resultWaiting.lastChild.textContent = 'Next question coming up';
  surveyResponseWaiting.lastChild.textContent = 'Next survey question coming up';
}

function startNextQuestionCountdown(nextInMs) {
  stopNextQuestionCountdown();
  if (!nextInMs || nextInMs <= 0) return;

  let remaining = Math.ceil(nextInMs / 1000);
  const target = currentSessionMode === 'survey' ? surveyResponseWaiting : resultWaiting;
  target.lastChild.textContent = `Next question in ${remaining}…`;

  nextQuestionCountdown = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(nextQuestionCountdown);
      nextQuestionCountdown = null;
      target.lastChild.textContent = currentSessionMode === 'survey'
        ? 'Next survey question coming up'
        : 'Next question coming up';
      return;
    }
    target.lastChild.textContent = `Next question in ${remaining}…`;
  }, 1000);
}

let sectionCountdownTimer = null;

function stopSectionCountdown() {
  if (sectionCountdownTimer) {
    clearInterval(sectionCountdownTimer);
    sectionCountdownTimer = null;
  }
  sectionIntroCountdown.classList.add('hidden');
}

// Autopilot holds a section for a fixed beat. A reconnecting client is sent the
// TRUE remaining milliseconds, so this counts down from whatever it receives
// rather than restarting a full hold.
function startSectionCountdown(nextInMs) {
  stopSectionCountdown();
  if (!nextInMs || nextInMs <= 0) return;

  let remaining = Math.ceil(nextInMs / 1000);
  sectionIntroCountdown.textContent = `Next up in ${remaining}…`;
  sectionIntroCountdown.classList.remove('hidden');

  sectionCountdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(sectionCountdownTimer);
      sectionCountdownTimer = null;
      sectionIntroCountdown.textContent = 'Here we go…';
      return;
    }
    sectionIntroCountdown.textContent = `Next up in ${remaining}…`;
  }, 1000);
}

// Show a non-destructive reconnection banner when connection drops mid-quiz.
// Preserves stored credentials so the student can try again when the server is back.
function showReconnectBanner(reason) {
  if (document.getElementById('reconnect-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'reconnect-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
    'background:#b45309', 'color:#fff', 'padding:12px 16px',
    'font-size:14px', 'text-align:center',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
  ].join(';');

  const msg = escapeText(reason || 'Connection to the room was interrupted.');
  banner.innerHTML = `
    <svg class="banner-icon" aria-hidden="true"><use href="/assets/icons.svg#target-alert"></use></svg>
    <strong>Connection interrupted.</strong> ${msg}
    <br><small>Wait for your teacher to let you know if the Mash will continue.
    <button type="button" class="reconnect-refresh" style="color:#fde68a;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer">Refresh</button>
    to try reconnecting.</small>
  `;
  banner.querySelector('.reconnect-refresh').addEventListener('click', () => {
    window.location.reload();
  });

  document.body.prepend(banner);
}

// Render options
function renderOptions(options) {
  optionsContainer.innerHTML = '';

  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'player-option';
    btn.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + i)}</span>
      <span class="option-text">${markdown.inline(opt)}</span>
    `;
    btn.addEventListener('click', () => selectAnswer(i, btn));
    optionsContainer.appendChild(btn);
  });
}

// Select answer
function selectAnswer(index, btn) {
  if (selectedAnswer !== null) return;

  selectedAnswer = index;

  const allBtns = optionsContainer.querySelectorAll('.player-option');
  allBtns.forEach(b => {
    b.classList.remove('selected');
    b.disabled = true;
  });
  btn.classList.add('selected');

  socket.emit('submit_answer', {
    participantId,
    sessionCode,
    questionId: currentQuestion.id,
    answerIndex: index
  });
}

// Show a readable answer distribution without canvas axis-label truncation.
function showResultsChart(data) {
  const counts = data.stats.counts;
  const totalResponses = counts.reduce((sum, count) => sum + Number(count || 0), 0);
  const largestCount = Math.max(1, ...counts);

  resultResponseTotal.textContent = `${totalResponses} ${totalResponses === 1 ? 'response' : 'responses'}`;
  resultsDistribution.innerHTML = '';

  currentQuestion.options.forEach((option, index) => {
    const count = Number(counts[index] || 0);
    const width = Math.round((count / largestCount) * 100);
    const row = document.createElement('div');
    row.className = `distribution-row ${data.correctIndices.includes(index) ? 'correct' : ''}`;
    row.innerHTML = `
      <div class="distribution-answer"><strong>${String.fromCharCode(65 + index)}.</strong> ${markdown.inline(option)}</div>
      <div class="distribution-track" aria-hidden="true"><span style="width: ${width}%"></span></div>
      <div class="distribution-count">${count}</div>
    `;
    resultsDistribution.appendChild(row);
  });
}

// Timer with circular progress
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  const circumference = 2 * Math.PI * 45;

  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = 0;
  timerProgress.classList.remove('urgent');

  timer.textContent = remaining;
  timer.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    timer.textContent = remaining;

    const progress = remaining / timerDuration;
    const offset = circumference * (1 - progress);
    timerProgress.style.strokeDashoffset = offset;

    if (remaining <= 5) {
      timer.classList.add('urgent');
      timerProgress.classList.add('urgent');
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      const allBtns = optionsContainer.querySelectorAll('.player-option');
      allBtns.forEach(b => b.disabled = true);
    }
  }, 1000);
}

// Hide all sections
function hideAllSections() {
  if (sectionExitTimer) {
    clearTimeout(sectionExitTimer);
    sectionExitTimer = null;
  }
  sectionIntroSection.classList.remove('section-transition-opening');
  joinSection.classList.add('hidden');
  sessionEndedSection.classList.add('hidden');
  waitingSection.classList.add('hidden');
  sectionIntroSection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  endedSection.classList.add('hidden');
  surveyResponseSection.classList.add('hidden');
  surveyCompleteSection.classList.add('hidden');
}

// Show error
function showError(message) {
  joinError.textContent = message;
  joinError.classList.remove('hidden');
  setTimeout(() => joinError.classList.add('hidden'), 5000);
}

// Initialize on page load
init();
