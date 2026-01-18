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
const scoreDisplay = document.getElementById('score-display');

const resultsSection = document.getElementById('results-section');
const resultStatus = document.getElementById('result-status');
const currentScoreEl = document.getElementById('current-score');
const yourAnswer = document.getElementById('your-answer');
const correctAnswer = document.getElementById('correct-answer');
const resultsChart = document.getElementById('results-chart');

const endedSection = document.getElementById('ended-section');
const finalIcon = document.getElementById('final-icon');
const finalStatus = document.getElementById('final-status');
const finalScoreValue = document.getElementById('final-score-value');
const finalScoreMax = document.getElementById('final-score-max');
const finalPercentage = document.getElementById('final-percentage');
const finalMessage = document.getElementById('final-message');

// State
let socket = null;
let participantId = null;
let currentQuestion = null;
let selectedAnswer = null;
let timerInterval = null;
let chart = null;
let currentScore = 0;

// Motivating messages for those who don't pass
const motivatingMessages = [
  "Keep learning! Every expert was once a beginner.",
  "Progress, not perfection! Review and try again.",
  "Learning takes time. You've got this!",
  "Each question is a chance to grow. Keep going!",
  "Success is built on practice. Don't give up!"
];

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
      localStorage.setItem('markdownMashId', participantId);
      localStorage.setItem('markdownMashName', name);

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
    currentScore = 0;
    scoreDisplay.textContent = `Score: 0`;
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

    const yourAnswerIdx = data.yourAnswer;
    const correctIdx = data.correctIndices[0];
    const isCorrect = yourAnswerIdx !== undefined && data.correctIndices.includes(yourAnswerIdx);

    // Update current score
    currentScore = data.currentScore;
    scoreDisplay.textContent = `Score: ${currentScore}`;
    currentScoreEl.textContent = currentScore;

    // Set result icon
    resultStatus.className = 'result-icon';
    if (yourAnswerIdx === undefined) {
      resultStatus.classList.add('timeout');
    } else if (isCorrect) {
      resultStatus.classList.add('correct');
    } else {
      resultStatus.classList.add('incorrect');
    }

    // Show correct answer
    correctAnswer.textContent = `${String.fromCharCode(65 + correctIdx)}. ${currentQuestion.options[correctIdx]}`;

    // Show your answer
    if (yourAnswerIdx !== undefined) {
      yourAnswer.textContent = `${String.fromCharCode(65 + yourAnswerIdx)}. ${currentQuestion.options[yourAnswerIdx]}`;
    } else {
      yourAnswer.textContent = 'No answer';
    }

    // Show chart
    showResultsChart(data);

    questionSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', (data) => {
    clearInterval(timerInterval);

    // Set final score display
    finalScoreValue.textContent = data.finalScore;
    finalScoreMax.textContent = data.totalScore;
    finalPercentage.textContent = `${data.percentage}%`;

    // Set pass/fail styling
    if (data.passed) {
      finalIcon.className = 'final-icon passed';
      finalStatus.textContent = 'Congratulations!';
      finalStatus.className = 'final-status passed';
      finalPercentage.className = 'final-percentage passed';
      finalMessage.textContent = `You passed with ${data.correctCount}/${data.totalQuestions} correct answers!`;
    } else {
      finalIcon.className = 'final-icon failed';
      finalStatus.textContent = 'Keep Practicing!';
      finalStatus.className = 'final-status failed';
      finalPercentage.className = 'final-percentage failed';
      finalMessage.textContent = motivatingMessages[Math.floor(Math.random() * motivatingMessages.length)];
    }

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
  // Labels: just A, B, C, D for vertical bars
  const labels = currentQuestion.options.map((_, i) => String.fromCharCode(65 + i));
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

// Utility
function showError(el, message) {
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}
