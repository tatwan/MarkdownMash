// DOM Elements
const waitingSection = document.getElementById('waiting-section');
const getreadySection = document.getElementById('getready-section');
const questionSection = document.getElementById('question-section');
const resultsSection = document.getElementById('results-section');
const endedSection = document.getElementById('ended-section');

const quizTitle = document.getElementById('quiz-title');
const participantCount = document.getElementById('participant-count');
const joinUrl = document.getElementById('join-url');

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
const resultsChart = document.getElementById('results-chart');

// State
let socket = null;
let currentQuestion = null;
let timerInterval = null;
let timerDuration = 20;
let chart = null;

// Initialize
function init() {
  joinUrl.textContent = window.location.origin + '/play.html';
  initSocket();
}

// Initialize Socket.IO
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    socket.emit('presenter_join');
  });

  socket.on('participant_joined', (data) => {
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
  });

  socket.on('quiz_loaded', (data) => {
    quizTitle.textContent = data.title;
  });

  socket.on('quiz_started', (data) => {
    quizTitle.textContent = data.title;
    totalQNum.textContent = data.totalQuestions;

    // Show "Get Ready" briefly
    hideAllSections();
    getreadySection.classList.remove('hidden');
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    timerDuration = data.timeRemaining;

    // Update UI
    currentQNum.textContent = data.questionNumber;
    totalQNum.textContent = data.totalQuestions;
    questionText.textContent = data.question.text;
    answeredCount.textContent = '0';

    // Render options (no correct highlighting yet)
    renderOptions(data.question.options);

    // Start timer
    startTimer(data.timeRemaining);

    // Show question section
    hideAllSections();
    questionSection.classList.remove('hidden');
  });

  socket.on('answer_received', (data) => {
    answeredCount.textContent = data.answeredCount;
    totalParticipants.textContent = data.totalParticipants;
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);

    // Update result section
    resultQNum.textContent = currentQNum.textContent;
    resultQuestionText.textContent = currentQuestion.text;

    // Calculate correct answers
    const correctAnswers = data.stats.counts.reduce((sum, count, i) => {
      return data.correctIndices.includes(i) ? sum + count : sum;
    }, 0);
    correctCount.textContent = correctAnswers;
    totalAnswered.textContent = data.stats.totalAnswered;

    // Show chart with correct answer highlighted
    showResultsChart(data);

    // Show results section
    hideAllSections();
    resultsSection.classList.remove('hidden');
  });

  socket.on('quiz_ended', () => {
    clearInterval(timerInterval);
    hideAllSections();
    endedSection.classList.remove('hidden');
  });
}

// Render options (no highlighting during question)
function renderOptions(options) {
  optionsContainer.innerHTML = '';

  options.forEach((opt, i) => {
    const div = document.createElement('div');
    div.className = 'presenter-option';
    div.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + i)}</span>
      <span class="option-text">${opt}</span>
    `;
    optionsContainer.appendChild(div);
  });
}

// Timer with circular progress
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  const circumference = 2 * Math.PI * 45;

  timerProgress.style.strokeDasharray = circumference;
  timerProgress.style.strokeDashoffset = 0;

  timer.textContent = remaining;
  timer.classList.remove('urgent');

  timerInterval = setInterval(() => {
    remaining--;
    timer.textContent = remaining;

    // Update circular progress
    const progress = remaining / timerDuration;
    const offset = circumference * (1 - progress);
    timerProgress.style.strokeDashoffset = offset;

    if (remaining <= 5) {
      timer.classList.add('urgent');
      timerProgress.classList.add('urgent');
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 1000);
}

// Show results chart
function showResultsChart(data) {
  const labels = currentQuestion.options.map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    return `${letter}. ${opt.length > 30 ? opt.substring(0, 27) + '...' : opt}`;
  });
  const counts = data.stats.counts;
  const colors = currentQuestion.options.map((_, i) =>
    data.correctIndices.includes(i) ? 'rgba(34, 197, 94, 0.9)' : 'rgba(99, 102, 241, 0.7)'
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
        borderRadius: 8
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#f1f5f9',
            font: { size: 16 }
          },
          grid: { color: 'rgba(71, 85, 105, 0.5)' }
        },
        y: {
          ticks: {
            color: '#f1f5f9',
            font: { size: 18 }
          },
          grid: { display: false }
        }
      }
    }
  });
}

// Hide all sections
function hideAllSections() {
  waitingSection.classList.add('hidden');
  getreadySection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  endedSection.classList.add('hidden');
}

// Start
init();
