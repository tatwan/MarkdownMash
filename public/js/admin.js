// DOM Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const forgotPasswordLink = document.getElementById('forgot-password-link');

// Settings elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsTabs = document.querySelectorAll('.settings-tab');
const changePasswordForm = document.getElementById('change-password-form');
const securityQuestionsForm = document.getElementById('security-questions-form');
const emailForm = document.getElementById('email-form');

// Recovery elements
const recoveryModal = document.getElementById('recovery-modal');
const closeRecoveryBtn = document.getElementById('close-recovery-btn');
const recoveryForm = document.getElementById('recovery-form');

// Auth state
let authToken = localStorage.getItem('authToken');
let currentAdmin = JSON.parse(localStorage.getItem('currentAdmin') || 'null');

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

// Analytics elements
const analyticsBtn = document.getElementById('analytics-btn');
const analyticsSection = document.getElementById('analytics-section');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const analyticsTabs = document.querySelectorAll('.tab-btn');
const analyticsOverview = document.getElementById('analytics-overview');
const analyticsSessions = document.getElementById('analytics-sessions');
const analyticsSessionsBody = document.getElementById('analytics-sessions-body');
const noSessionsMsg = document.getElementById('no-sessions-msg');

// Analytics stats elements
const totalSessionsStat = document.getElementById('total-sessions-stat');
const completedSessionsStat = document.getElementById('completed-sessions-stat');
const totalParticipantsStat = document.getElementById('total-participants-stat');
const avgScoreStat = document.getElementById('avg-score-stat');

// Session detail elements
const sessionDetailSection = document.getElementById('session-detail-section');
const backToAnalyticsBtn = document.getElementById('back-to-analytics-btn');
const detailQuizTitle = document.getElementById('detail-quiz-title');
const exportCsvBtn = document.getElementById('export-csv-btn');
const detailParticipants = document.getElementById('detail-participants');
const detailAvgScore = document.getElementById('detail-avg-score');
const detailQuestions = document.getElementById('detail-questions');
const questionBreakdownBody = document.getElementById('question-breakdown-body');
const participantPerformanceBody = document.getElementById('participant-performance-body');

// State
let socket = null;
let currentQuiz = null;
let currentQuestion = null;
let timerInterval = null;
let sessionCode = null;
let viewingSessionCode = null; // For analytics detail view

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
      // Store auth token
      authToken = data.token;
      currentAdmin = data.admin;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));

      loginSection.classList.add('hidden');
      dashboardSection.classList.remove('hidden');
      analyticsBtn.classList.remove('hidden');
      settingsBtn.classList.remove('hidden');

      // If first login or no security questions, prompt to set them
      if (data.isFirstLogin || !data.admin.hasSecurityQuestions) {
        setTimeout(() => {
          alert('Welcome! Please set up security questions in Settings for password recovery.');
          openSettings();
          switchSettingsTab('security');
        }, 500);
      }
    } else {
      showError(loginError, data.error);
    }
  } catch (err) {
    showError(loginError, 'Connection error');
  }
});

// Check for existing valid token on page load
async function checkExistingAuth() {
  if (authToken) {
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentAdmin = data.admin;
        localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        analyticsBtn.classList.remove('hidden');
        settingsBtn.classList.remove('hidden');
        return;
      }
    } catch (err) {
      // Token invalid, clear it
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentAdmin');
    authToken = null;
    currentAdmin = null;
  }
}

// Run auth check on load
checkExistingAuth();

// Logout function
function logout() {
  authToken = null;
  currentAdmin = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentAdmin');
  loginSection.classList.remove('hidden');
  dashboardSection.classList.add('hidden');
  analyticsBtn.classList.add('hidden');
  settingsBtn.classList.add('hidden');
  resetToUploadState();
}

// Helper to make authenticated requests
async function authFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${authToken}`
  };
  return fetch(url, { ...options, headers });
}

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
      addParticipantChip(data.name, data.id);
    }
  });

  socket.on('participant_kicked', (data) => {
    const chip = participantList.querySelector(`[data-id="${data.participantId}"]`);
    if (chip) chip.remove();
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
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

// Add participant chip (with kick button if we have participant ID)
function addParticipantChip(name, id = null) {
  if (id) {
    addParticipantChipWithKick(id, name);
  } else {
    const chip = document.createElement('span');
    chip.className = 'participant-chip';
    chip.textContent = name;
    participantList.appendChild(chip);
  }
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

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

// Show analytics section
analyticsBtn.addEventListener('click', () => {
  showAnalytics();
});

// Back to dashboard from analytics
backToDashboardBtn.addEventListener('click', () => {
  hideAnalytics();
});

// Tab switching
analyticsTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    analyticsTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (tabName === 'overview') {
      analyticsOverview.classList.remove('hidden');
      analyticsSessions.classList.add('hidden');
    } else {
      analyticsOverview.classList.add('hidden');
      analyticsSessions.classList.remove('hidden');
      loadSessionsList();
    }
  });
});

// Back to analytics from session detail
backToAnalyticsBtn.addEventListener('click', () => {
  sessionDetailSection.classList.add('hidden');
  analyticsSection.classList.remove('hidden');
  viewingSessionCode = null;
});

// Export CSV
exportCsvBtn.addEventListener('click', () => {
  if (viewingSessionCode) {
    window.location.href = `/api/admin/analytics/session/${viewingSessionCode}/export`;
  }
});

// Show analytics view
async function showAnalytics() {
  // Hide dashboard elements
  uploadSection.classList.add('hidden');
  sessionInfoSection.classList.add('hidden');
  participantsSection.classList.add('hidden');
  controlsSection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');

  // Show analytics
  analyticsSection.classList.remove('hidden');
  sessionDetailSection.classList.add('hidden');

  // Reset to overview tab
  analyticsTabs.forEach(t => t.classList.remove('active'));
  analyticsTabs[0].classList.add('active');
  analyticsOverview.classList.remove('hidden');
  analyticsSessions.classList.add('hidden');

  // Load overview stats
  await loadPlatformStats();
}

// Hide analytics and return to dashboard
function hideAnalytics() {
  analyticsSection.classList.add('hidden');
  sessionDetailSection.classList.add('hidden');
  uploadSection.classList.remove('hidden');

  // Show session info if there's an active session
  if (sessionCode) {
    sessionInfoSection.classList.remove('hidden');
    participantsSection.classList.remove('hidden');
    controlsSection.classList.remove('hidden');
  }
}

// Load platform overview stats
async function loadPlatformStats() {
  try {
    const res = await fetch('/api/admin/analytics/overview');
    const data = await res.json();

    if (data.success) {
      totalSessionsStat.textContent = data.stats.totalSessions;
      completedSessionsStat.textContent = data.stats.completedSessions;
      totalParticipantsStat.textContent = data.stats.totalParticipants;
      avgScoreStat.textContent = `${Math.round(data.stats.overallAvgScore || 0)}%`;
    }
  } catch (err) {
    console.error('Failed to load platform stats', err);
  }
}

// Load sessions list
async function loadSessionsList() {
  try {
    const res = await fetch('/api/admin/analytics/sessions');
    const data = await res.json();

    analyticsSessionsBody.innerHTML = '';

    if (data.success && data.sessions.length > 0) {
      noSessionsMsg.classList.add('hidden');

      data.sessions.forEach(session => {
        const tr = document.createElement('tr');
        const date = session.endedAt ? new Date(session.endedAt).toLocaleDateString() : 'N/A';

        tr.innerHTML = `
          <td><code>${escapeHtml(session.code)}</code></td>
          <td>${escapeHtml(session.quizTitle || 'Untitled')}</td>
          <td>${session.participantCount}</td>
          <td>${Math.round(session.avgScorePercent || 0)}%</td>
          <td>${date}</td>
          <td><button class="btn btn-small" data-code="${escapeHtml(session.code)}">View</button></td>
        `;

        // Add click handler for view button
        const viewBtn = tr.querySelector('button');
        viewBtn.addEventListener('click', () => {
          loadSessionDetail(session.code);
        });

        analyticsSessionsBody.appendChild(tr);
      });
    } else {
      noSessionsMsg.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Failed to load sessions list', err);
  }
}

// Load session detail
async function loadSessionDetail(code) {
  try {
    const res = await fetch(`/api/admin/analytics/session/${code}`);
    const data = await res.json();

    if (!data.success) {
      alert('Failed to load session details');
      return;
    }

    viewingSessionCode = code;

    // Hide analytics list, show detail
    analyticsSection.classList.add('hidden');
    sessionDetailSection.classList.remove('hidden');

    // Populate session info
    detailQuizTitle.textContent = data.session.quizTitle || 'Untitled Quiz';
    detailParticipants.textContent = data.participants.length;
    detailQuestions.textContent = data.session.totalQuestions;

    // Calculate average score
    const avgScore = data.participants.length > 0
      ? data.participants.reduce((sum, p) => sum + (p.correctCount / data.session.totalQuestions * 100), 0) / data.participants.length
      : 0;
    detailAvgScore.textContent = `${Math.round(avgScore)}%`;

    // Populate question difficulty table (sorted by difficulty - hardest first)
    questionBreakdownBody.innerHTML = '';
    data.questionsByDifficulty.forEach(q => {
      const tr = document.createElement('tr');
      const avgTime = q.avgResponseTimeMs ? `${(q.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A';
      const difficultyClass = `difficulty-${q.difficulty}`;

      tr.innerHTML = `
        <td>Q${q.index + 1}</td>
        <td class="question-text-cell">${escapeHtml(truncateText(q.text, 50))}</td>
        <td>${Math.round(q.correctPercent)}%</td>
        <td>${avgTime}</td>
        <td><span class="difficulty-badge ${difficultyClass}">${q.difficulty}</span></td>
      `;
      questionBreakdownBody.appendChild(tr);
    });

    // Populate participant performance table
    participantPerformanceBody.innerHTML = '';
    data.participants.forEach((p, i) => {
      const tr = document.createElement('tr');
      const avgTime = p.avgResponseTimeMs ? `${(p.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A';

      tr.innerHTML = `
        <td>${i + 1}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.correctCount} / ${data.session.totalQuestions}</td>
        <td>${p.score}</td>
        <td>${avgTime}</td>
      `;
      participantPerformanceBody.appendChild(tr);
    });

  } catch (err) {
    console.error('Failed to load session detail', err);
  }
}

// Helper to truncate long text
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// ============================================
// SETTINGS FUNCTIONS
// ============================================

// Open settings modal
function openSettings() {
  settingsModal.classList.remove('hidden');
  loadAdminSettings();
}

// Close settings modal
function closeSettings() {
  settingsModal.classList.add('hidden');
  clearSettingsForms();
}

// Switch settings tabs
function switchSettingsTab(tabName) {
  settingsTabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
  });
  document.getElementById('settings-password').classList.toggle('hidden', tabName !== 'password');
  document.getElementById('settings-security').classList.toggle('hidden', tabName !== 'security');
  document.getElementById('settings-email').classList.toggle('hidden', tabName !== 'email');
}

// Load admin settings
async function loadAdminSettings() {
  try {
    const res = await authFetch('/api/admin/settings');
    const data = await res.json();
    if (data.success) {
      document.getElementById('admin-email').value = data.admin.email || '';
      if (data.admin.securityQuestion1) {
        document.getElementById('security-q1').value = data.admin.securityQuestion1;
      }
      if (data.admin.securityQuestion2) {
        document.getElementById('security-q2').value = data.admin.securityQuestion2;
      }
    }
  } catch (err) {
    console.error('Failed to load settings', err);
  }
}

// Clear settings forms
function clearSettingsForms() {
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  document.getElementById('security-a1').value = '';
  document.getElementById('security-a2').value = '';
  hideStatus('password-status');
  hideStatus('security-status');
  hideStatus('email-status');
}

// Show status message
function showStatus(elementId, message, isSuccess) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.className = `status-message ${isSuccess ? 'success' : 'error'}`;
  el.classList.remove('hidden');
}

// Hide status message
function hideStatus(elementId) {
  document.getElementById(elementId).classList.add('hidden');
}

// Settings button click
settingsBtn.addEventListener('click', openSettings);

// Close settings button
closeSettingsBtn.addEventListener('click', closeSettings);

// Close modal when clicking outside
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettings();
});

// Settings tab switching
settingsTabs.forEach(tab => {
  tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
});

// Change password form
changePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    showStatus('password-status', 'New passwords do not match', false);
    return;
  }

  if (newPassword.length < 6) {
    showStatus('password-status', 'Password must be at least 6 characters', false);
    return;
  }

  try {
    const res = await authFetch('/api/admin/settings/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await res.json();
    if (data.success) {
      showStatus('password-status', 'Password updated successfully!', true);
      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
    } else {
      showStatus('password-status', data.error, false);
    }
  } catch (err) {
    showStatus('password-status', 'Connection error', false);
  }
});

// Security questions form
securityQuestionsForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const question1 = document.getElementById('security-q1').value;
  const answer1 = document.getElementById('security-a1').value;
  const question2 = document.getElementById('security-q2').value;
  const answer2 = document.getElementById('security-a2').value;

  if (!question1 || !answer1 || !question2 || !answer2) {
    showStatus('security-status', 'All fields are required', false);
    return;
  }

  if (question1 === question2) {
    showStatus('security-status', 'Please choose different questions', false);
    return;
  }

  try {
    const res = await authFetch('/api/admin/settings/security-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question1, answer1, question2, answer2 })
    });

    const data = await res.json();
    if (data.success) {
      showStatus('security-status', 'Security questions saved!', true);
      document.getElementById('security-a1').value = '';
      document.getElementById('security-a2').value = '';
    } else {
      showStatus('security-status', data.error, false);
    }
  } catch (err) {
    showStatus('security-status', 'Connection error', false);
  }
});

// Email form
emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('admin-email').value;

  try {
    const res = await authFetch('/api/admin/settings/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await res.json();
    if (data.success) {
      showStatus('email-status', 'Email updated!', true);
    } else {
      showStatus('email-status', data.error, false);
    }
  } catch (err) {
    showStatus('email-status', 'Connection error', false);
  }
});

// ============================================
// PASSWORD RECOVERY
// ============================================

// Forgot password link
forgotPasswordLink.addEventListener('click', async (e) => {
  e.preventDefault();

  try {
    const res = await fetch('/api/admin/recovery/questions', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      document.getElementById('recovery-q1').textContent = data.questions.question1;
      document.getElementById('recovery-q2').textContent = data.questions.question2;
      recoveryModal.classList.remove('hidden');
    } else {
      showError(loginError, data.error);
    }
  } catch (err) {
    showError(loginError, 'Connection error');
  }
});

// Close recovery modal
closeRecoveryBtn.addEventListener('click', () => {
  recoveryModal.classList.add('hidden');
  recoveryForm.reset();
  hideStatus('recovery-status');
});

// Recovery modal click outside
recoveryModal.addEventListener('click', (e) => {
  if (e.target === recoveryModal) {
    recoveryModal.classList.add('hidden');
    recoveryForm.reset();
    hideStatus('recovery-status');
  }
});

// Recovery form submit
recoveryForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const answer1 = document.getElementById('recovery-a1').value;
  const answer2 = document.getElementById('recovery-a2').value;
  const newPassword = document.getElementById('recovery-new-password').value;

  if (newPassword.length < 6) {
    showStatus('recovery-status', 'Password must be at least 6 characters', false);
    return;
  }

  try {
    const res = await fetch('/api/admin/recovery/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer1, answer2, newPassword })
    });

    const data = await res.json();
    if (data.success) {
      showStatus('recovery-status', 'Password reset! You can now login.', true);
      setTimeout(() => {
        recoveryModal.classList.add('hidden');
        recoveryForm.reset();
        hideStatus('recovery-status');
      }, 2000);
    } else {
      showStatus('recovery-status', data.error, false);
    }
  } catch (err) {
    showStatus('recovery-status', 'Connection error', false);
  }
});

// ============================================
// PARTICIPANT MANAGEMENT
// ============================================

// Add participant chip with kick button
function addParticipantChipWithKick(id, name) {
  const chip = document.createElement('span');
  chip.className = 'participant-chip';
  chip.dataset.id = id;
  chip.innerHTML = `
    ${escapeHtml(name)}
    <button class="kick-btn" title="Remove participant">&times;</button>
  `;

  chip.querySelector('.kick-btn').addEventListener('click', async () => {
    if (!confirm(`Remove ${name} from the session?`)) return;
    await kickParticipant(id, name);
  });

  participantList.appendChild(chip);
}

// Kick participant
async function kickParticipant(participantId, participantName) {
  if (!sessionCode) return;

  try {
    const res = await authFetch(`/api/admin/session/${sessionCode}/kick/${participantId}`, {
      method: 'POST'
    });

    const data = await res.json();
    if (data.success) {
      // Remove chip from UI
      const chip = participantList.querySelector(`[data-id="${participantId}"]`);
      if (chip) chip.remove();

      // Update count
      const currentCount = parseInt(participantCount.textContent) - 1;
      participantCount.textContent = currentCount;
      totalParticipants.textContent = currentCount;
    } else {
      alert(data.error || 'Failed to remove participant');
    }
  } catch (err) {
    console.error('Kick error:', err);
    alert('Failed to remove participant');
  }
}

// Handle participant_kicked socket event
if (socket) {
  socket.on('participant_kicked', (data) => {
    const chip = participantList.querySelector(`[data-id="${data.participantId}"]`);
    if (chip) chip.remove();
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
  });
}
