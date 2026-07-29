if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
  marked.setOptions({
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(code, { language }).value;
    },
    breaks: true
  });
}

const sessionInputSection = document.getElementById('session-input-section');
const sessionForm = document.getElementById('session-form');
const sessionCodeInput = document.getElementById('session-code-input');
const sessionError = document.getElementById('session-error');
const waitingSection = document.getElementById('waiting-section');
const sessionEndedSection = document.getElementById('session-ended-section');
const sessionEndedMessage = document.getElementById('session-ended-message');
const getreadySection = document.getElementById('getready-section');
const questionSection = document.getElementById('question-section');
const resultsSection = document.getElementById('results-section');
const endedSection = document.getElementById('ended-section');
const quizTitle = document.getElementById('quiz-title');
const sessionCodeDisplay = document.getElementById('session-code-display');
const participantCount = document.getElementById('participant-count');
const joinUrl = document.getElementById('join-url');
const qrCodeImg = document.getElementById('qr-code');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const answeredCount = document.getElementById('answered-count');
const totalParticipants = document.getElementById('total-participants');
const timer = document.getElementById('timer');
const timerProgress = document.getElementById('timer-progress');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const resultQNum = document.getElementById('result-q-num');
const resultQuestionText = document.getElementById('result-question-text');
const correctCount = document.getElementById('correct-count');
const totalAnswered = document.getElementById('total-answered');
const answerDistribution = document.getElementById('answer-distribution');
const correctResponders = document.getElementById('correct-responders');
const momentCard = document.getElementById('moment-card');
const momentIconUse = document.getElementById('moment-icon-use');
const momentEyebrow = document.getElementById('moment-eyebrow');
const momentMessage = document.getElementById('moment-message');
const podiumScene = document.getElementById('podium-scene');
const hardestScene = document.getElementById('hardest-scene');
const podiumStage = document.getElementById('podium-stage');
const runnersUp = document.getElementById('runners-up');
const hardestQuestions = document.getElementById('hardest-questions');
const confettiField = document.getElementById('confetti-field');
const finaleSubtitle = document.getElementById('finale-subtitle');
const finaleReplayBtn = document.getElementById('finale-replay-btn');
const finaleNextBtn = document.getElementById('finale-next-btn');
const finaleProgress = document.getElementById('finale-progress');

let socket = null;
let sessionCode = null;
let currentQuestion = null;
let timerInterval = null;
let highlightInterval = null;
let timerDuration = 20;
let finaleData = null;
let finaleTimeouts = [];

function iconHref(icon) {
  return `/assets/icons.svg#${icon}`;
}

function init() {
  createConfetti();
  const urlSessionCode = new URLSearchParams(window.location.search).get('session');
  if (urlSessionCode) {
    sessionCodeInput.value = urlSessionCode.toUpperCase();
    joinSession(urlSessionCode.toUpperCase());
  }
}

sessionForm.addEventListener('submit', event => {
  event.preventDefault();
  const code = sessionCodeInput.value.trim().toUpperCase();
  if (code.length === 6) {
    joinSession(code);
  } else {
    showSessionError('Please enter a valid 6-character session code');
  }
});

async function joinSession(code) {
  sessionCode = code;

  try {
    const response = await fetch(`/api/admin/session/${code}/qr`);
    const data = await response.json();

    if (!data.success) {
      showSessionError(data.error || 'Session not found');
      return;
    }

    sessionCodeDisplay.textContent = code;
    joinUrl.textContent = data.joinUrl;
    if (data.qrCode) {
      qrCodeImg.src = data.qrCode;
      qrCodeImg.style.display = 'block';
    }

    hideAllSections();
    waitingSection.classList.remove('hidden');
    initSocket();
  } catch (error) {
    showSessionError('Connection error. Please try again.');
  }
}

function initSocket() {
  if (socket) socket.disconnect();
  socket = io();

  socket.on('connect', () => {
    socket.emit('presenter_join', sessionCode);
  });

  socket.on('session_invalid', data => {
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'Session not found';
    sessionEndedSection.classList.remove('hidden');
  });

  socket.on('session_ended', data => {
    clearPresenterTimers();
    hideAllSections();
    sessionEndedMessage.textContent = data.message || 'This session has ended.';
    sessionEndedSection.classList.remove('hidden');
  });

  socket.on('participant_joined', data => {
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
  });

  socket.on('quiz_loaded', data => {
    quizTitle.textContent = data.title;
    if (data.sessionCode) sessionCodeDisplay.textContent = data.sessionCode;
  });

  socket.on('quiz_started', data => {
    quizTitle.textContent = data.title;
    totalQNum.textContent = data.totalQuestions;
    hideAllSections();
    getreadySection.classList.remove('hidden');
  });

  socket.on('question_started', data => {
    clearPresenterTimers();
    currentQuestion = data.question;
    timerDuration = Math.max(1, data.timeRemaining);
    currentQNum.textContent = data.questionNumber;
    totalQNum.textContent = data.totalQuestions;
    questionText.innerHTML = marked.parse(data.question.text);
    answeredCount.textContent = '0';
    renderOptions(data.question.options);
    startTimer(data.timeRemaining);
    hideAllSections();
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_received', data => {
    answeredCount.textContent = data.answeredCount;
    totalParticipants.textContent = data.totalParticipants;
  });

  socket.on('question_ended', data => {
    clearPresenterTimers();
    if (data.question) currentQuestion = data.question;
    if (!currentQuestion) return;

    resultQNum.textContent = data.questionNumber || currentQNum.textContent;
    resultQuestionText.innerHTML = marked.parse(currentQuestion.text);

    const correctAnswers = data.stats.counts.reduce(
      (sum, count, index) => sum + (data.correctIndices.includes(index) ? count : 0),
      0
    );
    correctCount.textContent = correctAnswers;
    totalAnswered.textContent = data.stats.totalAnswered;

    renderAnswerDistribution(data);
    renderCorrectResponders(data.presentation?.correctParticipants || []);
    startHighlightRotation(data.presentation?.highlights || []);

    hideAllSections();
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', data => {
    clearPresenterTimers();
    showFinale(data);
  });
}

function renderOptions(options) {
  optionsContainer.innerHTML = '';
  options.forEach((option, index) => {
    const item = document.createElement('div');
    item.className = 'presenter-option';
    item.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + index)}</span>
      <span class="option-text">${marked.parseInline(option)}</span>
    `;
    optionsContainer.appendChild(item);
  });
}

function startTimer(seconds) {
  let remaining = Math.max(0, seconds);
  const circumference = 2 * Math.PI * 45;
  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = 0;
  timer.textContent = remaining;
  timer.classList.remove('urgent');
  timerProgress.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    timer.textContent = Math.max(0, remaining);
    const progress = Math.max(0, remaining) / timerDuration;
    timerProgress.style.strokeDashoffset = circumference * (1 - progress);

    if (remaining <= 5) {
      timer.classList.add('urgent');
      timerProgress.classList.add('urgent');
    }
    if (remaining <= 0) clearInterval(timerInterval);
  }, 1000);
}

function renderAnswerDistribution(data) {
  answerDistribution.innerHTML = '';
  const counts = data.stats.counts;
  const total = Math.max(1, data.stats.totalParticipants || data.stats.totalAnswered);
  const maxCount = Math.max(1, ...counts);

  currentQuestion.options.forEach((option, index) => {
    const count = counts[index] || 0;
    const percent = Math.round((count / total) * 100);
    const isCorrect = data.correctIndices.includes(index);
    const row = document.createElement('div');
    row.className = `answer-bar-row${isCorrect ? ' correct' : ''}`;

    row.innerHTML = `
      <div class="answer-bar-label">
        <span class="answer-letter">${String.fromCharCode(65 + index)}</span>
        <span class="answer-copy">${marked.parseInline(option)}</span>
        ${isCorrect ? `
          <svg class="answer-check" aria-label="Correct answer">
            <use href="/assets/icons.svg#check-circle"></use>
          </svg>
        ` : ''}
      </div>
      <div class="answer-bar-track">
        <div class="answer-bar-fill" style="--bar-width: ${(count / maxCount) * 100}%"></div>
        <span class="answer-bar-value">${count} · ${percent}%</span>
      </div>
    `;
    answerDistribution.appendChild(row);
  });
}

function renderCorrectResponders(participants) {
  correctResponders.innerHTML = '';
  if (participants.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'responders-empty';
    empty.textContent = 'No correct answers this round';
    correctResponders.appendChild(empty);
    return;
  }

  const visibleParticipants = participants.slice(0, 5);
  visibleParticipants.forEach(participant => {
    const chip = document.createElement('span');
    chip.className = 'responder-chip';
    chip.textContent = participant.name;
    correctResponders.appendChild(chip);
  });

  if (participants.length > visibleParticipants.length) {
    const more = document.createElement('span');
    more.className = 'responder-chip more';
    more.textContent = `+${participants.length - visibleParticipants.length} more`;
    correctResponders.appendChild(more);
  }
}

function startHighlightRotation(highlights) {
  clearInterval(highlightInterval);
  const items = highlights.length > 0 ? highlights : [{
    type: 'steady',
    icon: 'check-circle',
    eyebrow: 'Question complete',
    message: 'Ready for the next one'
  }];
  let index = 0;

  const showHighlight = () => {
    const highlight = items[index % items.length];
    momentCard.className = `result-insight-card moment-card ${highlight.type}`;
    momentIconUse.setAttribute('href', iconHref(highlight.icon));
    momentEyebrow.textContent = highlight.eyebrow;
    momentMessage.textContent = highlight.message;
    momentCard.classList.remove('moment-enter');
    void momentCard.offsetWidth;
    momentCard.classList.add('moment-enter');
    index++;
  };

  showHighlight();
  if (items.length > 1) highlightInterval = setInterval(showHighlight, 3500);
}

function showFinale(data) {
  finaleData = data || { leaderboard: [], hardestQuestions: [] };
  hideAllSections();
  endedSection.classList.remove('hidden');
  populateFinale();
  replayPodium();
}

function populateFinale() {
  const leaderboard = finaleData.leaderboard || [];
  finaleSubtitle.textContent = leaderboard.length > 0
    ? `${leaderboard.length} ${leaderboard.length === 1 ? 'participant' : 'participants'} completed the mash`
    : 'Quiz complete';

  podiumStage.querySelectorAll('.podium-place').forEach(place => {
    const rank = Number(place.dataset.rank);
    const participant = leaderboard[rank - 1];
    place.classList.toggle('absent', !participant);
    place.querySelector('[data-podium-name]').textContent = participant?.name || '';
    place.querySelector('[data-podium-score]').textContent = participant
      ? `${participant.correctCount} correct · ${participant.score} pts`
      : '';
  });

  runnersUp.innerHTML = '';
  leaderboard.slice(3, 5).forEach(participant => {
    const card = document.createElement('article');
    card.className = 'runner-up-card';
    card.innerHTML = `
      <span class="runner-rank">${participant.rank}</span>
      <div>
        <strong></strong>
        <span>${participant.correctCount} correct · ${participant.score} pts</span>
      </div>
    `;
    card.querySelector('strong').textContent = participant.name;
    runnersUp.appendChild(card);
  });

  renderHardestQuestions(finaleData.hardestQuestions || []);
}

function replayPodium() {
  clearFinaleTimeouts();
  podiumScene.classList.remove('hidden');
  hardestScene.classList.add('hidden');
  finaleProgress.textContent = 'Podium';
  setFinaleNextButton('Insights');
  runnersUp.classList.remove('revealed');
  confettiField.classList.remove('active');

  podiumStage.querySelectorAll('.podium-place').forEach(place => {
    place.classList.remove('revealed');
  });

  scheduleFinale(() => revealRank(3), 700);
  scheduleFinale(() => revealRank(2), 1700);
  scheduleFinale(() => {
    revealRank(1);
    confettiField.classList.add('active');
  }, 2900);
  scheduleFinale(() => runnersUp.classList.add('revealed'), 4200);

  if ((finaleData.hardestQuestions || []).length > 0) {
    scheduleFinale(showHardestScene, 8500);
  }
}

function revealRank(rank) {
  const place = podiumStage.querySelector(`[data-rank="${rank}"]`);
  if (place && !place.classList.contains('absent')) {
    place.classList.add('revealed');
  }
}

function showHardestScene() {
  clearFinaleTimeouts();
  podiumScene.classList.add('hidden');
  hardestScene.classList.remove('hidden');
  finaleProgress.textContent = 'Class insights';
  setFinaleNextButton('Podium');
}

function renderHardestQuestions(questions) {
  hardestQuestions.innerHTML = '';
  questions.forEach((question, index) => {
    const card = document.createElement('article');
    card.className = 'hard-question-card';
    const commonWrong = question.commonWrongAnswer
      ? `<div class="common-wrong"><span>Most common miss</span>${marked.parseInline(question.commonWrongAnswer)}</div>`
      : '<div class="common-wrong"><span>Most common miss</span>No single wrong answer</div>';

    card.innerHTML = `
      <div class="hard-question-rank">
        <svg aria-hidden="true"><use href="/assets/icons.svg#target-alert"></use></svg>
        <span>${index + 1}</span>
      </div>
      <div class="hard-question-copy">
        <div class="hard-question-label">Question ${question.index + 1}</div>
        <h3>${marked.parse(question.text)}</h3>
        ${commonWrong}
      </div>
      <div class="difficulty-ring" style="--difficulty: ${question.correctPercent}">
        <strong>${question.correctPercent}%</strong>
        <span>correct</span>
      </div>
    `;
    hardestQuestions.appendChild(card);
  });
}

function setFinaleNextButton(label) {
  finaleNextBtn.innerHTML = `
    ${label}
    <svg aria-hidden="true"><use href="/assets/icons.svg#chevron-right"></use></svg>
  `;
}

function createConfetti() {
  for (let index = 0; index < 42; index++) {
    const piece = document.createElement('span');
    piece.style.setProperty('--x', `${(index * 37) % 100}%`);
    piece.style.setProperty('--delay', `${(index % 9) * 0.08}s`);
    piece.style.setProperty('--fall', `${2.4 + (index % 6) * 0.22}s`);
    piece.style.setProperty('--spin', `${180 + (index % 5) * 90}deg`);
    piece.dataset.color = String((index % 5) + 1);
    confettiField.appendChild(piece);
  }
}

function scheduleFinale(callback, delay) {
  finaleTimeouts.push(setTimeout(callback, delay));
}

function clearFinaleTimeouts() {
  finaleTimeouts.forEach(timeout => clearTimeout(timeout));
  finaleTimeouts = [];
}

function clearPresenterTimers() {
  clearInterval(timerInterval);
  clearInterval(highlightInterval);
  clearFinaleTimeouts();
}

function hideAllSections() {
  sessionInputSection.classList.add('hidden');
  waitingSection.classList.add('hidden');
  sessionEndedSection.classList.add('hidden');
  getreadySection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  endedSection.classList.add('hidden');
}

function showSessionError(message) {
  sessionError.textContent = message;
  sessionError.classList.remove('hidden');
  setTimeout(() => sessionError.classList.add('hidden'), 5000);
}

finaleReplayBtn.addEventListener('click', replayPodium);
finaleNextBtn.addEventListener('click', () => {
  if (hardestScene.classList.contains('hidden')) {
    showHardestScene();
  } else {
    replayPodium();
  }
});

document.addEventListener('keydown', event => {
  if (endedSection.classList.contains('hidden')) return;
  if (event.key.toLowerCase() === 'r') replayPodium();
  if (event.key === 'ArrowRight' || event.key === ' ') {
    event.preventDefault();
    if (hardestScene.classList.contains('hidden')) showHardestScene();
    else replayPodium();
  }
});

init();
