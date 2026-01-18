// DOM Elements
const joinSection = document.getElementById('join-section');
const joinForm = document.getElementById('join-form');
const joinError = document.getElementById('join-error');
const playerNameInput = document.getElementById('player-name');

const waitingSection = document.getElementById('waiting-section');
const welcomeName = document.getElementById('welcome-name');
const quizTitleDisplay = document.getElementById('quiz-title-display');

const questionSection = document.getElementById('question-section');
const currentQNum = document.getElementById('current-q-num');
const totalQNum = document.getElementById('total-q-num');
const questionText = document.getElementById('question-text');
const timer = document.getElementById('timer');
const optionsContainer = document.getElementById('options-container');
const answerStatus = document.getElementById('answer-status');

const resultsSection = document.getElementById('results-section');
const resultQNum = document.getElementById('result-q-num');
const yourAnswer = document.getElementById('your-answer');
const correctAnswer = document.getElementById('correct-answer');
const resultStatus = document.getElementById('result-status');
const resultsChart = document.getElementById('results-chart');

const endedSection = document.getElementById('ended-section');

// State
let socket = null;
let participantId = null;
let currentQuestion = null;
let selectedAnswer = null;
let timerInterval = null;
let chart = null;

// Join quiz
joinForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = playerNameInput.value.trim();
  if (!name) return;

  try {
    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await res.json();
    if (data.success) {
      participantId = data.participantId;
      localStorage.setItem('miniKahootId', participantId);
      localStorage.setItem('miniKahootName', name);

      joinSection.classList.add('hidden');
      waitingSection.classList.remove('hidden');
      welcomeName.textContent = `Welcome, ${name}!`;
      quizTitleDisplay.textContent = data.quizTitle;

      initSocket();
    } else {
      showError(joinError, data.error);
    }
  } catch (err) {
    showError(joinError, 'Connection error. Please try again.');
  }
});

// Initialize Socket.IO
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('participant_join', participantId);
  });

  socket.on('quiz_started', (data) => {
    quizTitleDisplay.textContent = data.title;
    totalQNum.textContent = data.totalQuestions;
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    selectedAnswer = null;

    // Update UI
    currentQNum.textContent = data.questionNumber;
    totalQNum.textContent = data.totalQuestions;
    questionText.textContent = data.question.text;
    answerStatus.classList.add('hidden');

    // Render options
    renderOptions(data.question.options);

    // Start timer
    startTimer(data.timeRemaining);

    // Show question section
    waitingSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_confirmed', (data) => {
    answerStatus.classList.remove('hidden');
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);

    // Show results
    resultQNum.textContent = currentQNum.textContent;

    const yourAnswerIdx = data.yourAnswer;
    const correctIdx = data.correctIndices[0]; // First correct answer
    const isCorrect = yourAnswerIdx !== undefined && data.correctIndices.includes(yourAnswerIdx);

    // Show correct answer
    correctAnswer.textContent = `${String.fromCharCode(65 + correctIdx)}. ${currentQuestion.options[correctIdx]}`;

    // Show your answer
    if (yourAnswerIdx !== undefined) {
      yourAnswer.textContent = `${String.fromCharCode(65 + yourAnswerIdx)}. ${currentQuestion.options[yourAnswerIdx]}`;
      yourAnswer.classList.remove('no-answer');
      resultStatus.textContent = isCorrect ? 'Correct!' : 'Incorrect';
      resultStatus.style.color = isCorrect ? 'var(--success)' : 'var(--danger)';
    } else {
      yourAnswer.textContent = 'No answer submitted';
      yourAnswer.classList.add('no-answer');
      resultStatus.textContent = 'Time ran out!';
      resultStatus.style.color = 'var(--warning)';
    }

    // Show chart
    showResultsChart(data);

    questionSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', () => {
    clearInterval(timerInterval);
    questionSection.classList.add('hidden');
    resultsSection.classList.add('hidden');
    waitingSection.classList.add('hidden');
    endedSection.classList.remove('hidden');
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
  });

  socket.on('connect_error', () => {
    showError(joinError, 'Connection lost. Please refresh the page.');
  });
}

// Render answer options
function renderOptions(options) {
  optionsContainer.innerHTML = '';

  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
    btn.addEventListener('click', () => selectAnswer(i, btn));
    optionsContainer.appendChild(btn);
  });
}

// Select an answer
function selectAnswer(index, btn) {
  if (selectedAnswer !== null) return; // Already answered

  selectedAnswer = index;

  // Highlight selected
  const allBtns = optionsContainer.querySelectorAll('.option-btn');
  allBtns.forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');

  // Disable all options
  allBtns.forEach(b => b.disabled = true);

  // Submit to server
  socket.emit('submit_answer', {
    participantId,
    questionId: currentQuestion.id,
    answerIndex: index
  });
}

// Timer
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  timer.textContent = remaining;
  timer.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    timer.textContent = remaining;

    if (remaining <= 5) {
      timer.classList.add('urgent');
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
      // Disable options if not answered
      const allBtns = optionsContainer.querySelectorAll('.option-btn');
      allBtns.forEach(b => b.disabled = true);
    }
  }, 1000);
}

// Show results chart
function showResultsChart(data) {
  // Labels show letter + truncated option text + count
  const labels = currentQuestion.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const truncated = opt.length > 20 ? opt.substring(0, 17) + '...' : opt;
    return `${letter}. ${truncated} (${data.stats.counts[i]})`;
  });
  const counts = data.stats.counts;
  const colors = currentQuestion.options.map((_, i) =>
    data.correctIndices.includes(i) ? 'rgba(34, 197, 94, 0.8)' : 'rgba(99, 102, 241, 0.8)'
  );

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(resultsChart, {
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
      indexAxis: 'y', // Horizontal bars for better label readability
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw} response${ctx.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { color: 'rgba(71, 85, 105, 0.5)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      }
    }
  });
}

// Utility
function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

// Check for existing session on page load
window.addEventListener('load', () => {
  const savedId = localStorage.getItem('miniKahootId');
  const savedName = localStorage.getItem('miniKahootName');

  // Could add reconnection logic here if needed
});
