// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

const uploadSection = document.getElementById('upload-section');
const quizMarkdown = document.getElementById('quiz-markdown');
const uploadBtn = document.getElementById('upload-btn');
const uploadStatus = document.getElementById('upload-status');

const quizInfoSection = document.getElementById('quiz-info-section');
const quizTitle = document.getElementById('quiz-title');
const questionCount = document.getElementById('question-count');
const quizStatus = document.getElementById('quiz-status');

const participantsSection = document.getElementById('participants-section');
const participantCount = document.getElementById('participant-count');
const participantList = document.getElementById('participant-list');
const joinUrl = document.getElementById('join-url');

const controlsSection = document.getElementById('controls-section');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const endQuestionBtn = document.getElementById('end-question-btn');
const showResultsBtn = document.getElementById('show-results-btn');

const questionSection = document.getElementById('question-section');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const currentQuestionText = document.getElementById('current-question-text');
const timerDisplay = document.getElementById('timer-display');
const answersReceived = document.getElementById('answers-received');
const totalParticipants = document.getElementById('total-participants');
const optionsDisplay = document.getElementById('options-display');

const statsSection = document.getElementById('stats-section');
const statsQNum = document.getElementById('stats-q-num');
const statsChart = document.getElementById('stats-chart');

const resultsSection = document.getElementById('results-section');
const resultsBody = document.getElementById('results-body');

// State
let socket = null;
let currentQuiz = null;
let currentQuestion = null;
let timerInterval = null;
let chart = null;

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
      initSocket();
      joinUrl.textContent = window.location.origin + '/play.html';
    } else {
      showError(loginError, data.error);
    }
  } catch (err) {
    showError(loginError, 'Connection error');
  }
});

// Initialize Socket.IO
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('admin_join');
  });

  socket.on('participant_joined', (data) => {
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
    addParticipantChip(data.name);
  });

  socket.on('quiz_started', (data) => {
    quizStatus.textContent = 'Running';
    quizStatus.className = 'badge badge-success';
    startBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    questionSection.classList.add('hidden');
    statsSection.classList.add('hidden');
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    showQuestion(data);
    startTimer(data.timeRemaining);
    answersReceived.textContent = '0';

    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.remove('hidden');
    statsSection.classList.add('hidden');
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_received', (data) => {
    answersReceived.textContent = data.answeredCount;
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);
    endQuestionBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    showStats(data);
  });

  socket.on('quiz_ended', () => {
    quizStatus.textContent = 'Ended';
    quizStatus.className = 'badge badge-warning';
    questionSection.classList.add('hidden');
    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.add('hidden');
    showResultsBtn.classList.remove('hidden');
  });
}

// Upload Quiz
uploadBtn.addEventListener('click', async () => {
  const markdown = quizMarkdown.value.trim();
  if (!markdown) return;

  try {
    const res = await fetch('/api/admin/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown })
    });

    const data = await res.json();
    if (data.success) {
      currentQuiz = data.quiz;
      showQuizInfo(data.quiz);
      uploadStatus.innerHTML = '<span class="badge badge-success">Quiz loaded successfully!</span>';
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

// Show quiz info after upload
function showQuizInfo(quiz) {
  quizTitle.textContent = quiz.title || 'Untitled Quiz';
  questionCount.textContent = quiz.questions.length;
  totalQNum.textContent = quiz.questions.length;

  quizInfoSection.classList.remove('hidden');
  participantsSection.classList.remove('hidden');
  controlsSection.classList.remove('hidden');
}

// Start quiz
startBtn.addEventListener('click', () => {
  if (socket) {
    socket.emit('start_quiz');
  }
});

// Next question
nextBtn.addEventListener('click', () => {
  if (socket) {
    socket.emit('next_question');
  }
});

// End question early
endQuestionBtn.addEventListener('click', () => {
  if (socket) {
    socket.emit('end_question');
  }
});

// Show final results
showResultsBtn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/admin/results');
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

    statsSection.classList.add('hidden');
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

// Show statistics
function showStats(data) {
  statsQNum.textContent = currentQNum.textContent;
  statsSection.classList.remove('hidden');

  // Highlight correct answers in options
  const optionBtns = optionsDisplay.querySelectorAll('.option-btn');
  optionBtns.forEach((btn, i) => {
    if (data.correctIndices.includes(i)) {
      btn.classList.add('correct');
    }
  });

  // Create/update chart - just A, B, C, D for vertical bars
  const labels = currentQuestion.options.map((_, i) => String.fromCharCode(65 + i));
  const counts = data.stats.counts;
  const colors = currentQuestion.options.map((_, i) =>
    data.correctIndices.includes(i) ? 'rgba(34, 197, 94, 0.8)' : 'rgba(99, 102, 241, 0.8)'
  );

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(statsChart, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Responses',
        data: counts,
        backgroundColor: colors,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw} response${ctx.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { color: 'rgba(71, 85, 105, 0.5)' }
        },
        x: {
          ticks: { color: '#94a3b8', maxRotation: 0 },
          grid: { display: false }
        }
      }
    }
  });
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
