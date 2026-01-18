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
let timerDuration = 20;
let currentScore = 0;

// Motivating messages
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

      hideAllSections();
      waitingSection.classList.remove('hidden');
      welcomeName.textContent = `Welcome, ${name}!`;
      quizTitleDisplay.textContent = data.quizTitle;

      initSocket();
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Connection error. Please try again.');
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
    scoreDisplay.textContent = '0';
  });

  socket.on('question_started', (data) => {
    currentQuestion = data.question;
    selectedAnswer = null;
    timerDuration = data.timeRemaining;

    currentQNum.textContent = data.questionNumber;
    totalQNum.textContent = data.totalQuestions;
    questionText.textContent = data.question.text;
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

    // Get my results from participantResults
    const myResults = data.participantResults[participantId] || {};
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
      resultText.textContent = "Time's up!";
      yourAnswer.textContent = 'No answer';
    } else if (isCorrect) {
      resultIcon.className = 'result-icon correct';
      resultText.textContent = 'Correct!';
      yourAnswer.textContent = `${String.fromCharCode(65 + yourAnswerIdx)}. ${currentQuestion.options[yourAnswerIdx]}`;
    } else {
      resultIcon.className = 'result-icon incorrect';
      resultText.textContent = 'Incorrect';
      yourAnswer.textContent = `${String.fromCharCode(65 + yourAnswerIdx)}. ${currentQuestion.options[yourAnswerIdx]}`;
    }

    correctAnswer.textContent = `${String.fromCharCode(65 + correctIdx)}. ${currentQuestion.options[correctIdx]}`;

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
      const passed = percentage >= 70;

      finalScoreValue.textContent = finalScore;
      finalScoreMax.textContent = data.totalScore;
      finalPercentage.textContent = `${percentage}%`;

      if (passed) {
        finalIcon.className = 'final-icon passed';
        finalStatus.textContent = 'Congratulations!';
        finalPercentage.className = 'final-pct passed';
        finalMessage.textContent = `You passed!`;
      } else {
        finalIcon.className = 'final-icon failed';
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

// Render options
function renderOptions(options) {
  optionsContainer.innerHTML = '';

  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'player-option';
    btn.innerHTML = `
      <span class="option-letter">${String.fromCharCode(65 + i)}</span>
      <span class="option-text">${opt}</span>
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
    questionId: currentQuestion.id,
    answerIndex: index
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
