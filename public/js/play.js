// DOM Elements
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

const questionSection = document.getElementById('question-section');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const scoreDisplay = document.getElementById('score-display');
const timer = document.getElementById('timer');
const timerProgress = document.getElementById('timer-progress');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const answerStatus = document.getElementById('answer-status');

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
const participantStore = MarkdownMashParticipantStorage.createParticipantStore(
  window.sessionStorage,
  window.localStorage
);

// State
let socket = null;
let participantId = null;
let sessionCode = null;
let currentQuestion = null;
let selectedAnswer = null;
let timerInterval = null;
let timerDuration = 20;
let currentScore = 0;
let isFirstConnect = true; // Tracks whether this is the initial connection or a reconnect

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
      attemptJoin(identity.id);
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

async function attemptJoin(requestedParticipantId = null) {
  if (isJoining) return;
  const name = playerNameInput.value.trim();
  const code = sessionCodeInput.value.trim().toUpperCase();

  if (!name) return;
  if (!code || code.length !== 6) {
    showError('Please enter a valid 6-character session code');
    return;
  }

  let existingParticipantId = requestedParticipantId;
  if (!existingParticipantId) {
    const active = participantStore.getActive(code);
    if (active && normalizeName(active.name) === normalizeName(name)) {
      existingParticipantId = active.id;
    } else {
      // One-time compatibility path for participants who joined before v1.2.0.
      existingParticipantId = participantStore.getLegacyIdentity(code)?.id || null;
    }
  }

  isJoining = true;
  joinSubmitBtn.disabled = true;
  joinSubmitBtn.textContent = 'Joining...';

  try {
    const res = await fetch(`/api/session/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, existingParticipantId })
    });

    const data = await res.json();
    if (data.success) {
      participantId = data.participantId;
      sessionCode = data.sessionCode;

      participantStore.setActive(sessionCode, participantId, name);
      participantStore.rememberRecovery(sessionCode, participantId, name);
      participantStore.clearLegacyIdentity();

      hideAllSections();
      waitingSection.classList.remove('hidden');
      welcomeName.textContent = `Welcome, ${name}!`;
      quizTitleDisplay.textContent = data.quizTitle;
      waitingSessionCode.textContent = sessionCode;

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
  socket = io();

// Configure marked to use highlight.js
if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
  marked.setOptions({
    highlight: function(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    breaks: true
  });
}

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
    sessionCode = null;
  });

  socket.on('kicked', (data) => {
    // Clear stored credentials
    clearCurrentIdentity({ forgetRecovery: true });
    participantId = null;
    sessionCode = null;

    // Show kicked message
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

    // Show session ended screen
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'This session has ended.';
    sessionEndedSection.classList.remove('hidden');

    // Clear stored credentials
    clearCurrentIdentity({ clearSession: true });
    participantId = null;
    sessionCode = null;
  });

  socket.on('quiz_started', (data) => {
    quizTitleDisplay.textContent = data.title;
    totalQNum.textContent = data.totalQuestions;
    currentScore = 0;
    scoreDisplay.textContent = '0';
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    selectedAnswer = null;
    timerDuration = data.timeRemaining;

    currentQNum.textContent = data.questionNumber;
    totalQNum.textContent = data.totalQuestions;
    questionText.innerHTML = marked.parse(data.question.text);
    answerStatus.classList.add('hidden');

    renderOptions(data.question.options);
    startTimer(data.timeRemaining);

    hideAllSections();
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_confirmed', () => {
    answerStatus.classList.remove('hidden');
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);
    if (data.question) {
      currentQuestion = data.question;
    }

    // Get my results from participantResults
    const myResults = data.participantResults?.[participantId] || {
      yourAnswer: data.yourAnswer
    };
    const yourAnswerIdx = myResults.yourAnswer;
    const correctIdx = data.correctIndices[0];
    const isCorrect = yourAnswerIdx !== undefined && data.correctIndices.includes(yourAnswerIdx);

    // Update score
    currentScore = myResults.currentScore || 0;
    scoreDisplay.textContent = currentScore;
    currentScoreEl.textContent = currentScore;

    // Set result display
    if (yourAnswerIdx === undefined) {
      resultIcon.className = 'result-icon timeout';
      resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#clock"></use></svg>';
      resultText.textContent = "Time's up!";
      yourAnswer.textContent = 'No answer';
    } else if (isCorrect) {
      resultIcon.className = 'result-icon correct';
      resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#check-circle"></use></svg>';
      resultText.textContent = 'Correct!';
      yourAnswer.innerHTML = `${String.fromCharCode(65 + yourAnswerIdx)}. ${marked.parseInline(currentQuestion.options[yourAnswerIdx])}`;
    } else {
      resultIcon.className = 'result-icon incorrect';
      resultIcon.innerHTML = '<svg aria-hidden="true"><use href="/assets/icons.svg#x-circle"></use></svg>';
      resultText.textContent = 'Incorrect';
      yourAnswer.innerHTML = `${String.fromCharCode(65 + yourAnswerIdx)}. ${marked.parseInline(currentQuestion.options[yourAnswerIdx])}`;
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

    correctAnswer.innerHTML = `${String.fromCharCode(65 + correctIdx)}. ${marked.parseInline(currentQuestion.options[correctIdx])}`;
    document.querySelector('.result-detail-row.correct').style.display = isCorrect ? 'none' : 'flex';

    // Show results chart
    showResultsChart(data);

    hideAllSections();
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', (data) => {
    clearInterval(timerInterval);

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

  const msg = reason || 'Connection to quiz server was interrupted.';
  banner.innerHTML = `
    <svg class="banner-icon" aria-hidden="true"><use href="/assets/icons.svg#target-alert"></use></svg>
    <strong>Connection interrupted.</strong> ${msg}
    <br><small>Wait for your teacher to let you know if the quiz will continue.
    <a href="javascript:location.reload()" style="color:#fde68a;text-decoration:underline">Refresh</a>
    to try reconnecting.</small>
  `;

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
      <span class="option-text">${marked.parseInline(opt)}</span>
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
      <div class="distribution-answer"><strong>${String.fromCharCode(65 + index)}.</strong> ${marked.parseInline(option)}</div>
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
  joinSection.classList.add('hidden');
  sessionEndedSection.classList.add('hidden');
  waitingSection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  endedSection.classList.add('hidden');
}

// Show error
function showError(message) {
  joinError.textContent = message;
  joinError.classList.remove('hidden');
  setTimeout(() => joinError.classList.add('hidden'), 5000);
}

// Initialize on page load
init();
