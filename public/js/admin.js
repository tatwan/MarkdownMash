const markdown = MarkdownMashMarkdown;

// DOM Elements
const loginSection = document.getElementById('login-section');
const inviteSection = document.getElementById('invite-section');
const signupSection = document.getElementById('signup-section');
const dashboardSection = document.getElementById('dashboard-section');
const instructorHomeLink = document.getElementById('instructor-home-link');
const instructorHomeSection = document.getElementById('instructor-home-section');
const instructorHomeHeading = document.getElementById('instructor-home-heading');
const instructorHomeWelcome = document.getElementById('instructor-home-welcome');
const homeHostBtn = document.getElementById('home-host-btn');
const homeHostTitle = document.getElementById('home-host-title');
const homeHostCopy = document.getElementById('home-host-copy');
const homeHostAction = document.getElementById('home-host-action');
const homeSurveyBtn = document.getElementById('home-survey-btn');
const homeAnalyticsBtn = document.getElementById('home-analytics-btn');
const homeAccountBtn = document.getElementById('home-account-btn');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const loginSuccess = document.getElementById('login-success');
const forgotPasswordLink = document.getElementById('forgot-password-link');
const loginEmailField = document.getElementById('login-email-field');
const loginEmail = document.getElementById('login-email');
const loginAccountContext = document.getElementById('login-account-context');
const loginAccountTitle = document.getElementById('login-account-title');
const loginAccountDetail = document.getElementById('login-account-detail');
const loginRecoveryHelp = document.getElementById('login-recovery-help');
const passwordInput = document.getElementById('password');
const trialEntry = document.getElementById('trial-entry');
const tryItOutBtn = document.getElementById('try-it-out-btn');
const signupEntry = document.getElementById('signup-entry');
const createAccountBtn = document.getElementById('create-account-btn');
const trialBanner = document.getElementById('trial-banner');
const trialCountdown = document.getElementById('trial-countdown');
const trialCompletionCta = document.getElementById('trial-completion-cta');
const studioTitle = document.getElementById('studio-title');
const studioTitleLabel = document.getElementById('studio-title-label');
const builderEyebrow = document.getElementById('builder-eyebrow');
const builderHeading = document.getElementById('builder-heading');
const builderDescription = document.getElementById('builder-description');
const builderCardHeading = document.getElementById('builder-card-heading');
const builderCardDescription = document.getElementById('builder-card-description');

// Settings elements
const settingsBtn = document.getElementById('settings-btn');
const logoutBtn = document.getElementById('logout-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const settingsTabs = document.querySelectorAll('.settings-tab');
const settingsPanels = {
  password: document.getElementById('settings-password'),
  billing: document.getElementById('settings-billing'),
  instructors: document.getElementById('settings-instructors'),
  security: document.getElementById('settings-security'),
  email: document.getElementById('settings-email')
};
const instructorList = document.getElementById('instructor-list');
const changePasswordForm = document.getElementById('change-password-form');
const securityQuestionsForm = document.getElementById('security-questions-form');
const emailForm = document.getElementById('email-form');
const createInvitationForm = document.getElementById('create-invitation-form');

// Recovery elements
const recoveryModal = document.getElementById('recovery-modal');
const closeRecoveryBtn = document.getElementById('close-recovery-btn');
const recoveryForm = document.getElementById('recovery-form');

// Auth state
const storedTrialToken = sessionStorage.getItem('trialToken');
let authToken = storedTrialToken || localStorage.getItem('authToken');
let currentAdmin = storedTrialToken
  ? JSON.parse(sessionStorage.getItem('trialPrincipal') || 'null')
  : JSON.parse(localStorage.getItem('currentAdmin') || 'null');
let hostedAuthMode = false;
let billingEnabled = false;
let invitationActivationEnabled = false;
let publicSignupEnabled = false;
let hostedInvitationToken = (() => {
  try {
    return new URLSearchParams(window.location.hash.slice(1)).get('invite');
  } catch (error) {
    return null;
  }
})();

const uploadSection = document.getElementById('upload-section');
const quizMarkdown = document.getElementById('quiz-markdown');
const uploadBtn = document.getElementById('upload-btn');
const uploadBtnLabel = document.getElementById('upload-btn-label');
const previewBtn = document.getElementById('preview-btn');
const courseNameInput = document.getElementById('course-name-input');
const uploadStatus = document.getElementById('upload-status');

// Edit Metadata Elements
const editMetadataModal = document.getElementById('edit-metadata-modal');
const closeEditMetadataBtn = document.getElementById('close-edit-metadata-btn');
const editMetadataForm = document.getElementById('edit-metadata-form');
const editSessionCode = document.getElementById('edit-session-code');
const editCourseName = document.getElementById('edit-course-name');
const editIsTest = document.getElementById('edit-is-test');

// Preview Modal Elements
const previewModal = document.getElementById('preview-modal');
const closePreviewBtn = document.getElementById('close-preview-btn');
const previewQuestionText = document.getElementById('preview-question-text');
const previewOptionsContainer = document.getElementById('preview-options-container');
const previewPrevBtn = document.getElementById('preview-prev-btn');
const previewNextBtn = document.getElementById('preview-next-btn');
const previewPlayerHeader = document.getElementById('preview-player-header');
const previewSectionCard = document.getElementById('preview-section-card');
const previewSectionEyebrow = document.getElementById('preview-section-eyebrow');
const previewSectionTitle = document.getElementById('preview-section-title');
const previewSectionSubtitle = document.getElementById('preview-section-subtitle');
const openTemplateBtn = document.getElementById('open-template-btn');
const templateModal = document.getElementById('template-modal');
const closeTemplateBtn = document.getElementById('close-template-btn');
const templateCards = document.querySelectorAll('.template-card[data-template]');

// Starter cards load Markdown from /templates/*.md — the same files that live
// in the public GitHub repo — so the studio and the repository never drift.
const STARTER_TEMPLATE_FILES = Object.freeze({
  math: '/templates/math.md',
  python: '/templates/python.md',
  'data-science': '/templates/data-science.md',
  marvel: '/templates/marvel.md',
  music: '/templates/music.md',
  history: '/templates/history.md',
  'survey-food': '/templates/survey-food.md',
  'survey-movies': '/templates/survey-movies.md',
  'survey-sports': '/templates/survey-sports.md'
});

// 'quiz' | 'survey' — set from Host Home; default quiz for trial.
let studioMode = 'quiz';

let previewQuizData = null;
let previewCurrentQuestionIndex = 0;

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
const sidekicksToggle = document.getElementById('sidekicks-toggle');
const autopilotToggle = document.getElementById('autopilot-toggle');
const autopilotPause = document.getElementById('autopilot-pause');
const startBtn = document.getElementById('start-btn');
const nextBtn = document.getElementById('next-btn');
const nextBtnLabel = document.getElementById('next-btn-label');
const endQuestionBtn = document.getElementById('end-question-btn');
const showResultsBtn = document.getElementById('show-results-btn');
const endSessionBtn = document.getElementById('end-session-btn');
autopilotPause.disabled = true;

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
const liveResultsEyebrow = document.getElementById('live-results-eyebrow');
const liveResultsTitle = document.getElementById('live-results-title');
const quizLiveResults = document.getElementById('quiz-live-results');
const surveyLiveResults = document.getElementById('survey-live-results');
const liveWorkspace = document.getElementById('live-workspace');
const liveLobbyPanel = document.getElementById('live-lobby-panel');
const liveLobbyEyebrow = document.getElementById('live-lobby-eyebrow');
const liveLobbyTitle = document.getElementById('live-lobby-title');
const liveLobbyCopy = document.getElementById('live-lobby-copy');
const liveSectionPanel = document.getElementById('live-section-panel');
const liveSectionEyebrow = document.getElementById('live-section-eyebrow');
const liveSectionTitle = document.getElementById('live-section-title');
const liveSectionSubtitle = document.getElementById('live-section-subtitle');
const answerProgressBar = document.getElementById('answer-progress-bar');
const participantEmptyState = document.getElementById('participant-empty-state');
const copySessionCodeBtn = document.getElementById('copy-session-code-btn');
const copyJoinUrlBtn = document.getElementById('copy-join-url-btn');

// Analytics elements
const analyticsBtn = document.getElementById('analytics-btn');
const analyticsSection = document.getElementById('analytics-section');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const analyticsTabs = document.querySelectorAll('.tab-btn');
const analyticsOverview = document.getElementById('analytics-overview');
const analyticsSessions = document.getElementById('analytics-sessions');
const analyticsSessionsBody = document.getElementById('analytics-sessions-body');
const noSessionsMsg = document.getElementById('no-sessions-msg');
const sessionSearchInput = document.getElementById('session-search-input');
const analyticsEmptyState = document.getElementById('analytics-empty-state');
const analyticsDataContent = document.getElementById('analytics-data-content');
const analyticsEmptyHostBtn = document.getElementById('analytics-empty-host-btn');

// Analytics stats elements
const totalSessionsStat = document.getElementById('total-sessions-stat');
const completedSessionsStat = document.getElementById('completed-sessions-stat');
const quizSessionsStat = document.getElementById('quiz-sessions-stat');
const surveySessionsStat = document.getElementById('survey-sessions-stat');
const surveyResponsesStat = document.getElementById('survey-responses-stat');
const totalParticipantsStat = document.getElementById('total-participants-stat');
const avgScoreStat = document.getElementById('avg-score-stat');
const totalCoursesStat = document.getElementById('total-courses-stat');

// Session detail elements
const sessionDetailSection = document.getElementById('session-detail-section');
const backToAnalyticsBtn = document.getElementById('back-to-analytics-btn');
const detailQuizTitle = document.getElementById('detail-quiz-title');
const exportCsvBtn = document.getElementById('export-csv-btn');
const detailParticipants = document.getElementById('detail-participants');
const detailAvgScore = document.getElementById('detail-avg-score');
const detailQuestions = document.getElementById('detail-questions');
const detailParticipantsLabel = document.getElementById('detail-participants-label');
const detailPrimaryLabel = document.getElementById('detail-primary-label');
const detailSecondaryLabel = document.getElementById('detail-secondary-label');
const detailCompletionRate = document.getElementById('detail-completion-rate');
const detailDropoffNote = document.getElementById('detail-dropoff-note');
const questionBreakdownBody = document.getElementById('question-breakdown-body');
const rankingParticipantsBody = document.getElementById('ranking-participants-body');
const rankingThresholdNote = document.getElementById('ranking-threshold-note');
const rankingCountBadge = document.getElementById('ranking-count-badge');
const noRankingMsg = document.getElementById('no-ranking-msg');

// State
let socket = null;
let currentQuiz = null;
let currentQuestion = null;
let timerInterval = null;
let sessionCode = null;
let viewingSessionCode = null; // For analytics detail view
let currentSessionsFilter = 'all'; // For sessions list filtering ('all', 'ended', 'incomplete')
let trialExpiresAt = null;
let trialCountdownInterval = null;
let autopilotCountdownInterval = null;

// Chart instances (for cleanup on re-render)
let scoreDistributionChart = null;
let questionDifficultyChart = null;

// Keep-alive: prevents Render free-tier from sleeping the dyno mid-quiz.
// HTTP requests every 10 minutes while a session is active.
let keepAliveInterval = null;

function updateResponseProgress(answered = Number(answersReceived?.textContent || 0), total = Number(totalParticipants?.textContent || 0)) {
  const safeTotal = Number.isFinite(total) ? total : 0;
  const safeAnswered = Number.isFinite(answered) ? answered : 0;
  const percent = safeTotal > 0 ? Math.min(100, Math.round((safeAnswered / safeTotal) * 100)) : 0;

  if (answerProgressBar) {
    answerProgressBar.style.width = `${percent}%`;
  }
  if (participantEmptyState) {
    participantEmptyState.classList.toggle('hidden', safeTotal > 0);
  }
}

function stopAutopilotCountdown() {
  clearInterval(autopilotCountdownInterval);
  autopilotCountdownInterval = null;
  if (nextBtnLabel) nextBtnLabel.textContent = 'Next question';
}

function startAutopilotCountdown(nextInMs) {
  stopAutopilotCountdown();
  if (!nextInMs || nextInMs <= 0) return;

  let remaining = Math.ceil(nextInMs / 1000);
  nextBtnLabel.textContent = `Next question (${remaining})`;

  autopilotCountdownInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      stopAutopilotCountdown();
      return;
    }
    nextBtnLabel.textContent = `Next question (${remaining})`;
  }, 1000);
}

function sendAutopilotSetting() {
  if (!socket || !sessionCode) return;
  socket.emit('set_autopilot', {
    sessionCode,
    enabled: autopilotToggle.checked,
    pauseSeconds: Number(autopilotPause.value)
  });
}

function setLobbyPanel(mode = 'ready') {
  const content = mode === 'complete'
    ? {
        eyebrow: 'Mash complete',
        title: 'The presenter is revealing the final leaderboard.',
        copy: 'Use “Show final results” for the host table, or keep the shared screen on the podium and hardest-question recap.'
      }
    : isTrialMode()
      ? {
          eyebrow: 'Practice room ready',
          title: 'Open the participant view and play along.',
          copy: 'Join with a nickname in another tab, return here, then start the quiz. Open the presenter to see the classroom display.'
        }
    : {
        eyebrow: 'Room ready',
        title: 'Invite participants, then start when everyone is in.',
        copy: 'The participant list updates live. Open the presenter on the screen your class can see.'
      };

  liveLobbyEyebrow.textContent = content.eyebrow;
  liveLobbyTitle.textContent = content.title;
  liveLobbyCopy.textContent = content.copy;
}

async function copyText(value, button, successLabel) {
  if (!value) return;

  const originalMarkup = button.innerHTML;
  try {
    await navigator.clipboard.writeText(value);
    button.innerHTML = `<svg aria-hidden="true"><use href="/assets/icons.svg#check-circle"></use></svg>${successLabel}`;
    setTimeout(() => {
      button.innerHTML = originalMarkup;
    }, 1800);
  } catch (err) {
    window.prompt('Copy this value:', value);
  }
}

function startKeepAlive() {
  stopKeepAlive();
  if (isTrialMode()) return;
  keepAliveInterval = setInterval(() => {
    if (sessionCode) {
      authFetch('/api/admin/ping').catch(() => { });
    }
  }, 10 * 60 * 1000); // 10 minutes
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

function isTrialMode() {
  return currentAdmin?.role === 'trial';
}

function updateInstructorHome() {
  const displayName = String(currentAdmin?.displayName || '').trim();
  const firstName = displayName.split(/\s+/)[0];
  instructorHomeWelcome.textContent = firstName
    ? `Welcome back, ${firstName}. Choose where you want to begin.`
    : 'Choose where you want to begin.';

  const hasLiveRoom = Boolean(sessionCode);
  homeHostTitle.textContent = hasLiveRoom ? 'Return to your live room' : 'Host a quiz';
  homeHostCopy.textContent = hasLiveRoom
    ? `Room ${sessionCode} is still open and ready for you.`
    : 'Load your Markdown questions and open a live Mash for your group.';
  homeHostAction.firstChild.textContent = hasLiveRoom ? 'Open control room ' : 'Build your Mash ';
}

function showInstructorHome() {
  if (isTrialMode()) {
    showInstructorStudio();
    return;
  }

  uploadSection.classList.add('hidden');
  liveWorkspace.classList.add('hidden');
  analyticsSection.classList.add('hidden');
  sessionDetailSection.classList.add('hidden');
  instructorHomeSection.classList.remove('hidden');
  studioTitleLabel.textContent = 'Host home';
  updateInstructorHome();
}

function applyStudioModeCopy() {
  const survey = studioMode === 'survey';
  if (builderEyebrow) builderEyebrow.textContent = survey ? 'New survey session' : 'New live session';
  if (builderHeading) builderHeading.textContent = survey ? 'Build your next survey' : 'Build your next Mash';
  if (builderDescription) {
    builderDescription.textContent = survey
      ? 'Paste Markdown options (no scores). Answers stay anonymous.'
      : 'Paste a Markdown quiz, preview it, then open the room.';
  }
  if (builderCardHeading) builderCardHeading.textContent = survey ? 'Survey Markdown' : 'Quiz Markdown';
  if (builderCardDescription) {
    builderCardDescription.textContent = survey
      ? 'Questions and options only — no correctness marks needed.'
      : 'Questions, options, timers and scoring stay in one readable file.';
  }
  if (uploadBtnLabel) {
    uploadBtnLabel.textContent = survey ? 'Open survey room' : 'Open room';
  }
  if (quizMarkdown && !quizMarkdown.value.trim()) {
    quizMarkdown.placeholder = survey
      ? `# Pulse check

# Section: Warm-up
> Optional subtitle

## How was the pace today?
- Just right
- A bit fast
- A bit slow
::time=20

## What should we revisit?
- Recursion
- Debugging
- Testing
::time=25`
      : quizMarkdown.getAttribute('placeholder') || quizMarkdown.placeholder;
  }
}

function showInstructorStudio(mode) {
  if (mode === 'survey' || mode === 'quiz') {
    studioMode = mode;
  }
  if (isTrialMode()) studioMode = 'quiz';
  applyStudioModeCopy();

  instructorHomeSection.classList.add('hidden');
  analyticsSection.classList.add('hidden');
  sessionDetailSection.classList.add('hidden');
  if (sessionCode) {
    uploadSection.classList.add('hidden');
    liveWorkspace.classList.remove('hidden');
  } else {
    liveWorkspace.classList.add('hidden');
    uploadSection.classList.remove('hidden');
  }
  studioTitleLabel.textContent = isTrialMode()
    ? 'Guest studio'
    : (studioMode === 'survey' ? 'Survey studio' : 'Host studio');
}

function sessionApiPath(suffix = '') {
  const base = isTrialMode() ? '/api/trial/session' : '/api/admin/session';
  return `${base}${suffix}`;
}

function showAuthenticatedWorkspace() {
  loginSection.classList.add('hidden');
  inviteSection?.classList.add('hidden');
  signupSection?.classList.add('hidden');
  dashboardSection.classList.remove('hidden');
  logoutBtn.classList.remove('hidden');

  const trialMode = isTrialMode();
  analyticsBtn.classList.toggle('hidden', trialMode);
  settingsBtn.classList.toggle('hidden', trialMode);
  trialBanner.classList.toggle('hidden', !trialMode);
  trialCompletionCta.classList.add('hidden');

  const logoutLabel = logoutBtn.querySelector('span');
  if (logoutLabel) logoutLabel.textContent = trialMode ? 'Leave trial' : 'Logout';
  if (studioTitle && studioTitleLabel) {
    studioTitleLabel.textContent = trialMode ? 'Guest studio' : 'Host studio';
  }

  if (trialMode) {
    showInstructorStudio();
  } else {
    showInstructorHome();
  }
}

function configureInstructorWorkspace() {
  quizMarkdown.readOnly = false;
  courseNameInput.classList.remove('hidden');
  trialBanner.classList.add('hidden');
  trialCompletionCta.classList.add('hidden');
  builderEyebrow.textContent = 'New live session';
  builderHeading.textContent = 'Build your next Mash';
  builderDescription.textContent = 'Paste a Markdown quiz, preview it, then open the room.';
  builderCardHeading.textContent = 'Quiz Markdown';
  builderCardDescription.textContent = 'Questions, options, timers and scoring stay in one readable file.';
  uploadBtnLabel.textContent = 'Load quiz';
  openTemplateBtn.classList.remove('hidden');

  window.MarkdownMashSettings.resetForAccount(
    { settingsModal, settingsTabs, settingsPanels, instructorList },
    { hostedAuthMode, billingEnabled, admin: currentAdmin }
  );
}

function configureTrialWorkspace(data) {
  currentAdmin = {
    id: data.trial.id,
    role: 'trial',
    displayName: 'Guest'
  };
  trialExpiresAt = Number(data.trial.expiresAt);
  quizMarkdown.value = data.template.markdown;
  quizMarkdown.readOnly = true;
  courseNameInput.value = '';
  courseNameInput.classList.add('hidden');
  builderEyebrow.textContent = 'Temporary playground';
  builderHeading.textContent = 'Your practice room is ready.';
  builderDescription.textContent = 'Preview the sample, launch it, then join from another tab to experience both sides.';
  builderCardHeading.textContent = data.template.title || 'Mini Mash: Quick Wins';
  builderCardDescription.textContent = `${data.template.questionCount} quick questions · Nothing is saved`;
  uploadBtnLabel.textContent = 'Launch practice room';
  openTemplateBtn.classList.add('hidden');
  showAuthenticatedWorkspace();
  startTrialCountdown();
}

function stopTrialCountdown() {
  if (trialCountdownInterval) {
    clearInterval(trialCountdownInterval);
    trialCountdownInterval = null;
  }
}

function startTrialCountdown() {
  stopTrialCountdown();

  const renderCountdown = () => {
    const remainingMs = Math.max(0, trialExpiresAt - Date.now());
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    trialCountdown.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;

    if (remainingMs <= 0) {
      stopTrialCountdown();
      handleTrialExpired('Your temporary practice room has expired.');
    }
  };

  renderCountdown();
  trialCountdownInterval = setInterval(renderCountdown, 1000);
}

function clearTrialCredentials() {
  sessionStorage.removeItem('trialToken');
  sessionStorage.removeItem('trialPrincipal');
  stopTrialCountdown();
  trialExpiresAt = null;
}

function handleTrialExpired(message) {
  clearTrialCredentials();
  authToken = null;
  currentAdmin = null;
  resetToUploadState();
  dashboardSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
  trialBanner.classList.add('hidden');
  if (message) showError(loginError, message);
}

async function loadTrialAvailability() {
  try {
    const res = await fetch('/api/trial/config');
    const data = await res.json();
    trialEntry.classList.toggle('hidden', !data.enabled);
    if (data.enabled && data.ttlMinutes) {
      const note = trialEntry.querySelector('p');
      note.textContent = `No account needed · Temporary ${data.ttlMinutes}-minute room`;
    }
  } catch (error) {
    trialEntry.classList.add('hidden');
  }
}

loadTrialAvailability();

function closeTemplateModal() {
  templateModal.classList.add('hidden');
}

openTemplateBtn?.addEventListener('click', () => {
  const kind = studioMode === 'survey' ? 'survey' : 'quiz';
  templateCards.forEach(card => {
    const cardKind = card.dataset.templateKind || 'quiz';
    card.classList.toggle('hidden', cardKind !== kind);
  });
  const title = document.getElementById('template-modal-title');
  if (title) {
    title.textContent = kind === 'survey' ? 'Choose a starter survey' : 'Choose a starter Mash';
  }
  templateModal.classList.remove('hidden');
  const firstTemplate = templateCards[0];
  firstTemplate?.focus({ preventScroll: true });
});

closeTemplateBtn?.addEventListener('click', closeTemplateModal);

templateModal?.addEventListener('click', event => {
  if (event.target === templateModal) closeTemplateModal();
});

templateCards.forEach(card => {
  card.addEventListener('click', async () => {
    const templateKey = card.dataset.template;
    const templateUrl = STARTER_TEMPLATE_FILES[templateKey];
    if (!templateUrl) return;
    if (quizMarkdown.value.trim()) {
      const confirmed = await showConfirmModal({
        title: 'Replace Markdown',
        message: 'Replace the Markdown currently in the editor with this starter template?',
        confirmText: 'Replace'
      });
      if (!confirmed) return;
    }

    card.disabled = true;
    try {
      const response = await fetch(templateUrl, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Could not load template (${response.status})`);
      }
      const markdown = await response.text();
      if (!markdown.trim()) {
        throw new Error('Template file was empty');
      }
      quizMarkdown.value = markdown;
      closeTemplateModal();
      showStatus('upload-status', 'Starter template loaded. Edit anything you like, then preview your questions.', true);
      quizMarkdown.focus({ preventScroll: true });
    } catch (error) {
      console.error('Starter template load failed:', error);
      showStatus(
        'upload-status',
        'Could not load that starter template. Check your connection and try again.',
        false
      );
    } finally {
      card.disabled = false;
    }
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !templateModal?.classList.contains('hidden')) {
    closeTemplateModal();
  }
});

async function loadAuthConfig() {
  try {
    const response = await fetch('/api/admin/auth/config');
    const data = await response.json();
    hostedAuthMode = Boolean(data.hostedMode && data.emailLogin);
    billingEnabled = Boolean(data.billingEnabled);
    invitationActivationEnabled = Boolean(data.invitationActivation);
    publicSignupEnabled = Boolean(data.publicRegistration || data.publicSignup);
  } catch (error) {
    hostedAuthMode = false;
    billingEnabled = false;
    invitationActivationEnabled = false;
    publicSignupEnabled = false;
  }

  loginEmailField.classList.toggle('hidden', !hostedAuthMode);
  loginRecoveryHelp.classList.toggle('hidden', hostedAuthMode);
  loginAccountContext.setAttribute(
    'aria-label',
    hostedAuthMode ? 'Account type: hosted account' : 'Account type: single-host deployment'
  );
  loginAccountTitle.textContent = hostedAuthMode ? 'Markdown Mash Hosted' : 'Host workspace';
  loginAccountDetail.textContent = hostedAuthMode ? 'Email-secured host account' : 'Single-host deployment';
  passwordInput.placeholder = hostedAuthMode ? 'Enter your account password' : 'Enter the deployment password';
  signupEntry?.classList.toggle('hidden', !publicSignupEnabled);
}

const authConfigReady = loadAuthConfig();

createAccountBtn?.addEventListener('click', () => {
  loginSection.classList.add('hidden');
  signupSection.classList.remove('hidden');
  document.getElementById('signup-name').focus({ preventScroll: true });
});

document.getElementById('signup-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const displayName = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const button = document.getElementById('signup-submit-btn');
  button.disabled = true;
  button.textContent = 'Sending…';
  hideStatus('signup-status');
  try {
    const response = await fetch('/api/admin/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to register right now');
    showStatus('signup-status', data.message, true);
    form.reset();
  } catch (error) {
    showStatus('signup-status', error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = 'Email my verification link';
  }
});

async function initializeInviteActivation() {
  if (!hostedInvitationToken) return;
  await authConfigReady;

  loginSection.classList.add('hidden');
  inviteSection.classList.remove('hidden');
  const heading = document.getElementById('invite-heading');
  const accountCopy = document.getElementById('invite-account-copy');
  const form = document.getElementById('invite-activation-form');

  if (!invitationActivationEnabled) {
    heading.textContent = 'Invitations are not enabled';
    accountCopy.textContent = 'This deployment is not accepting hosted account invitations.';
    showStatus('invite-status', 'Ask the person who shared this link to check the deployment.', false);
    return;
  }

  try {
    const response = await fetch('/api/admin/invite/inspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: hostedInvitationToken })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'This invitation is invalid or expired');

    heading.textContent = `Welcome, ${data.invitation.displayName}`;
    accountCopy.textContent = `${data.invitation.maskedEmail} · Link expires ${billingDate(data.invitation.expiresAt)}`;
    form.classList.remove('hidden');
    document.getElementById('invite-password').focus({ preventScroll: true });
  } catch (error) {
    heading.textContent = 'This invitation cannot be used';
    accountCopy.textContent = 'It may have expired, already been activated, or been replaced by a newer link.';
    showStatus('invite-status', error.message, false);
  }
}

document.getElementById('invite-activation-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const password = document.getElementById('invite-password').value;
  const confirmation = document.getElementById('invite-confirm-password').value;
  const button = document.getElementById('activate-invite-btn');

  if (password !== confirmation) {
    showStatus('invite-status', 'Passwords do not match', false);
    return;
  }
  if (password.length < 12) {
    showStatus('invite-status', 'Password must be at least 12 characters', false);
    return;
  }
  if (new TextEncoder().encode(password).length > 72) {
    showStatus('invite-status', 'Password must be 72 bytes or fewer', false);
    return;
  }

  button.disabled = true;
  button.textContent = 'Activating…';
  hideStatus('invite-status');
  try {
    const response = await fetch('/api/admin/invite/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: hostedInvitationToken, password })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to activate this invitation');

    hostedInvitationToken = null;
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}`);
    if (data.checkoutAfterActivation) {
      const loginResponse = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email, password })
      });
      const loginData = await loginResponse.json();
      if (loginResponse.ok && loginData.success) {
        authToken = loginData.token;
        currentAdmin = loginData.admin;
        const checkoutResponse = await authFetch('/api/admin/billing/checkout', { method: 'POST' });
        const checkoutData = await checkoutResponse.json();
        if (checkoutResponse.ok && checkoutData.success && checkoutData.url) {
          localStorage.setItem('authToken', authToken);
          localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
          window.location.assign(checkoutData.url);
          return;
        }
        authToken = null;
        currentAdmin = null;
        data.message = 'Your account is ready. Sign in to start your $15/year subscription.';
      }
    }
    inviteSection.classList.add('hidden');
    loginSection.classList.remove('hidden');
    loginEmail.value = data.email;
    passwordInput.value = '';
    loginSuccess.textContent = data.message;
    loginSuccess.classList.remove('hidden');
    passwordInput.focus({ preventScroll: true });
  } catch (error) {
    showStatus('invite-status', error.message, false);
    button.disabled = false;
    button.textContent = 'Activate host account';
  }
});

initializeInviteActivation();

// Login
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  await authConfigReady;
  const password = passwordInput.value;
  const email = hostedAuthMode ? loginEmail.value.trim() : '';
  loginSuccess.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, email })
    });

    const data = await res.json();
    if (data.success) {
      clearTrialCredentials();
      // Store auth token
      authToken = data.token;
      currentAdmin = data.admin;
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));

      configureInstructorWorkspace();
      showAuthenticatedWorkspace();

      // If first login or no security questions, prompt to set them
      if (data.admin.authSource !== 'hosted'
        && (data.isFirstLogin || !data.admin.hasSecurityQuestions)) {
        setTimeout(() => {
          showNoticeModal('Welcome! Please set up security questions in Settings for password recovery.', 'Secure Your Account');
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

tryItOutBtn?.addEventListener('click', async () => {
  tryItOutBtn.disabled = true;
  const originalMarkup = tryItOutBtn.innerHTML;
  tryItOutBtn.textContent = 'Preparing your room…';

  try {
    const res = await fetch('/api/trial', { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Unable to start a practice room');
    }

    localStorage.removeItem('authToken');
    localStorage.removeItem('currentAdmin');
    authToken = data.token;
    sessionStorage.setItem('trialToken', data.token);
    sessionStorage.setItem('trialPrincipal', JSON.stringify({
      id: data.trial.id,
      role: 'trial',
      displayName: 'Guest'
    }));
    configureTrialWorkspace(data);
    builderHeading.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showError(loginError, error.message || 'Unable to start a practice room');
  } finally {
    tryItOutBtn.disabled = false;
    tryItOutBtn.innerHTML = originalMarkup;
  }
});

// Check for existing valid token on page load
async function checkExistingAuth() {
  await authConfigReady;
  if (hostedInvitationToken) return;
  if (!authToken) return;

  if (isTrialMode() || sessionStorage.getItem('trialToken')) {
    try {
      const res = await authFetch('/api/trial');
      if (res.ok) {
        const data = await res.json();
        configureTrialWorkspace(data);

        if (data.session) {
          const launchRes = await authFetch('/api/trial/session', { method: 'POST' });
          const launchData = await launchRes.json();
          if (launchData.success) {
            sessionCode = launchData.session.code;
            currentQuiz = launchData.session.quiz;
            showSessionInfo(launchData.session);
            initSocket(sessionCode);
          }
        }
        return;
      }
    } catch (err) {
      // The expiration state below will clear the temporary credentials.
    }
    handleTrialExpired();
    return;
  }

  try {
    const res = await authFetch('/api/admin/settings');
    if (res.ok) {
      const data = await res.json();
      currentAdmin = data.admin;
      localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
      configureInstructorWorkspace();
      showAuthenticatedWorkspace();
      return;
    }
  } catch (err) {
    // Token invalid, clear it below.
  }

  localStorage.removeItem('authToken');
  localStorage.removeItem('currentAdmin');
  authToken = null;
  currentAdmin = null;
}

// Run auth check on load
checkExistingAuth();

copySessionCodeBtn?.addEventListener('click', () => {
  copyText(sessionCodeEl.textContent.trim(), copySessionCodeBtn, 'Copied');
});

copyJoinUrlBtn?.addEventListener('click', () => {
  copyText(joinUrlLink.href, copyJoinUrlBtn, 'Link copied');
});

// Logout function
async function logout() {
  const prompt = isTrialMode()
    ? 'Leave this temporary trial? The practice room will no longer be available from this tab.'
    : 'Are you sure you want to logout?';
  const confirmed = await showConfirmModal({
    title: isTrialMode() ? 'Leave Trial' : 'Log Out',
    message: prompt,
    confirmText: isTrialMode() ? 'Leave Trial' : 'Log Out',
    cancelText: isTrialMode() ? 'Stay Here' : 'Stay Signed In'
  });
  if (!confirmed) return;

  clearTrialCredentials();
  authToken = null;
  currentAdmin = null;
  localStorage.removeItem('authToken');
  localStorage.removeItem('currentAdmin');
  loginSection.classList.remove('hidden');
  inviteSection?.classList.add('hidden');
  signupSection?.classList.add('hidden');
  dashboardSection.classList.add('hidden');
  analyticsBtn.classList.add('hidden');
  settingsBtn.classList.add('hidden');
  logoutBtn.classList.add('hidden');
  trialBanner.classList.add('hidden');
  resetToUploadState();
  configureInstructorWorkspace();

  // Clear password field
  passwordInput.value = '';
  loginEmail.value = '';
}

// Logout button click
logoutBtn.addEventListener('click', logout);

// Helper to make authenticated requests
async function authFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${authToken}`
  };
  return fetch(url, { ...options, headers });
}

function encodeMarkdownBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

// Reusable styled confirmation modal dialog
function showConfirmModal({
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  showCancel = true
} = {}) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-modal-title');
    const messageEl = document.getElementById('confirm-modal-message');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const okBtn = document.getElementById('confirm-modal-ok');
    const closeBtn = document.getElementById('confirm-modal-close');

    if (!modal) {
      resolve(false);
      return;
    }

    const previousFocus = document.activeElement;
    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmText;
    okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    cancelBtn.textContent = cancelText;
    cancelBtn.classList.toggle('hidden', !showCancel);

    function cleanup() {
      modal.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      okBtn.removeEventListener('click', onOk);
      closeBtn.removeEventListener('click', onCancel);
      modal.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKeydown);
      cancelBtn.classList.remove('hidden');
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    }

    function onCancel() {
      cleanup();
      resolve(false);
    }

    function onOk() {
      cleanup();
      resolve(true);
    }

    function onBackdrop(event) {
      if (event.target === modal) onCancel();
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [closeBtn, cancelBtn, okBtn].filter(button => !button.classList.contains('hidden'));
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    cancelBtn.addEventListener('click', onCancel);
    okBtn.addEventListener('click', onOk);
    closeBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKeydown);
    modal.classList.remove('hidden');
    (showCancel ? cancelBtn : okBtn).focus();
  });
}

function showNoticeModal(message, title = 'Markdown Mash') {
  return showConfirmModal({
    title,
    message,
    confirmText: 'OK',
    showCancel: false
  });
}

// Initialize Socket.IO for a specific session
function initSocket(code) {
  if (socket) {
    socket.disconnect();
  }

  socket = io({
    auth: {
      token: authToken
    }
  });
  let isFirstConnect = true;

  socket.on('connect', () => {
    socket.emit('admin_join', code);

    if (!isFirstConnect) {
      // Reconnected after a drop — verify the session is still alive on the server.
      // If the server restarted (Render sleep), the in-memory session will be gone.
      authFetch(isTrialMode() ? '/api/trial' : sessionApiPath(`/${code}`))
        .then(r => r.json())
        .then(data => {
          if (!data.success) {
            showSessionLostBanner(code);
          }
        })
        .catch(() => { });
    }
    isFirstConnect = false;
  });

  socket.on('participant_joined', (data) => {
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
    if (data.name) {
      addParticipantChip(data.name, data.id, data.avatarId);
    }
    updateResponseProgress(Number(answersReceived.textContent || 0), data.count);
  });

  socket.on('participant_roster', (data) => {
    participantList.innerHTML = '';
    (data.participants || []).forEach(participant => {
      addParticipantChip(participant.name, participant.id, participant.avatarId);
    });
    participantCount.textContent = data.count || 0;
    totalParticipants.textContent = data.count || 0;
    updateResponseProgress(Number(answersReceived.textContent || 0), data.count || 0);
  });

  socket.on('participant_avatar_updated', data => {
    const image = participantList.querySelector(`[data-id="${data.participantId}"] .participant-sidekick`);
    if (image && data.avatarId) image.src = sidekickAsset(data.avatarId, 128);
  });

  socket.on('sidekicks_setting_changed', data => {
    const enabled = data.enabled !== false;
    sidekicksToggle.checked = enabled;
    document.body.classList.toggle('sidekicks-disabled', !enabled);
  });

  socket.on('participant_kicked', (data) => {
    const chip = participantList.querySelector(`[data-id="${data.participantId}"]`);
    if (chip) chip.remove();
    participantCount.textContent = data.count;
    totalParticipants.textContent = data.count;
    updateResponseProgress(Number(answersReceived.textContent || 0), data.count);
  });

  socket.on('quiz_started', (data) => {
    quizStatus.textContent = 'Running';
    quizStatus.className = 'badge badge-success';
    startBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    endSessionBtn.classList.add('hidden');
    questionSection.classList.add('hidden');
    liveLobbyPanel.classList.remove('hidden');
  });

  socket.on('section_started', (data) => {
    stopAutopilotCountdown();

    liveSectionEyebrow.textContent = `Section ${data.stepNumber} of ${data.totalSections}`;
    liveSectionTitle.textContent = data.title;
    liveSectionSubtitle.textContent = data.subtitle || '';
    liveSectionSubtitle.classList.toggle('hidden', !data.subtitle);

    liveLobbyPanel.classList.add('hidden');
    questionSection.classList.add('hidden');
    liveSectionPanel.classList.remove('hidden');

    nextBtn.classList.remove('hidden');
    endQuestionBtn.classList.add('hidden');

    if (data.autopilotNextInMs) startAutopilotCountdown(data.autopilotNextInMs);
  });

  socket.on('question_started', (data) => {
    stopAutopilotCountdown();
    currentQuestion = data.question;
    showQuestion(data);
    startTimer(data.timeRemaining);
    answersReceived.textContent = '0';
    updateResponseProgress(0, Number(totalParticipants.textContent || 0));

    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.remove('hidden');
    questionSection.classList.remove('hidden');
    liveLobbyPanel.classList.add('hidden');
    liveSectionPanel.classList.add('hidden');
  });

  socket.on('answer_received', (data) => {
    answersReceived.textContent = data.answeredCount;
    updateResponseProgress(data.answeredCount, data.totalParticipants);
  });

  socket.on('question_ended', (data) => {
    clearInterval(timerInterval);
    endQuestionBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');

    if (data.mode === 'survey') {
      answersReceived.textContent = data.answered || 0;
      updateResponseProgress(data.answered || 0, data.totalParticipants || 0);
    } else {
      const optionBtns = optionsDisplay.querySelectorAll('.option-btn');
      optionBtns.forEach((btn, i) => {
        if (data.correctIndices.includes(i)) btn.classList.add('correct');
      });
    }

    startAutopilotCountdown(data.autopilotNextInMs);
  });

  socket.on('autopilot_changed', (data) => {
    autopilotToggle.checked = data.enabled === true;
    autopilotPause.value = String(data.pauseSeconds);
    autopilotPause.disabled = !autopilotToggle.checked;
    if (!data.enabled) stopAutopilotCountdown();
  });

  socket.on('all_answered', () => {
    clearInterval(timerInterval);
  });

  socket.on('quiz_ended', (data) => {
    stopAutopilotCountdown();
    quizStatus.textContent = 'Ended';
    quizStatus.className = 'badge badge-warning';
    questionSection.classList.add('hidden');
    setLobbyPanel('complete');
    liveLobbyPanel.classList.remove('hidden');
    nextBtn.classList.add('hidden');
    endQuestionBtn.classList.add('hidden');
    showResultsBtn.classList.remove('hidden');
    showResultsBtn.textContent = data?.mode === 'survey' ? 'View survey summary' : 'Show final results';
    endSessionBtn.classList.remove('hidden');
  });

  socket.on('session_ended', (data) => {
    // Only show alert and reset if it's an intentional end (has a code field)
    // or if we're not mid-quiz (avoids false positives on reconnections)
    showNoticeModal(data.message || 'Session has ended', 'Session Ended');
    resetToUploadState();
  });

  socket.on('trial_expired', (data) => {
    handleTrialExpired(data?.message || 'Your temporary practice room has expired.');
  });

  socket.on('control_error', (data) => {
    showNoticeModal(data?.message || 'You do not have permission to control this session.', 'Control Unavailable');
  });

  socket.on('connect_error', (error) => {
    if (isTrialMode() && /auth|expired/i.test(error.message || '')) {
      handleTrialExpired('Your temporary practice room has expired.');
    }
  });
}

// Show a non-destructive warning banner when the server lost the session in memory
function showSessionLostBanner(code) {
  // Don't show duplicate banners
  if (document.getElementById('session-lost-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'session-lost-banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
    'background:#dc2626', 'color:#fff', 'padding:12px 20px',
    'font-size:15px', 'display:flex', 'align-items:center', 'gap:12px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.4)'
  ].join(';');

  banner.innerHTML = `
    <span><svg class="banner-icon" aria-hidden="true"><use href="/assets/icons.svg#target-alert"></use></svg>
    <strong>Server restarted — session state was lost.</strong>
    Participants have been disconnected. Your quiz answers are saved in the database.</span>
    <button id="recover-session-btn" style="
      margin-left:auto; background:#fff; color:#dc2626;
      border:none; border-radius:6px; padding:6px 14px;
      font-weight:bold; cursor:pointer; font-size:14px;
    ">Recover Stats</button>
    <button id="dismiss-banner-btn" style="
      background:transparent; color:#fff; border:1px solid rgba(255,255,255,0.5);
      border-radius:6px; padding:6px 12px; cursor:pointer; font-size:14px;
    ">Dismiss</button>
  `;

  document.body.prepend(banner);

  document.getElementById('dismiss-banner-btn').addEventListener('click', () => banner.remove());

  document.getElementById('recover-session-btn').addEventListener('click', async () => {
    const btn = document.getElementById('recover-session-btn');
    btn.disabled = true;
    btn.textContent = 'Recovering...';
    try {
      const res = await authFetch(`/api/admin/session/${code}/recover`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        banner.style.background = '#16a34a';
        banner.querySelector('span').innerHTML = `
          <svg class="banner-icon" aria-hidden="true"><use href="/assets/icons.svg#check-circle"></use></svg>
          <strong>Session recovered!</strong>
          ${data.participantsRecovered} participants, ${data.answersFound} answers restored.
          Check Analytics → Sessions to view results.
        `;
        document.getElementById('dismiss-banner-btn').textContent = 'OK';
        btn.remove();
      } else {
        btn.textContent = 'Recovery Failed';
        showNoticeModal('Recovery failed: ' + data.error, 'Recovery Failed');
      }
    } catch (err) {
      btn.textContent = 'Recovery Failed';
      showNoticeModal('Network error during recovery', 'Recovery Failed');
    }
  });
}

// Upload Quiz - Now creates a session
uploadBtn.addEventListener('click', async () => {
  const markdown = quizMarkdown.value.trim();
  const courseName = courseNameInput.value.trim();
  if (!markdown) return;

  try {
    uploadBtn.disabled = true;
    uploadStatus.textContent = 'Creating session...';
    uploadStatus.style.color = '';
    uploadStatus.classList.remove('hidden');

    const requestBody = isTrialMode()
      ? { markdown, courseName, sessionType: 'quiz' }
      : {
          markdownBase64: encodeMarkdownBase64(markdown),
          courseName,
          sessionType: studioMode
        };

    const res = await authFetch(
      isTrialMode() ? '/api/trial/session' : '/api/admin/session',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    if (res.status === 401) {
      uploadStatus.textContent = 'Session expired. Please log in again.';
      uploadStatus.style.color = 'var(--danger)';
      return;
    }

    const data = await res.json().catch(() => null);
    if (res.status === 403) {
      uploadStatus.textContent = data?.error
        || 'The request was refused before Markdown Mash could process it. Reload and try again.';
      uploadStatus.style.color = 'var(--danger)';
      return;
    }
    if (!data) {
      uploadStatus.textContent = `Server error (${res.status}). Please try again.`;
      uploadStatus.style.color = 'var(--danger)';
      return;
    }

    if (data.success) {
      sessionCode = data.session.code;
      currentQuiz = data.session.quiz;

      // Show session info
      showSessionInfo(data.session);

      // Initialize socket for this session
      initSocket(sessionCode);

      // Start keep-alive pings to prevent Render free-tier from sleeping mid-quiz
      startKeepAlive();

      uploadStatus.innerHTML = '';
      const statusBadge = document.createElement('span');
      statusBadge.className = 'badge badge-success';
      statusBadge.textContent = isTrialMode()
        ? 'Practice room ready!'
        : (data.session.sessionType === 'survey' ? 'Survey room ready!' : 'Session created!');
      uploadStatus.appendChild(statusBadge);
      uploadStatus.style.color = '';
      uploadStatus.classList.remove('hidden');
    } else {
      if (res.status === 409 && data.code === 'HOSTED_ROOM_LIMIT') {
        uploadStatus.innerHTML = `You already have an open room (${data.activeSession ? data.activeSession.code : 'active'}). End or recover it first.`;
      } else {
        uploadStatus.textContent = data.error || 'Unable to load quiz';
      }
      uploadStatus.style.color = 'var(--danger)';
      uploadStatus.classList.remove('hidden');
    }
  } catch (err) {
    uploadStatus.textContent = 'Connection error. Please check your network and try again.';
    uploadStatus.style.color = 'var(--danger)';
    uploadStatus.classList.remove('hidden');
  } finally {
    uploadBtn.disabled = false;
  }
});

// Preview Logic
previewBtn.addEventListener('click', () => {
  const markdown = quizMarkdown.value.trim();
  if (!markdown) {
    showNoticeModal('Please enter some Markdown to preview.', 'Nothing to Preview');
    return;
  }
  
  // Reuse the parseQuizMarkdown logic if possible, or just parse locally
  // Since we want to preview it, we should use the same logic
  // Let's implement a lightweight local parser
  previewQuizData = studioMode === 'survey' && typeof parseSurveyMarkdownLocal === 'function'
    ? parseSurveyMarkdownLocal(markdown)
    : parseQuizMarkdownLocal(markdown);

  if (previewQuizData.steps.length === 0) {
    showNoticeModal('No valid questions were found in the Markdown.', 'Check Your Markdown');
    return;
  }

  previewCurrentQuestionIndex = 0;
  previewModal.classList.remove('hidden');
  renderPreviewQuestion();
});

closePreviewBtn.addEventListener('click', () => {
  closePreview();
});

previewModal.addEventListener('click', (event) => {
  if (event.target === previewModal) {
    closePreview();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !previewModal.classList.contains('hidden')) {
    closePreview();
  }
});

function closePreview() {
  previewModal.classList.add('hidden');
  previewBtn.focus();
}

previewNextBtn.addEventListener('click', () => {
  if (previewCurrentQuestionIndex < previewQuizData.steps.length - 1) {
    previewCurrentQuestionIndex++;
    renderPreviewQuestion();
  }
});

previewPrevBtn.addEventListener('click', () => {
  if (previewCurrentQuestionIndex > 0) {
    previewCurrentQuestionIndex--;
    renderPreviewQuestion();
  }
});

// Renders the current preview step: a section card for kind === 'section',
// or the question card (with the ungraded badge) for kind === 'question'.
function renderPreviewQuestion() {
  const step = previewQuizData.steps[previewCurrentQuestionIndex];

  if (step.kind === 'section') {
    renderPreviewSectionCard(step);
  } else {
    renderPreviewQuestionCard(previewQuizData.questions[step.questionIndex]);
  }

  previewPrevBtn.disabled = previewCurrentQuestionIndex === 0;
  previewNextBtn.disabled = previewCurrentQuestionIndex === previewQuizData.steps.length - 1;
}

function renderPreviewSectionCard(step) {
  previewPlayerHeader.classList.add('hidden');
  previewQuestionText.classList.add('hidden');
  previewOptionsContainer.classList.add('hidden');
  previewSectionCard.classList.remove('hidden');

  const sections = previewQuizData.steps.filter(s => s.kind === 'section');
  const ordinal = sections.indexOf(step) + 1;

  // Section titles/subtitles are host-authored text — textContent only.
  previewSectionEyebrow.textContent = `Section ${ordinal} of ${sections.length}`;
  previewSectionTitle.textContent = step.title;
  previewSectionSubtitle.textContent = step.subtitle || '';
  previewSectionSubtitle.classList.toggle('hidden', !step.subtitle);
}

function renderPreviewQuestionCard(q) {
  previewSectionCard.classList.add('hidden');
  previewPlayerHeader.classList.remove('hidden');
  previewQuestionText.classList.remove('hidden');
  previewOptionsContainer.classList.remove('hidden');

  const qnumLabel = document.getElementById('preview-qnum-label');
  const isSurveyPreview = previewQuizData.sessionKind === 'survey' || q.type === 'survey';
  if (isSurveyPreview) {
    qnumLabel.innerHTML = 'Q<span id="preview-q-num"></span>/<span id="preview-total-q-num"></span>';
    document.getElementById('preview-q-num').textContent = q.displayNumber || (previewQuizData.questions.indexOf(q) + 1);
    document.getElementById('preview-total-q-num').textContent = previewQuizData.questions.length;
  } else if (q.type === 'ungraded') {
    qnumLabel.textContent = '⭐ Just for fun · no points';
  } else {
    qnumLabel.innerHTML = 'Q<span id="preview-q-num"></span>/<span id="preview-total-q-num"></span>';
    // Match the live room: gradedNumber and graded-only denominator, never raw position.
    document.getElementById('preview-q-num').textContent = q.gradedNumber;
    document.getElementById('preview-total-q-num').textContent =
      previewQuizData.questions.filter(qq => qq.type === 'graded').length;
  }

  previewQuestionText.innerHTML = markdown.block(q.text);

  previewOptionsContainer.innerHTML = '';
  q.options.forEach((opt, idx) => {
    const div = document.createElement('div');
    const isCorrect = !isSurveyPreview && q.correctIndices.includes(idx);
    div.className = `preview-option${isCorrect ? ' preview-option-correct' : ''}`;
    div.innerHTML = `
      <span class="preview-option-letter">${String.fromCharCode(65 + idx)}</span>
      <span>${markdown.inline(opt)}</span>
      ${isCorrect ? '<svg aria-label="Correct answer"><use href="/assets/icons.svg#check-circle"></use></svg>' : ''}
    `;
    previewOptionsContainer.appendChild(div);
  });
}

// parseQuizMarkdownLocal now lives in public/js/quiz-preview-parser.js
// (loaded before this script) so it can be required from node for
// test-preview-parser-drift.js, which guards it against diverging from the
// server's parser in quiz-structure.js.

// Show session info after creation
function showSessionInfo(session) {
  quizTitle.textContent = session.quiz.title || 'Untitled Quiz';
  questionCount.textContent = session.quiz.questions.length;
  totalQNum.textContent = session.quiz.questions.length;

  sessionCodeEl.textContent = session.code;
  joinUrlLink.href = session.joinUrl;

  // Show QR code
  if (session.qrCode) {
    qrCodeImg.src = session.qrCode;
    qrCodeImg.style.display = 'block';
  }

  // Presenter access is a signed, session-bound capability returned only to the host.
  presenterUrl.href = session.presenterUrl || '#';
  presenterUrl.classList.toggle('disabled', !session.presenterUrl);

  // Clear participant list
  participantList.innerHTML = '';
  participantCount.textContent = '0';
  totalParticipants.textContent = '0';
  updateResponseProgress(0, 0);

  uploadSection.classList.add('hidden');
  liveWorkspace.classList.remove('hidden');
  setLobbyPanel('ready');
  liveLobbyPanel.classList.remove('hidden');
  sessionInfoSection.classList.remove('hidden');
  participantsSection.classList.remove('hidden');
  controlsSection.classList.remove('hidden');

  // Reset control buttons state
  const isSurvey = session.sessionType === 'survey';
  startBtn.innerHTML = (isSurvey ? 'Start survey ' : 'Start quiz ') + '<svg class="btn-icon" aria-hidden="true"><use href="/assets/icons.svg#play"></use></svg>';
  startBtn.classList.remove('hidden');
  
  const cancelSessionBtn = document.getElementById('cancel-session-btn');
  if (cancelSessionBtn) cancelSessionBtn.classList.remove('hidden');

  nextBtn.classList.add('hidden');
  endQuestionBtn.classList.add('hidden');
  showResultsBtn.classList.add('hidden');
  endSessionBtn.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  liveResultsEyebrow.textContent = isSurvey ? 'Survey complete' : 'Quiz complete';
  liveResultsTitle.textContent = isSurvey ? 'Survey summary' : 'Final results';
  quizLiveResults.classList.toggle('hidden', isSurvey);
  surveyLiveResults.classList.toggle('hidden', !isSurvey);
  resultsBody.replaceChildren();
  surveyLiveResults.replaceChildren();

  quizStatus.textContent = isSurvey ? 'Survey Not Started' : 'Not Started';
  quizStatus.className = 'badge badge-warning';
}

// Reset to upload state
function resetToUploadState() {
  sessionCode = null;
  currentQuiz = null;
  sidekicksToggle.checked = true;
  document.body.classList.remove('sidekicks-disabled');

  stopAutopilotCountdown();
  autopilotToggle.checked = false;
  autopilotPause.value = '8';
  autopilotPause.disabled = true;

  stopKeepAlive(); // Stop pinging — session is over

  sessionInfoSection.classList.add('hidden');
  participantsSection.classList.add('hidden');
  controlsSection.classList.add('hidden');
  questionSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  quizLiveResults.classList.remove('hidden');
  surveyLiveResults.classList.add('hidden');
  resultsBody.replaceChildren();
  surveyLiveResults.replaceChildren();
  liveWorkspace.classList.add('hidden');
  setLobbyPanel('ready');
  liveLobbyPanel.classList.remove('hidden');
  uploadSection.classList.remove('hidden');
  uploadStatus.classList.add('hidden');
  trialCompletionCta.classList.add('hidden');

  participantList.innerHTML = '';

  // Remove session-lost banner if present
  const banner = document.getElementById('session-lost-banner');
  if (banner) banner.remove();

  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

const cancelStudioBtn = document.getElementById('cancel-studio-btn');
const cancelSessionBtn = document.getElementById('cancel-session-btn');

cancelStudioBtn?.addEventListener('click', () => {
  showInstructorHome();
});

cancelSessionBtn?.addEventListener('click', async () => {
  if (!sessionCode) return;
  const confirmed = await showConfirmModal({
    title: 'Cancel Session',
    message: 'Are you sure you want to cancel this session? The room will be closed.',
    confirmText: 'Cancel Session',
    cancelText: 'Keep Session',
    danger: true
  });
  if (!confirmed) return;
  try {
    const res = await authFetch(isTrialMode() ? '/api/trial/session' : `/api/admin/session/${sessionCode}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'The session could not be cancelled.');
    }
    resetToUploadState();
  } catch (err) {
    console.error('Failed to delete unstarted session:', err);
    showNoticeModal(err.message || 'The session could not be cancelled.', 'Cancel Failed');
  }
});

// Start quiz
startBtn.addEventListener('click', () => {
  if (cancelSessionBtn) cancelSessionBtn.classList.add('hidden');
  if (socket && sessionCode) {
    socket.emit('start_quiz', sessionCode);
  }
});

sidekicksToggle.addEventListener('change', () => {
  if (socket && sessionCode) {
    socket.emit('set_sidekicks_enabled', {
      sessionCode,
      enabled: sidekicksToggle.checked
    });
  }
});

autopilotToggle.addEventListener('change', () => {
  autopilotPause.disabled = !autopilotToggle.checked;
  sendAutopilotSetting();
});

autopilotPause.addEventListener('change', () => {
  const clamped = Math.min(30, Math.max(3, Math.round(Number(autopilotPause.value) || 8)));
  autopilotPause.value = String(clamped);
  sendAutopilotSetting();
});

// Next question
nextBtn.addEventListener('click', () => {
  if (socket && sessionCode) {
    socket.emit('next_question', sessionCode);
  }
  stopAutopilotCountdown();
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

  const confirmed = await showConfirmModal({
    title: 'End Session',
    message: 'Are you sure you want to end this session? All participants will be disconnected.',
    confirmText: 'End Session',
    cancelText: 'Keep Session',
    danger: true
  });
  if (!confirmed) {
    return;
  }

  try {
    const res = await authFetch(sessionApiPath(`/${sessionCode}/end`), {
      method: 'POST'
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'The session could not be ended.');
    resetToUploadState();
  } catch (err) {
    console.error('Failed to end session', err);
    showNoticeModal(err.message || 'The session could not be ended.', 'End Failed');
  }
});

// Show final results
showResultsBtn.addEventListener('click', async () => {
  if (!sessionCode) return;

  try {
    const res = await authFetch(sessionApiPath(`/${sessionCode}/results`));
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Results are unavailable.');

    if (data.mode === 'survey') {
      liveResultsEyebrow.textContent = 'Survey complete';
      liveResultsTitle.textContent = 'Survey summary';
      quizLiveResults.classList.add('hidden');
      surveyLiveResults.classList.remove('hidden');
      renderSurveySummary(surveyLiveResults, data);
    } else {
      liveResultsEyebrow.textContent = 'Quiz complete';
      liveResultsTitle.textContent = 'Final results';
      surveyLiveResults.classList.add('hidden');
      quizLiveResults.classList.remove('hidden');
      resultsBody.innerHTML = '';
      (data.results || []).forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td>${escapeHtml(r.name)}</td>
          <td>${r.score} / ${r.total}</td>
        `;
        resultsBody.appendChild(tr);
      });
    }

    questionSection.classList.add('hidden');
    liveLobbyPanel.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    showResultsBtn.classList.add('hidden');
    trialCompletionCta.classList.toggle('hidden', !isTrialMode());
  } catch (err) {
    console.error('Failed to load results', err);
    showNoticeModal(err.message || 'Results are unavailable.', 'Results Unavailable');
  }
});

function renderSurveySummary(container, summary) {
  container.replaceChildren();

  const overview = document.createElement('div');
  overview.className = 'survey-summary-overview';
  overview.innerHTML = `
    <div><strong>${Number(summary.participantCount) || 0}</strong><span>Participants</span></div>
    <div><strong>${Number(summary.responseCount) || 0}</strong><span>Total responses</span></div>
    <div><strong>${Number(summary.responseRate) || 0}%</strong><span>Response rate</span></div>
  `;
  container.appendChild(overview);

  (summary.questions || []).forEach((question, questionIndex) => {
    const card = document.createElement('article');
    card.className = 'survey-summary-card';

    const heading = document.createElement('div');
    heading.className = 'survey-summary-heading';
    const title = document.createElement('h3');
    title.textContent = `Q${question.displayNumber || questionIndex + 1}: ${question.text || ''}`;
    const meta = document.createElement('p');
    meta.textContent = `${question.responseCount || 0} responses · ${question.responseRate || 0}% of the room`;
    heading.append(title, meta);
    card.appendChild(heading);

    const top = document.createElement('p');
    top.className = 'survey-top-choice';
    const topOptions = question.topOptions || [];
    top.textContent = topOptions.length === 0
      ? 'No responses collected'
      : topOptions.length === 1
        ? `Most popular: ${topOptions[0]}`
        : `Top choices tied: ${topOptions.join(' · ')}`;
    card.appendChild(top);

    (question.options || []).forEach((option, optionIndex) => {
      const distribution = question.optionDistribution?.[optionIndex] || { count: 0, percent: 0 };
      const row = document.createElement('div');
      row.className = 'survey-option-row';

      const header = document.createElement('div');
      header.className = 'survey-option-header';
      const label = document.createElement('span');
      label.textContent = `${String.fromCharCode(65 + optionIndex)}. ${option}`;
      const value = document.createElement('strong');
      value.textContent = `${distribution.count || 0} · ${distribution.percent || 0}%`;
      header.append(label, value);

      const track = document.createElement('div');
      track.className = 'survey-option-track';
      const fill = document.createElement('span');
      fill.className = 'survey-option-fill';
      fill.style.width = `${Math.max(0, Math.min(100, Number(distribution.percent) || 0))}%`;
      track.appendChild(fill);
      row.append(header, track);
      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

// Show current question
function showQuestion(data) {
  const meta = document.querySelector('.question-meta');
  if (data.question && data.question.type === 'ungraded') {
    meta.textContent = '⭐ Just for fun · no points';
  } else {
    meta.innerHTML = 'Question <span id="current-q-num"></span> of <span id="total-q-num"></span>';
    document.getElementById('current-q-num').textContent = data.questionNumber;
    document.getElementById('total-q-num').textContent = data.totalQuestions;
  }
  currentQuestionText.innerHTML = markdown.block(data.question.text);
  answersReceived.textContent = '0';
  optionsDisplay.innerHTML = ''; // Clear previous options
  data.question.options.forEach((opt, i) => {
    const btn = document.createElement('div');
    btn.className = 'option-btn';
    btn.innerHTML = `${String.fromCharCode(65 + i)}. ${markdown.inline(opt)}`;
    
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
function addParticipantChip(name, id = null, avatarId = null) {
  if (id) {
    addParticipantChipWithKick(id, name, avatarId);
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

function sidekickAsset(id, size = 128) {
  return `/assets/sidekicks/webp/${size}/${encodeURIComponent(id)}.webp`;
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

// Show analytics section
analyticsBtn.addEventListener('click', () => {
  showAnalytics();
});

instructorHomeLink?.addEventListener('click', event => {
  if (!authToken || isTrialMode()) return;
  event.preventDefault();
  showInstructorHome();
  instructorHomeHeading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

homeHostBtn?.addEventListener('click', () => {
  showInstructorStudio(sessionCode ? studioMode : 'quiz');
  if (!sessionCode) builderHeading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

homeSurveyBtn?.addEventListener('click', () => {
  if (sessionCode) {
    showInstructorStudio(studioMode);
  } else {
    showInstructorStudio('survey');
  }
  if (!sessionCode) builderHeading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

homeAnalyticsBtn?.addEventListener('click', showAnalytics);
homeAccountBtn?.addEventListener('click', openSettings);
analyticsEmptyHostBtn?.addEventListener('click', () => {
  showInstructorStudio('quiz');
  builderHeading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Back to dashboard from analytics
backToDashboardBtn.addEventListener('click', () => {
  showInstructorHome();
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
  destroyCharts();
  sessionDetailSection.classList.add('hidden');
  analyticsSection.classList.remove('hidden');
  viewingSessionCode = null;
});

// Export CSV
exportCsvBtn.addEventListener('click', async () => {
  if (!viewingSessionCode) return;

  try {
    const res = await authFetch(`/api/admin/analytics/session/${viewingSessionCode}/export`);
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${viewingSessionCode}-results.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    showNoticeModal('Unable to export this session.', 'Export Failed');
  }
});

// Show analytics view
async function showAnalytics() {
  // Hide the instructor launcher and active workspace without disturbing
  // the live room's internal state.
  instructorHomeSection.classList.add('hidden');
  uploadSection.classList.add('hidden');
  liveWorkspace.classList.add('hidden');

  // Show analytics
  analyticsSection.classList.remove('hidden');
  sessionDetailSection.classList.add('hidden');
  studioTitleLabel.textContent = 'Analytics';

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
  showInstructorHome();
}

// Load platform overview stats
let overviewChartInstance = null;
async function loadPlatformStats() {
  try {
    const res = await authFetch('/api/admin/analytics/overview');
    const data = await res.json();

    if (data.success) {
      totalSessionsStat.textContent = data.stats.totalSessions;
      completedSessionsStat.textContent = data.stats.completedSessions;
      quizSessionsStat.textContent = data.stats.quizSessions;
      surveySessionsStat.textContent = data.stats.surveySessions;
      surveyResponsesStat.textContent = data.stats.surveyResponses;
      totalParticipantsStat.textContent = data.stats.totalParticipants;
      avgScoreStat.textContent = `${Math.round(data.stats.overallAvgScore || 0)}%`;
      if (totalCoursesStat) {
        totalCoursesStat.textContent = data.stats.totalCourses;
      }

      const hasSessions = Number(data.stats.totalSessions) > 0;
      analyticsEmptyState.classList.toggle('hidden', hasSessions);
      analyticsDataContent.classList.toggle('hidden', !hasSessions);

      if (!hasSessions) {
        if (window.courseSessionsChart) {
          window.courseSessionsChart.destroy();
          window.courseSessionsChart = null;
        }
        if (window.courseParticipantsChart) {
          window.courseParticipantsChart.destroy();
          window.courseParticipantsChart = null;
        }
        return;
      }
      
      // Render Course Overview Charts
      const ctxSessions = document.getElementById('course-sessions-chart');
      const ctxParticipants = document.getElementById('course-participants-chart');
      
      if (ctxSessions && ctxParticipants && data.stats.courseBreakdown) {
        const breakdown = data.stats.courseBreakdown;
        const labels = breakdown.map(b => b.course_name);
        const sessionData = breakdown.map(b => parseInt(b.session_count, 10));
        const participantData = breakdown.map(b => parseInt(b.participant_count, 10));

        if (window.courseSessionsChart) window.courseSessionsChart.destroy();
        if (window.courseParticipantsChart) window.courseParticipantsChart.destroy();

        const commonOptions = {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0, color: '#e2e8f0' } },
            x: { ticks: { color: '#e2e8f0' } }
          },
          plugins: { legend: { display: false } }
        };

        window.courseSessionsChart = new Chart(ctxSessions, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Total Sessions',
              data: sessionData,
              backgroundColor: 'rgba(99, 102, 241, 0.7)',
              borderColor: '#6366f1',
              borderWidth: 1
            }]
          },
          options: commonOptions
        });

        window.courseParticipantsChart = new Chart(ctxParticipants, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{
              label: 'Total Participants',
              data: participantData,
              backgroundColor: 'rgba(16, 185, 129, 0.7)',
              borderColor: '#10b981',
              borderWidth: 1
            }]
          },
          options: commonOptions
        });
      }
    }
  } catch (err) {
    console.error('Failed to load platform stats', err);
  }
}

// Load sessions list
async function loadSessionsList() {
  try {
    const url = currentSessionsFilter === 'all'
      ? '/api/admin/analytics/sessions'
      : `/api/admin/analytics/sessions?filter=${currentSessionsFilter}`;

    const res = await authFetch(url);
    const data = await res.json();

    analyticsSessionsBody.innerHTML = '';
    
    // Populate Course Filter dropdown if not populated yet
    const courseFilterSelect = document.getElementById('course-filter-select');
    if (courseFilterSelect.options.length <= 1 && data.success) {
      const courses = new Set();
      data.sessions.forEach(s => {
        if (s.courseName) courses.add(s.courseName);
      });
      courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        courseFilterSelect.appendChild(opt);
      });
    }

    if (data.success && data.sessions.length > 0) {
      noSessionsMsg.classList.add('hidden');
      
      const selectedCourse = courseFilterSelect.value;
      const selectedType = document.getElementById('session-type-filter')?.value || 'all';
      const searchTerm = sessionSearchInput?.value.trim().toLowerCase() || '';
      const filteredSessions = data.sessions.filter(s => {
        if (selectedCourse !== 'all' && s.courseName !== selectedCourse) return false;
        if (selectedType !== 'all' && s.sessionType !== selectedType) return false;
        if (currentSessionsFilter === 'test' && !s.isTest) return false;
        if (currentSessionsFilter === 'ended' && s.status !== 'ended') return false;
        if (currentSessionsFilter === 'incomplete' && (s.status === 'ended' || s.isTest)) return false;
        if (searchTerm) {
          const haystack = `${s.code || ''} ${s.courseName || ''} ${s.quizTitle || ''}`.toLowerCase();
          if (!haystack.includes(searchTerm)) return false;
        }
        return true;
      });
      
      if (filteredSessions.length === 0) {
        noSessionsMsg.classList.remove('hidden');
      }

      filteredSessions.forEach(session => {
        const tr = document.createElement('tr');
        const isInterrupted = session.status === 'active';
        const isCreated = session.status === 'created';
        const isSurvey = session.sessionType === 'survey';

        let dateDisplay = 'N/A';
        if (session.endedAt) {
          dateDisplay = new Date(session.endedAt).toLocaleDateString();
        } else if (session.startedAt) {
          dateDisplay = new Date(session.startedAt).toLocaleDateString() + ' (interrupted)';
        } else if (session.createdAt) {
          dateDisplay = new Date(session.createdAt).toLocaleDateString() + ' (never started)';
        }

        let statusBadge = '';
        if (session.isTest) {
          statusBadge += `<span style="background:#9333ea;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;margin-left:5px;">Test</span>`;
        }
        if (isInterrupted) {
          statusBadge += `<span style="background:#b45309;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;margin-left:5px;">Interrupted</span>`;
        } else if (isCreated) {
          statusBadge += `<span style="background:#4b5563;color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;margin-left:5px;">Trial</span>`;
        }

        let primaryAction = '';
        if (isInterrupted) {
          primaryAction = `<button class="btn btn-small btn-danger recover-btn" data-code="${escapeHtml(session.code)}">Recover</button>`;
        } else if (isCreated) {
          primaryAction = `<span class="text-muted session-no-stats">No stats</span>`;
        } else {
          primaryAction = `<button class="btn btn-small btn-primary view-btn" data-code="${escapeHtml(session.code)}">View</button>`;
        }

        let actionBtn = `
          <div class="session-row-actions">
            ${primaryAction}
            <button class="btn btn-small btn-secondary edit-meta-btn" data-code="${escapeHtml(session.code)}" data-course="${escapeHtml(session.courseName || '')}" data-test="${session.isTest}">Edit</button>
            <button class="btn btn-small btn-danger delete-btn" data-code="${escapeHtml(session.code)}">Delete</button>
          </div>
        `;

        tr.innerHTML = `
          <td><code>${escapeHtml(session.code)}</code> ${statusBadge}</td>
          <td><span class="session-type-badge session-type-${isSurvey ? 'survey' : 'quiz'}">${isSurvey ? 'Survey' : 'Quiz'}</span></td>
          <td>${escapeHtml(session.courseName || '-')}</td>
          <td>${escapeHtml(session.quizTitle || 'Untitled')}</td>
          <td>${session.participantCount}</td>
          <td>${(isInterrupted || isCreated)
            ? '—'
            : isSurvey
              ? `${session.responseCount || 0} responses · ${session.responseRate || 0}%`
              : `${Math.round(session.avgScorePercent || 0)}% average`}</td>
          <td>${dateDisplay}</td>
          <td>${actionBtn}</td>
        `;

        if (isInterrupted) {
          // Recover button: calls recovery endpoint, then reloads list
          const recoverBtn = tr.querySelector('.recover-btn');
          recoverBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal({
              title: 'Recover Session',
              message: `Recover interrupted session ${session.code}? This will compute scores from saved answers and mark it as ended.`,
              confirmText: 'Recover'
            });
            if (!confirmed) return;
            recoverBtn.disabled = true;
            recoverBtn.textContent = 'Recovering...';
            try {
              const res = await authFetch(`/api/admin/session/${session.code}/recover`, { method: 'POST' });
              const result = await res.json();
              if (result.success) {
                showNoticeModal(`Recovered: ${result.participantsRecovered} participants, ${result.answersFound} answers. Session is now viewable in Analytics.`, 'Session Recovered');
                loadSessionsList(); // Reload to show it as ended now
              } else {
                showNoticeModal('Recovery failed: ' + result.error, 'Recovery Failed');
                recoverBtn.disabled = false;
                recoverBtn.textContent = 'Recover';
              }
            } catch (err) {
              showNoticeModal('Network error during recovery', 'Recovery Failed');
              recoverBtn.disabled = false;
              recoverBtn.textContent = 'Recover';
            }
          });
        } else if (!isCreated) {
          // Normal view button
          const viewBtn = tr.querySelector('.view-btn');
          viewBtn.addEventListener('click', () => {
            loadSessionDetail(session.code);
          });
        }

        // Edit Metadata Button
        const editBtn = tr.querySelector('.edit-meta-btn');
        if (editBtn) {
          editBtn.addEventListener('click', () => {
            editSessionCode.value = session.code;
            editCourseName.value = session.courseName || '';
            editIsTest.checked = session.isTest;
            editMetadataModal.classList.remove('hidden');
          });
        }
        
        // Delete Session Button
        const delBtn = tr.querySelector('.delete-btn');
        if (delBtn) {
          delBtn.addEventListener('click', async () => {
            const confirmed = await showConfirmModal({
              title: 'Delete Session',
              message: `Are you sure you want to permanently delete session ${session.code}? This action cannot be undone.`,
              confirmText: 'Delete Permanently',
              danger: true
            });
            if (!confirmed) return;
            try {
              const res = await authFetch(`/api/admin/session/${session.code}`, { method: 'DELETE' });
              const result = await res.json();
              if (result.success) {
                loadSessionsList();
              } else {
                showNoticeModal('Delete failed: ' + result.error, 'Delete Failed');
              }
            } catch (err) {
              showNoticeModal('A network error interrupted the request.', 'Connection Error');
            }
          });
        }

        analyticsSessionsBody.appendChild(tr);
      });
    } else {
      noSessionsMsg.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Failed to load sessions list', err);
  }
}

// Handle Edit Metadata Submission
editMetadataForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = editSessionCode.value;
  const courseName = editCourseName.value.trim();
  const isTest = editIsTest.checked;
  
  try {
    const res = await authFetch(`/api/admin/session/${code}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseName, isTest })
    });
    const result = await res.json();
    if (result.success) {
      editMetadataModal.classList.add('hidden');
      loadSessionsList();
    } else {
      showNoticeModal('Update failed: ' + result.error, 'Update Failed');
    }
  } catch (err) {
    showNoticeModal('A network error interrupted the request.', 'Connection Error');
  }
});

closeEditMetadataBtn.addEventListener('click', () => {
  editMetadataModal.classList.add('hidden');
});

// Update the filter logic to re-render using local data, or just re-fetch
document.getElementById('course-filter-select')?.addEventListener('change', () => {
  loadSessionsList();
});

document.getElementById('session-type-filter')?.addEventListener('change', () => {
  loadSessionsList();
});

let sessionSearchTimer = null;
sessionSearchInput?.addEventListener('input', () => {
  clearTimeout(sessionSearchTimer);
  sessionSearchTimer = setTimeout(loadSessionsList, 180);
});

// Wire up the session status filter buttons (All, Completed, Incomplete, Tests Only)
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSessionsFilter = btn.getAttribute('data-filter') || 'all';
    loadSessionsList();
  });
});



// Destroy existing charts to prevent memory leaks
function destroyCharts() {
  if (scoreDistributionChart) {
    scoreDistributionChart.destroy();
    scoreDistributionChart = null;
  }
  if (questionDifficultyChart) {
    questionDifficultyChart.destroy();
    questionDifficultyChart = null;
  }
}

// Render score distribution histogram
function renderScoreDistribution(participants, totalQuestions) {
  const buckets = [0, 0, 0, 0, 0]; // 0-20, 20-40, 40-60, 60-80, 80-100
  participants.forEach(p => {
    const pct = totalQuestions > 0 ? (p.correctCount / totalQuestions) * 100 : 0;
    if (pct >= 80) buckets[4]++;
    else if (pct >= 60) buckets[3]++;
    else if (pct >= 40) buckets[2]++;
    else if (pct >= 20) buckets[1]++;
    else buckets[0]++;
  });

  const ctx = document.getElementById('score-distribution-chart').getContext('2d');
  scoreDistributionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
      datasets: [{
        label: 'Participants',
        data: buckets,
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(239, 68, 68, 0.7)',
          'rgba(245, 158, 11, 0.7)',
          'rgba(34, 197, 94, 0.7)',
          'rgba(34, 197, 94, 0.7)'
        ],
        borderColor: [
          'rgba(239, 68, 68, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(34, 197, 94, 1)',
          'rgba(34, 197, 94, 1)'
        ],
        borderWidth: 1,
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
            label: (ctx) => `${ctx.raw} participant${ctx.raw !== 1 ? 's' : ''}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, color: '#94a3b8' },
          grid: { color: 'rgba(71, 85, 105, 0.3)' }
        },
        x: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      }
    }
  });
}

// Render question difficulty horizontal bar chart
function renderQuestionDifficultyChart(questions) {
  const sorted = [...questions].sort((a, b) => a.index - b.index);
  const labels = sorted.map(q => `Q${q.index + 1}`);
  const percents = sorted.map(q => Math.round(q.correctPercent));
  const colors = sorted.map(q => {
    if (q.difficulty === 'easy') return 'rgba(34, 197, 94, 0.7)';
    if (q.difficulty === 'medium') return 'rgba(245, 158, 11, 0.7)';
    return 'rgba(239, 68, 68, 0.7)';
  });
  const borderColors = sorted.map(q => {
    if (q.difficulty === 'easy') return 'rgba(34, 197, 94, 1)';
    if (q.difficulty === 'medium') return 'rgba(245, 158, 11, 1)';
    return 'rgba(239, 68, 68, 1)';
  });

  const ctx = document.getElementById('question-difficulty-chart').getContext('2d');
  questionDifficultyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Correct %',
        data: percents,
        backgroundColor: colors,
        borderColor: borderColors,
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.raw}% correct`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: { color: '#94a3b8', callback: v => `${v}%` },
          grid: { color: 'rgba(71, 85, 105, 0.3)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { display: false }
        }
      }
    }
  });
}

// Detect and render tricky questions
function renderTrickyQuestions(questions) {
  const container = document.getElementById('tricky-questions-container');
  const section = document.getElementById('tricky-questions-section');
  container.innerHTML = '';

  const trickyOnes = [];
  questions.forEach(q => {
    if (!q.optionDistribution || q.optionDistribution.length === 0) return;
    if (!q.options || q.options.length === 0) return;

    // Find the most-picked option
    let maxCount = 0;
    let maxOptionIndex = -1;
    q.optionDistribution.forEach(d => {
      if (d.count > maxCount) {
        maxCount = d.count;
        maxOptionIndex = d.optionIndex;
      }
    });

    // Check if the most-picked option is wrong
    if (maxOptionIndex >= 0 && !q.correctIndices.includes(maxOptionIndex)) {
      const totalAnswers = q.totalAnswers || q.optionDistribution.reduce((s, d) => s + parseInt(d.count), 0);
      const pct = totalAnswers > 0 ? Math.round((maxCount / totalAnswers) * 100) : 0;
      const correctText = q.correctIndices.map(i => q.options[i]).filter(Boolean).join(', ');
      trickyOnes.push({
        question: q,
        wrongOption: q.options[maxOptionIndex],
        wrongPct: pct,
        correctAnswer: correctText
      });
    }
  });

  if (trickyOnes.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  trickyOnes.forEach(t => {
    const div = document.createElement('div');
    div.className = 'tricky-alert';
    div.innerHTML = `
      <div class="tricky-alert-header">Q${t.question.index + 1}: ${escapeHtml(t.question.text)}</div>
      <div class="tricky-alert-detail">
        <span class="wrong-pick">${t.wrongPct}% picked "${escapeHtml(t.wrongOption)}"</span> (wrong)
        &mdash; Correct answer: <span class="correct-pick">"${escapeHtml(t.correctAnswer)}"</span>
      </div>
    `;
    container.appendChild(div);
  });
}

// Render engagement / completion rate
function renderEngagement(participants, totalQuestions) {
  const completionEl = document.getElementById('detail-completion-rate');
  const noteEl = document.getElementById('detail-dropoff-note');

  if (participants.length === 0 || totalQuestions === 0) {
    completionEl.textContent = 'N/A';
    noteEl.textContent = '';
    return;
  }

  const completed = participants.filter(p => parseInt(p.questionsAnswered) >= totalQuestions).length;
  const rate = Math.round((completed / participants.length) * 100);
  completionEl.textContent = `${rate}%`;

  const dropped = participants.length - completed;
  if (dropped > 0) {
    noteEl.textContent = `${dropped} didn't finish`;
  } else {
    noteEl.textContent = '';
  }
}

// Load session detail
async function loadSessionDetail(code) {
  try {
    const res = await authFetch(`/api/admin/analytics/session/${code}`);
    const data = await res.json();

    if (!data.success) {
      showNoticeModal('Failed to load session details.', 'Report Unavailable');
      return;
    }

    // Destroy previous charts
    destroyCharts();

    viewingSessionCode = code;

    // Hide analytics list, show detail
    analyticsSection.classList.add('hidden');
    sessionDetailSection.classList.remove('hidden');

    const isSurvey = data.session.sessionType === 'survey' || data.mode === 'survey';

    // Populate session info
    detailQuizTitle.textContent = data.session.quizTitle || (isSurvey ? 'Untitled Survey' : 'Untitled Quiz');
    detailParticipants.textContent = isSurvey
      ? data.session.participantCount || 0
      : data.participants.length;
    detailQuestions.textContent = data.session.totalQuestions;

    const chartGrid = document.querySelector('.detail-chart-grid');
    const questionBreakdownCard = document.getElementById('question-breakdown-card');
    const surveyBreakdownSection = document.getElementById('survey-breakdown-section');

    if (isSurvey) {
      detailParticipantsLabel.textContent = 'Participants';
      detailPrimaryLabel.textContent = 'Response rate';
      detailSecondaryLabel.textContent = 'Total responses';
      detailAvgScore.textContent = `${data.session.responseRate || 0}%`;
      detailCompletionRate.textContent = data.session.responseCount || 0;
      detailDropoffNote.textContent = '';
      if (chartGrid) chartGrid.classList.add('hidden');
      if (questionBreakdownCard) questionBreakdownCard.classList.add('hidden');
      trickyQuestionsSection.classList.add('hidden');
      rankingSection.classList.add('hidden');

      if (surveyBreakdownSection) {
        surveyBreakdownSection.classList.remove('hidden');
        const container = document.getElementById('survey-breakdown-container');
        renderSurveySummary(container, {
          participantCount: data.session.participantCount,
          responseCount: data.session.responseCount,
          responseRate: data.session.responseRate,
          questions: data.questions
        });
      }
    } else {
      detailParticipantsLabel.textContent = 'Participants';
      detailPrimaryLabel.textContent = 'Average score';
      detailSecondaryLabel.textContent = 'Completion rate';
      if (chartGrid) chartGrid.classList.remove('hidden');
      if (questionBreakdownCard) questionBreakdownCard.classList.remove('hidden');
      if (surveyBreakdownSection) surveyBreakdownSection.classList.add('hidden');

      // Calculate average score for Quiz
      const avgScore = data.participants.length > 0 && data.session.totalQuestions > 0
        ? data.participants.reduce((sum, p) => sum + ((p.correctCount || 0) / data.session.totalQuestions * 100), 0) / data.participants.length
        : 0;
      detailAvgScore.textContent = `${Math.round(avgScore)}%`;

      renderEngagement(data.participants, data.session.totalQuestions);
      renderScoreDistribution(data.participants, data.session.totalQuestions);
      renderQuestionDifficultyChart(data.questions);

      // Populate question difficulty table
      questionBreakdownBody.innerHTML = '';
      (data.questionsByDifficulty || []).forEach(q => {
        const tr = document.createElement('tr');
        const avgTime = q.avgResponseTimeMs ? `${(q.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A';
        const difficultyClass = `difficulty-${q.difficulty}`;

        tr.innerHTML = `
          <td>Q${q.index + 1}</td>
          <td class="question-text-cell" title="${escapeHtml(q.text)}">${escapeHtml(truncateText(q.text, 50))}</td>
          <td>${Math.round(q.correctPercent)}%</td>
          <td>${avgTime}</td>
          <td><span class="difficulty-badge ${difficultyClass}">${q.difficulty}</span></td>
        `;
        questionBreakdownBody.appendChild(tr);
      });

      renderTrickyQuestions(data.questions);

      // Leaderboard / Ranking table
      rankingSection.classList.remove('hidden');
      rankingParticipantsBody.innerHTML = '';
      const passingPercent = Number(data.session.passingPercent ?? 70);
      const rankedParticipants = [...data.participants]
        .sort((a, b) => {
          if ((b.correctCount || 0) !== (a.correctCount || 0)) {
            return (b.correctCount || 0) - (a.correctCount || 0);
          }
          const aTime = a.avgResponseTimeMs ?? Number.POSITIVE_INFINITY;
          const bTime = b.avgResponseTimeMs ?? Number.POSITIVE_INFINITY;
          if (aTime !== bTime) return aTime - bTime;
          return String(a.name || '').localeCompare(String(b.name || ''));
        })
        .map((participant, index) => {
          const scorePercent = data.session.totalQuestions > 0
            ? ((participant.correctCount || 0) / data.session.totalQuestions) * 100
            : 0;
          return {
            ...participant,
            overallRank: index + 1,
            scorePercent,
            passed: scorePercent >= passingPercent
          };
        });

      const totalScore = data.session.totalScore || 100;
      const pointsPerQuestion = data.session.totalQuestions > 0 ? totalScore / data.session.totalQuestions : 0;

      function buildParticipantRow(p, rank, totalQuestions) {
        const tr = document.createElement('tr');
        const avgTime = p.avgResponseTimeMs ? `${(p.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A';
        const computedScore = Math.round((p.correctCount || 0) * pointsPerQuestion);

        let rankHtml;
        if (rank === 1) {
          rankHtml = `<span class="rank-trophy rank-gold"><svg class="trophy-icon" aria-hidden="true"><use href="/assets/icons.svg#trophy"></use></svg>${rank}</span>`;
        } else if (rank === 2) {
          rankHtml = `<span class="rank-trophy rank-silver"><svg class="trophy-icon" aria-hidden="true"><use href="/assets/icons.svg#medal"></use></svg>${rank}</span>`;
        } else if (rank === 3) {
          rankHtml = `<span class="rank-trophy rank-bronze"><svg class="trophy-icon" aria-hidden="true"><use href="/assets/icons.svg#medal"></use></svg>${rank}</span>`;
        } else if (rank <= 5) {
          rankHtml = `<span class="rank-trophy rank-top5"><svg class="trophy-icon" aria-hidden="true"><use href="/assets/icons.svg#medal"></use></svg>${rank}</span>`;
        } else {
          rankHtml = `${rank}`;
        }

        const streak = p.bestStreak || 0;
        const streakClass = streak >= Math.ceil(totalQuestions / 2) ? 'high' : '';
        const streakHtml = streak > 0
          ? `<span class="streak-badge ${streakClass}">${streak}</span>`
          : '0';

        tr.innerHTML = `
          <td>${rankHtml}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.correctCount} / ${totalQuestions}</td>
          <td>${computedScore} / ${totalScore}</td>
          <td><span class="pass-badge ${p.passed ? 'pass-badge-passed' : 'pass-badge-failed'}">${p.passed ? 'Passed' : 'Below threshold'}</span></td>
          <td>${avgTime}</td>
          <td>${streakHtml}</td>
        `;
        return tr;
      }

      rankedParticipants.forEach(p => {
        rankingParticipantsBody.appendChild(
          buildParticipantRow(p, p.overallRank, data.session.totalQuestions)
        );
      });

      noRankingMsg.classList.toggle('hidden', rankedParticipants.length > 0);
      rankingCountBadge.textContent = rankedParticipants.length;
      rankingThresholdNote.textContent = `Passing threshold: ${passingPercent}%`;
    }

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
  if (hostedAuthMode && currentAdmin?.role === 'master') {
    loadHostedInstructors();
  }
  if (billingEnabled
    && hostedAuthMode
    && currentAdmin?.authSource === 'hosted'
    && currentAdmin.role !== 'master') {
    loadBillingStatus();
  }
}

// Close settings modal
function closeSettings() {
  settingsModal.classList.add('hidden');
  clearSettingsForms();
}

// Switch settings tabs
function switchSettingsTab(tabName) {
  const requestedTab = Array.from(settingsTabs).find(tab => tab.dataset.tab === tabName);
  if (!requestedTab || requestedTab.classList.contains('hidden')) tabName = 'password';
  settingsTabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabName);
    t.setAttribute('aria-selected', String(t.dataset.tab === tabName));
  });
  Object.entries(settingsPanels).forEach(([name, panel]) => {
    panel.classList.toggle('hidden', name !== tabName);
  });
}

function billingDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date(value));
}

async function loadBillingStatus() {
  const badge = document.getElementById('billing-status-badge');
  const periodCopy = document.getElementById('billing-period-copy');
  const planDetails = document.getElementById('billing-plan-details');
  const startBtn = document.getElementById('start-subscription-btn');
  const manageBtn = document.getElementById('manage-billing-btn');

  try {
    const res = await authFetch('/api/admin/billing');
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Unable to load billing');

    const subscription = data.subscription;
    const complimentary = data.complimentaryAccess;
    const status = subscription?.status || 'not_subscribed';
    const cancellationScheduled = Boolean(subscription?.cancelAtPeriodEnd);
    const managed = ['active', 'trialing', 'past_due'].includes(status);
    const active = ['active', 'trialing'].includes(status);
    planDetails.textContent = `$${data.plan.amount} ${data.plan.currency} per year · up to ${data.plan.participantLimit} participants · one open room at a time`;

    badge.textContent = complimentary
      ? 'Complimentary'
      : cancellationScheduled
      ? 'Cancellation scheduled'
      : status === 'not_subscribed'
      ? 'Not subscribed'
      : status.replaceAll('_', ' ');
    startBtn.classList.toggle('hidden', managed || Boolean(complimentary));
    manageBtn.classList.toggle('hidden', !subscription?.status);

    if (complimentary) {
      periodCopy.textContent = complimentary.until
        ? `Complimentary classroom access continues through ${billingDate(complimentary.until)}.`
        : 'Complimentary classroom access does not expire.';
    } else if (subscription?.currentPeriodEnd) {
      periodCopy.textContent = cancellationScheduled
        ? `Cancels on ${billingDate(subscription.currentPeriodEnd)}. Access remains available until then.`
        : `${active ? 'Renews' : 'Current period ends'} ${billingDate(subscription.currentPeriodEnd)}.`;
    } else if (status === 'past_due') {
      periodCopy.textContent = 'A renewal payment needs attention. Your classroom access is in its grace period.';
    } else {
      periodCopy.textContent = 'An entire year of hosted Markdown Mash for $15.';
    }
  } catch (error) {
    badge.textContent = 'Unavailable';
    periodCopy.textContent = '';
    showStatus('billing-status-message', error.message, false);
  }
}

async function openStripeBilling(path, button) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = 'Opening Stripe…';
  hideStatus('billing-status-message');

  try {
    const res = await authFetch(path, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.error || 'Unable to open Stripe');
    }
    window.location.assign(data.url);
  } catch (error) {
    showStatus('billing-status-message', error.message, false);
    button.disabled = false;
    button.textContent = originalText;
  }
}

function createInstructorAccountRow(instructor) {
  const row = document.createElement('div');
  row.className = 'instructor-account-row';

  const identity = document.createElement('div');
  identity.className = 'instructor-account-identity';
  const name = document.createElement('strong');
  name.textContent = instructor.displayName || 'Hosted account';
  const email = document.createElement('span');
  email.className = 'text-muted';
  email.textContent = instructor.email;
  identity.append(name, email);

  const meta = document.createElement('div');
  meta.className = 'instructor-account-meta';
  const accountStatus = document.createElement('span');
  const invitationExpired = instructor.invitationExpiresAt
    && new Date(instructor.invitationExpiresAt).getTime() <= Date.now();
  accountStatus.textContent = instructor.emailVerified
    ? `Account: ${instructor.accountStatus.replaceAll('_', ' ')}`
    : invitationExpired
      ? 'Account: invitation expired'
      : 'Account: invitation pending';
  const billingStatus = document.createElement('span');
  billingStatus.textContent = instructor.cancelAtPeriodEnd
    ? `Billing: cancellation scheduled · access through ${billingDate(instructor.currentPeriodEnd)}`
    : `Billing: ${(instructor.subscriptionStatus || 'not subscribed').replaceAll('_', ' ')}`;
  const source = document.createElement('span');
  source.textContent = `Source: ${(instructor.provisioningSource || 'deployment').replaceAll('_', ' ')}`;
  meta.append(accountStatus, billingStatus, source);

  const accessControls = document.createElement('div');
  accessControls.className = 'instructor-access-controls';
  const accessSelect = document.createElement('select');
  accessSelect.setAttribute('aria-label', `Access for ${instructor.email}`);
  [
    ['none', 'Payment required'],
    ['temporary', 'Complimentary until date'],
    ['permanent', 'Permanent complimentary']
  ].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    accessSelect.appendChild(option);
  });
  accessSelect.value = instructor.accessOverride !== 'complimentary'
    ? 'none'
    : instructor.complimentaryAccessUntil ? 'temporary' : 'permanent';
  const expiryInput = document.createElement('input');
  expiryInput.type = 'date';
  expiryInput.setAttribute('aria-label', `Complimentary access expiration for ${instructor.email}`);
  expiryInput.value = instructor.complimentaryAccessUntil
    ? new Date(instructor.complimentaryAccessUntil).toISOString().slice(0, 10)
    : '';
  expiryInput.classList.toggle('hidden', accessSelect.value !== 'temporary');
  accessSelect.addEventListener('change', () => {
    expiryInput.classList.toggle('hidden', accessSelect.value !== 'temporary');
  });
  const saveAccess = document.createElement('button');
  saveAccess.type = 'button';
  saveAccess.className = 'btn btn-secondary btn-sm';
  saveAccess.textContent = 'Save access';
  saveAccess.addEventListener('click', async () => {
    const expiresAt = accessSelect.value === 'temporary' && expiryInput.value
      ? new Date(`${expiryInput.value}T23:59:59.999Z`).toISOString()
      : null;
    saveAccess.disabled = true;
    try {
      const response = await authFetch(`/api/admin/instructors/${instructor.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: accessSelect.value, expiresAt })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Unable to update access');
      showStatus('invitation-status', `Access updated for ${instructor.email}`, true);
      await loadHostedInstructors();
    } catch (error) {
      showStatus('invitation-status', error.message, false);
      saveAccess.disabled = false;
    }
  });
  accessControls.append(accessSelect, expiryInput, saveAccess);

  row.append(identity, accessControls, meta);
  return row;
}

async function loadHostedInstructors() {
  const list = instructorList;
  if (!list || currentAdmin?.role !== 'master') return;
  list.replaceChildren();
  const loading = document.createElement('p');
  loading.className = 'text-muted';
  loading.textContent = 'Loading hosted accounts…';
  list.appendChild(loading);

  try {
    const response = await authFetch('/api/admin/instructors');
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load hosted accounts');

    list.replaceChildren();
    if (!data.instructors.length) {
      const empty = document.createElement('p');
      empty.className = 'text-muted';
      empty.textContent = 'No hosted accounts yet.';
      list.appendChild(empty);
      return;
    }
    data.instructors.forEach(instructor => list.appendChild(createInstructorAccountRow(instructor)));
  } catch (error) {
    list.replaceChildren();
    const message = document.createElement('p');
    message.className = 'error-text';
    message.textContent = error.message;
    list.appendChild(message);
  }
}

createInvitationForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = document.getElementById('invitation-display-name').value.trim();
  const email = document.getElementById('invitation-email').value.trim();
  const button = document.getElementById('create-invitation-btn');
  const result = document.getElementById('invitation-result');

  button.disabled = true;
  button.textContent = 'Creating…';
  result.classList.add('hidden');
  hideStatus('invitation-status');
  try {
    const response = await authFetch('/api/admin/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email })
    });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Unable to create invitation');

    document.getElementById('invitation-url').value = data.invitation.inviteUrl;
    document.getElementById('invitation-expiry').textContent = `Expires ${billingDate(data.invitation.expiresAt)}. Creating another link for this email invalidates this one.`;
    result.classList.remove('hidden');
    showStatus('invitation-status', `Invitation ready for ${data.invitation.email}`, true);
    await loadHostedInstructors();
  } catch (error) {
    showStatus('invitation-status', error.message, false);
  } finally {
    button.disabled = false;
    button.textContent = 'Create invitation link';
  }
});

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
  hideStatus('billing-status-message');
  hideStatus('invitation-status');
  document.getElementById('invitation-result')?.classList.add('hidden');
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

document.getElementById('start-subscription-btn')?.addEventListener('click', (event) => {
  openStripeBilling('/api/admin/billing/checkout', event.currentTarget);
});

document.getElementById('manage-billing-btn')?.addEventListener('click', (event) => {
  openStripeBilling('/api/admin/billing/portal', event.currentTarget);
});

document.getElementById('copy-invitation-btn')?.addEventListener('click', (event) => {
  copyText(document.getElementById('invitation-url').value, event.currentTarget, 'Copied');
});

document.getElementById('refresh-instructors-btn')?.addEventListener('click', loadHostedInstructors);

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

  if (newPassword.length < 12) {
    showStatus('password-status', 'Password must be at least 12 characters', false);
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

  if (newPassword.length < 12) {
    showStatus('recovery-status', 'Password must be at least 12 characters', false);
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
function addParticipantChipWithKick(id, name, avatarId = null) {
  // Prevent duplicate chips
  const existing = participantList.querySelector(`[data-id="${id}"]`);
  if (existing) {
    const image = existing.querySelector('.participant-sidekick');
    if (image && avatarId) image.src = sidekickAsset(avatarId);
    return;
  }

  const chip = document.createElement('span');
  chip.className = 'participant-chip';
  chip.dataset.id = id;
  chip.innerHTML = `
    ${avatarId ? `<img class="participant-sidekick" src="${sidekickAsset(avatarId)}" alt="" width="28" height="28">` : ''}
    <span>${escapeHtml(name)}</span>
    <button class="kick-btn" title="Remove participant">&times;</button>
  `;

  chip.querySelector('.kick-btn').addEventListener('click', async () => {
    const confirmed = await showConfirmModal({
      title: 'Kick Participant',
      message: `Remove ${name} from the session?`,
      confirmText: 'Remove Participant',
      danger: true
    });
    if (!confirmed) return;
    await kickParticipant(id, name);
  });

  participantList.appendChild(chip);
}

// Kick participant
async function kickParticipant(participantId, participantName) {
  if (!sessionCode) return;

  try {
    const res = await authFetch(sessionApiPath(`/${sessionCode}/kick/${participantId}`), {
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
      showNoticeModal(data.error || 'Failed to remove participant', 'Participant Not Removed');
    }
  } catch (err) {
    console.error('Kick error:', err);
    showNoticeModal('Failed to remove participant', 'Participant Not Removed');
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
