// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const uploadSection = document.getElementById('upload-section');
const quizMarkdown = document.getElementById('quiz-markdown');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

const sessionInfoSection = document.getElementById('session-info-section');
const quizTitle = document.getElementById('quiz-title');
const questionCount = document.getElementById('question-count');
const quizStatus = document.getElementById('quiz-status');
const sessionCodeEl = document.getElementById('session-code');
const joinUrlLink = document.getElementById('join-url-link');
const qrCodeImg = document.getElementById('qr-code');

const participantsSection = document.getElementById('participants-section');
const participantCount = document.getElementById('participant-count');
const participantList = document.getElementById('participant-list');
const presenterUrl = document.getElementById('presenter-url');

const controlsSection = document.getElementById('controls-section');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const endQuestionBtn = document.getElementById('end-question-btn');
const showResultsBtn = document.getElementById('show-results-btn');
const endSessionBtn = document.getElementById('end-session-btn');

const questionSection = document.getElementById('question-section');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const currentQuestionText = document.getElementById('current-question-text');
const timerDisplay = document.getElementById('timer-display');
const answersReceived = document.getElementById('answers-received');
const totalParticipants = document.getElementById('total-participants');
const optionsDisplay = document.getElementById('options-display');

const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');

// State
let socket = null;
let currentQuiz = null;
let currentQuestion = null;
let timerInterval = null;
let sessionCode = null;

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (data.success) {
      loginSection.classList.add('hidden');
      dashboardSection.classList.remove('hidden');
    } else {
      showError(loginError, data.error);
    }
  } catch (err) {
    showError(loginError, 'Connection error');
  }
});

// Initialize Socket.IO for a specific session
function initSocket(code) {
  if (socket) {
    socket.disconnect();
  }

  socket = io();

  socket.on('connect', () => {
    socket.emit('admin_join', code);
  });

  socket.on('participant_joined', (data) => {
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
    if (data.name) {
      addParticipantChip(data.name);
    }
  });

  socket.on('quiz_started', (data) => {
    quizStatus.textContent = 'Running';
    quizStatus.className = 'badge badge-success';
    startBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    endSessionBtn.classList.add('hidden');
    questionSection.classList.add('hidden');
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    showQuestion(data);
    startTimer(data.timeRemaining);
    answersReceived.textContent = '0';

    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.remove('hidden');
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_received', (data) => {
    answersReceived.textContent = data.answeredCount;
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);
    endQuestionBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    // Highlight correct answers in options
    const optionBtns = optionsDisplay.querySelectorAll('.option-btn');
    optionBtns.forEach((btn, i) => {
      if (data.correctIndices.includes(i)) {
        btn.classList.add('correct');
      }
    });
  });

  socket.on('quiz_ended', () => {
    quizStatus.textContent = 'Ended';
    quizStatus.className = 'badge badge-warning';
    questionSection.classList.add('hidden');
    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.add('hidden');
    showResultsBtn.classList.remove('hidden');
    endSessionBtn.classList.remove('hidden');
  });

  socket.on('session_ended', (data) => {
    alert(data.message || 'Session has ended');
    // Reset UI to allow creating a new session
    resetToUploadState();
  });
}

// Upload Quiz - Now creates a session
uploadBtn.addEventListener('click', async () => {
  const markdown = quizMarkdown.value.trim();
  if (!markdown) return;

  try {
    const res = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });

    const data = await res.json();
    if (data.success) {
      sessionCode = data.session.code;
      currentQuiz = data.session.quiz;

      // Show session info
      showSessionInfo(data.session);

      // Initialize socket for this session
      initSocket(sessionCode);

      uploadStatus.innerHTML = '<span class="badge badge-success">Session created!</span>';
      uploadStatus.classList.remove('hidden');
    } else {
      uploadStatus.innerHTML = `<span style="color: var(--danger);">${data.error}</span>`;
      uploadStatus.classList.remove('hidden');
    }
  } catch (err) {
    uploadStatus.innerHTML = '<span style="color: var(--danger);">Connection error</span>';
    uploadStatus.classList.remove('hidden');
  }
});

// Show session info after creation
function showSessionInfo(session) {
  quizTitle.textContent = session.quiz.title || 'Untitled Quiz';
  questionCount.textContent = session.quiz.questions.length;
  totalQNum.textContent = session.quiz.questions.length;

  sessionCodeEl.textContent = session.code;
  joinUrlLink.textContent = session.joinUrl;
  joinUrlLink.href = session.joinUrl;

  // Show QR code
  if (session.qrCode) {
    qrCodeImg.src = session.qrCode;
    qrCodeImg.style.display = 'block';
  }

  // Update presenter URL with session code
  const presenterUrlWithSession = `${window.location.origin}/present.html?session=${session.code}`;
  presenterUrl.textContent = presenterUrlWithSession;
  presenterUrl.href = presenterUrlWithSession;

  // Clear participant list
  participantList.innerHTML = '';
  participantCount.textContent = '0';

  sessionInfoSection.classList.remove('hidden');
  participantsSection.classList.remove('hidden');
  controlsSection.classList.remove('hidden');

  // Reset control buttons state
  startBtn.classList.remove('hidden');
  nextBtn.classList.add('hidden');
  endQuestionBtn.classList.add('hidden');
  showResultsBtn.classList.add('hidden');
  endSessionBtn.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');

  quizStatus.textContent = 'Not Started';
  quizStatus.className = 'badge badge-warning';
}

// Reset to upload state
function resetToUploadState() {
  sessionCode = null;
  currentQuiz = null;

  sessionInfoSection.classList.add('hidden');
  participantsSection.classList.add('hidden');
  controlsSection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  uploadStatus.classList.add('hidden');

  participantList.innerHTML = '';

  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Start quiz
startBtn.addEventListener('click', () => {
  if (socket && sessionCode) {
    socket.emit('start_quiz', sessionCode);
  }
});

// Next question
nextBtn.addEventListener('click', () => {
  if (socket && sessionCode) {
    socket.emit('next_question', sessionCode);
  }
});

// End question early
endQuestionBtn.addEventListener('click', () => {
  if (socket && sessionCode) {
    socket.emit('end_question', sessionCode);
  }
});

// End session
endSessionBtn.addEventListener('click', async () => {
  if (!sessionCode) return;

  if (!confirm('Are you sure you want to end this session? All participants will be disconnected.')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/session/${sessionCode}/end`, {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      resetToUploadState();
    }
  } catch (err) {
    console.error('Failed to end session', err);
  }
});

// Show final results
showResultsBtn.addEventListener('click', async () => {
  if (!sessionCode) return;

  try {
    const res = await fetch(`/api/admin/session/${sessionCode}/results`);
    const data = await res.json();

    resultsBody.innerHTML = '';
    data.results.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(r.name)}</td>
        <td>${r.score} / ${r.total}</td>
      `;
      resultsBody.appendChild(tr);
    });

    questionSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    showResultsBtn.classList.add('hidden');
  } catch (err) {
    console.error('Failed to load results', err);
  }
});

// Show current question
function showQuestion(data) {
  currentQNum.textContent = data.questionNumber;
  currentQuestionText.textContent = data.question.text;

  optionsDisplay.innerHTML = '';
  data.question.options.forEach((opt, i) => {
    const btn = document.createElement('div');
    btn.className = 'option-btn';
    btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
    if (data.question.correctIndices && data.question.correctIndices.includes(i)) {
      btn.classList.add('correct');
    }
    optionsDisplay.appendChild(btn);
  });
}

// Timer
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  timerDisplay.textContent = remaining;
  timerDisplay.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    timerDisplay.textContent = remaining;

    if (remaining <= 5) {
      timerDisplay.classList.add('urgent');
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// Add participant chip
function addParticipantChip(name) {
  const chip = document.createElement('span');
  chip.className = 'participant-chip';
  chip.textContent = name;
  participantList.appendChild(chip);
}

// Utility functions
function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
