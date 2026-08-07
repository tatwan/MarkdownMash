require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const Stripe = require('stripe');
const { rateLimit } = require('express-rate-limit');
const db = require('./db');
const autopilot = require('./autopilot');
const {
  buildFinaleSummary,
  buildQuestionPresentation,
  rankParticipants
} = require('./presentation');
const { canReuseParticipant } = require('./participant-identity');
const { createPageMiddleware } = require('./page-metadata');
const {
  createPersistentSessionRepository,
  createTransientSessionRepository
} = require('./session-repository');
const {
  ownerFilterFor,
  canAdminAccessStoredSession,
  canControlSession
} = require('./controller-authorization');
const {
  parseQuizMarkdown,
  normalizeStoredQuiz,
  gradedCount,
  pointsPerQuestion,
  isScored,
  stepAt,
  questionForStep
} = require('./quiz-structure');
const { createTrialManager } = require('./trial-manager');
const {
  createOpaqueToken,
  escapeCSV,
  hashOpaqueToken,
  verifyOpaqueToken
} = require('./security-utils');
const {
  getParticipantAdmission,
  resolveParticipantLimitForAdmin,
  resolvePersistentParticipantLimit
} = require('./participant-capacity');
const {
  createSidekickState,
  drawSidekick,
  getShuffleAvailability
} = require('./sidekick-assignment');
const {
  HOSTED_ROOM_LIMIT_CODE,
  shouldEnforceSingleOpenRoom
} = require('./hosted-room-guard');
const {
  getAccountAuthenticationFailure,
  isValidEmail,
  normalizeEmail
} = require('./account-identity');
const {
  getHostedBillingFailure,
  hasComplimentaryRoomEntitlement,
  hasHostedRoomEntitlement
} = require('./billing');
const {
  BillingRequestError,
  createStripeBillingService
} = require('./stripe-billing');
const {
  buildInvitationUrl,
  getInvitationPasswordError,
  invitationExpiry,
  maskEmail,
  resolveInviteTtlHours
} = require('./account-invitations');
const { createEmailService } = require('./email-service');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: isProduction ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' },
  strictTransportSecurity: isProduction
    ? { maxAge: 31536000, includeSubDomains: true }
    : false
}));
app.use((req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
  );
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});
const vendorFiles = new Map([
  ['/vendor/marked.js', path.join(__dirname, 'node_modules', 'marked', 'marked.min.js')],
  ['/vendor/dompurify.js', path.join(__dirname, 'node_modules', 'dompurify', 'dist', 'purify.min.js')],
  ['/vendor/highlight.js', path.join(__dirname, 'node_modules', '@highlightjs', 'cdn-assets', 'highlight.min.js')],
  ['/vendor/highlight.css', path.join(__dirname, 'node_modules', '@highlightjs', 'cdn-assets', 'styles', 'atom-one-dark.min.css')],
  ['/vendor/chart.js', path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js')]
]);
for (const [route, file] of vendorFiles) {
  app.get(route, (req, res) => res.sendFile(file));
}
app.use('/assets/sidekicks', express.static(path.join(__dirname, 'assets', 'sidekicks')));
// Must precede express.static so the HTML pages are served with per-request
// metadata instead of straight off disk. Anything unregistered falls through.
app.use(createPageMiddleware());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// CONFIGURATION
// ============================================
const adminPassword = process.env.ADMIN_PASSWORD || (isProduction ? '' : 'admin123');
const JWT_SECRET = process.env.JWT_SECRET
  || (isProduction ? '' : 'markdown-mash-secret-key-change-in-production');
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;
const HOSTED_MODE = process.env.HOSTED_MODE === 'true';
const HOSTED_MAX_PARTICIPANTS = resolvePersistentParticipantLimit({
  hostedMode: HOSTED_MODE,
  configuredLimit: process.env.HOSTED_MAX_PARTICIPANTS
});
const STRIPE_BILLING_ENABLED = process.env.STRIPE_BILLING_ENABLED === 'true';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || '';
const APP_BASE_URL = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
const HOSTED_INVITE_TTL_HOURS = resolveInviteTtlHours(process.env.HOSTED_INVITE_TTL_HOURS);
const PUBLIC_SIGNUP_ENABLED = process.env.PUBLIC_SIGNUP_ENABLED === 'true';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const EMAIL_FROM = process.env.EMAIL_FROM || '';
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || '';
const RESEND_API_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';
const GUEST_TRIAL_ENABLED = process.env.GUEST_TRIAL_ENABLED !== 'false';
const GUEST_TRIAL_TTL_MINUTES = Math.max(
  5,
  parseInt(process.env.GUEST_TRIAL_TTL_MINUTES, 10) || 20
);
const GUEST_TRIAL_MAX_PARTICIPANTS = Math.max(
  1,
  parseInt(process.env.GUEST_TRIAL_MAX_PARTICIPANTS, 10) || 8
);
const GUEST_TRIAL_MAX_CONCURRENT = Math.max(
  1,
  parseInt(process.env.GUEST_TRIAL_MAX_CONCURRENT, 10) || 25
);
const GUEST_TRIAL_STARTS_PER_IP_HOUR = Math.max(
  1,
  parseInt(process.env.GUEST_TRIAL_STARTS_PER_IP_HOUR, 10) || 5
);
const GUEST_TRIAL_SECRET = process.env.GUEST_TRIAL_JWT_SECRET
  || crypto.createHash('sha256').update(`${JWT_SECRET}:guest-trial`).digest('hex');

if (isProduction) {
  const invalidConfiguration = [];
  if (!process.env.DATABASE_URL) invalidConfiguration.push('DATABASE_URL');
  if (!JWT_SECRET || JWT_SECRET.length < 32) invalidConfiguration.push('JWT_SECRET (32+ characters)');
  if (!process.env.GUEST_TRIAL_JWT_SECRET
    || process.env.GUEST_TRIAL_JWT_SECRET.length < 32
    || process.env.GUEST_TRIAL_JWT_SECRET === JWT_SECRET) {
    invalidConfiguration.push('GUEST_TRIAL_JWT_SECRET (32+ characters and different from JWT_SECRET)');
  }
  if (STRIPE_BILLING_ENABLED) {
    if (!HOSTED_MODE) invalidConfiguration.push('HOSTED_MODE=true when Stripe billing is enabled');
    if (!/^(sk|rk)_/.test(STRIPE_SECRET_KEY)) invalidConfiguration.push('STRIPE_SECRET_KEY');
    if (!STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) invalidConfiguration.push('STRIPE_WEBHOOK_SECRET');
    if (!STRIPE_PRICE_ID.startsWith('price_')) invalidConfiguration.push('STRIPE_PRICE_ID');
    if (!APP_BASE_URL.startsWith('https://')) invalidConfiguration.push('APP_BASE_URL (HTTPS)');
  }
  if (PUBLIC_SIGNUP_ENABLED) {
    if (!HOSTED_MODE) invalidConfiguration.push('HOSTED_MODE=true when public signup is enabled');
    if (!STRIPE_BILLING_ENABLED) invalidConfiguration.push('STRIPE_BILLING_ENABLED=true when public signup is enabled');
    if (!RESEND_API_KEY.startsWith('re_')) invalidConfiguration.push('RESEND_API_KEY');
    if (!EMAIL_FROM) invalidConfiguration.push('EMAIL_FROM');
    if (!EMAIL_REPLY_TO) invalidConfiguration.push('EMAIL_REPLY_TO');
    if (!APP_BASE_URL.startsWith('https://')) invalidConfiguration.push('APP_BASE_URL (HTTPS)');
  }
  if (invalidConfiguration.length > 0) {
    throw new Error(`Unsafe production configuration: ${invalidConfiguration.join(', ')}`);
  }
}

const stripe = STRIPE_BILLING_ENABLED ? new Stripe(STRIPE_SECRET_KEY) : null;
const stripeBilling = STRIPE_BILLING_ENABLED
  ? createStripeBillingService({
      stripe,
      db,
      priceId: STRIPE_PRICE_ID,
      appBaseUrl: APP_BASE_URL
    })
  : null;
const emailService = createEmailService({
  apiKey: RESEND_API_KEY,
  from: EMAIL_FROM,
  replyTo: EMAIL_REPLY_TO,
  apiUrl: RESEND_API_URL
});
const publicRegistrationAvailable = Boolean(
  HOSTED_MODE
  && PUBLIC_SIGNUP_ENABLED
  && stripeBilling
  && emailService.configured
  && APP_BASE_URL
);

app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
  if (!stripeBilling) {
    return res.status(404).json({ success: false, error: 'Stripe billing is not enabled' });
  }

  try {
    const signature = req.get('stripe-signature');
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
    const payloadDigest = crypto.createHash('sha256').update(req.body).digest('hex');
    const result = await stripeBilling.processEvent(event, payloadDigest);
    if (result?.subscription && !hasHostedRoomEntitlement(result.subscription)) {
      const accountId = result.subscription.account_id || result.subscription.accountId;
      const account = accountId ? await db.getAdminById(accountId) : null;
      const billingFailure = getHostedBillingFailure({
        billingEnabled: STRIPE_BILLING_ENABLED,
        hostedMode: HOSTED_MODE,
        admin: account ? adminPrincipal(account) : null,
        subscription: result.subscription
      });
      if (!billingFailure) return res.json({ received: true, duplicate: Boolean(result?.duplicate) });
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.principal?.id === accountId) {
          socket.emit('control_error', {
            message: 'The hosted subscription is no longer active.'
          });
          socket.disconnect(true);
        }
      }
    }
    return res.json({ received: true, duplicate: Boolean(result?.duplicate) });
  } catch (error) {
    if (error?.type === 'StripeSignatureVerificationError') {
      return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
    }
    console.error('Stripe webhook error:', error);
    return res.status(500).json({ success: false, error: 'Webhook processing failed' });
  }
});

app.use(express.json({ limit: '1mb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many login attempts. Please try again later.' }
});
const recoveryQuestionsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many recovery requests. Please try again later.' }
});
const recoveryVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many recovery attempts. Please try again later.' }
});
const billingSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many billing requests. Please try again shortly.' }
});
const invitationInspectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many invitation requests. Please try again later.' }
});
const invitationActivateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, error: 'Too many activation attempts. Please try again later.' }
});
const invitationCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many invitation creations. Please try again later.' }
});
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please try again later.' }
});
const guestQuizMarkdown = fs.readFileSync(
  path.join(__dirname, 'demo-quizzes', 'quick-wins.md'),
  'utf8'
);
const trialManager = createTrialManager({
  secret: GUEST_TRIAL_SECRET,
  ttlMs: GUEST_TRIAL_TTL_MINUTES * 60 * 1000,
  maxConcurrent: GUEST_TRIAL_MAX_CONCURRENT,
  startsPerIpHour: GUEST_TRIAL_STARTS_PER_IP_HOUR
});

// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================
async function authenticateToken(req, res, next) {
  if (req.admin?.id) return next();

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.id || payload.type === 'trial') {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }

    const account = await db.getAdminById(payload.id);
    const failure = getAccountAuthenticationFailure(account, { hostedMode: HOSTED_MODE });
    if (failure) {
      return res.status(403).json({
        success: false,
        code: failure.code,
        error: failure.message
      });
    }

    req.admin = adminPrincipal(account);
    return next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired token' });
  }
}

// ============================================
// SESSION-KEYED STATE (replaces global store)
// ============================================
// In-memory active sessions: sessionCode -> sessionState
const activeSessions = new Map();

function createSessionState({
  id,
  code,
  quiz,
  kind,
  controller,
  repository,
  expiresAt = null,
  participantLimit = null
}) {
  return {
    id,
    code,
    quiz,
    kind,
    controller,
    repository,
    expiresAt,
    participantLimit,
    pendingParticipantJoins: 0,
    sidekickState: createSidekickState(),
    sidekicksEnabled: true,
    participants: Object.create(null),
    quizState: {
      isRunning: false,
      currentStepIndex: -1,
      questionEndTime: null,
      showingResults: false,
      autopilot: false,
      autopilotPauseSeconds: autopilot.DEFAULT_PAUSE_SECONDS,
      autopilotResumeAt: null,
      allAnsweredEmittedFor: null
    },
    autopilotTimer: null,
    questionStartTime: null,
    rankSnapshot: {},
    lastQuestionPresentation: null,
    finale: null
  };
}

// Session state structure:
// {
//   id: number (database id),
//   code: string,
//   quiz: object,
//   participants: { participantId: { id, name, score, correctCount, answers: {}, responseTimes: {}, socketId } },
//   quizState: { isRunning, currentStepIndex, questionEndTime, showingResults, autopilot, autopilotPauseSeconds, autopilotResumeAt, allAnsweredEmittedFor },
//   questionStartTime: number (for response time tracking),
//   rankSnapshot: { participantId: rank },
//   lastQuestionPresentation: object,
//   finale: object
// }

// ============================================
// HELPER FUNCTIONS
// ============================================
function getQuestionForParticipants(question) {
  // Send question without correct answers
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit,
    type: question.type,
    gradedNumber: question.gradedNumber
  };
}

// The flow index walks steps[], which mixes sections and questions, so the
// current question is a lookup rather than an array index.
function currentQuestionOf(session) {
  if (!session || !session.quiz) return null;
  return questionForStep(session.quiz, session.quizState.currentStepIndex);
}

function calculateStats(session, questionId) {
  const question = session.quiz.questions.find(q => q.id === questionId);
  if (!question) return null;

  const stats = question.options.map(() => 0);
  let totalAnswered = 0;

  for (const participant of Object.values(session.participants)) {
    const answer = participant.answers[questionId];
    if (answer !== undefined && answer !== null) {
      stats[answer]++;
      totalAnswered++;
    }
  }

  return {
    counts: stats,
    totalAnswered,
    totalParticipants: Object.keys(session.participants).length
  };
}

async function generateQRCode(url) {
  try {
    return await QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#6366f1',
        light: '#0f172a'
      }
    });
  } catch (err) {
    console.error('QR code generation error:', err);
    return null;
  }
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization;
  return authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
}

function createPresenterToken(session) {
  return jwt.sign(
    {
      type: 'presenter',
      sessionCode: session.code,
      sessionId: String(session.id)
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

function presenterCanView(principal, session) {
  return Boolean(
    principal?.type === 'presenter'
    && principal.sessionCode === session.code
    && principal.sessionId === String(session.id)
  );
}

function createParticipantCredential() {
  const token = createOpaqueToken();
  return {
    token,
    digest: hashOpaqueToken(token)
  };
}

function canReuseParticipantCredential(participant, name, token) {
  return canReuseParticipant(participant, name)
    && verifyOpaqueToken(token, participant.accessTokenDigest);
}

function authenticateTrial(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Practice-room access required' });
  }

  try {
    req.trial = trialManager.authenticate(token);
    return next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      code: error.code || 'TRIAL_TOKEN_INVALID',
      error: error.message || 'This practice room is no longer available.'
    });
  }
}

function adminPrincipal(admin) {
  return {
    type: 'admin',
    id: admin.id,
    role: admin.role,
    username: admin.username,
    accountStatus: admin.account_status || admin.accountStatus || 'active',
    authSource: admin.auth_source || admin.authSource || 'deployment',
    provisioningSource: admin.provisioning_source || admin.provisioningSource || 'deployment',
    accessOverride: admin.access_override || admin.accessOverride || 'none',
    complimentaryAccessUntil: admin.complimentary_access_until || admin.complimentaryAccessUntil || null
  };
}

function requireMaster(req, res, next) {
  if (req.admin?.role !== 'master') {
    return res.status(403).json({ success: false, error: 'Master account access is required' });
  }
  return next();
}

async function hostedBillingFailureForAdmin(admin) {
  const subscription = STRIPE_BILLING_ENABLED
    ? await db.getSubscriptionByAccountId(admin.id)
    : null;
  return getHostedBillingFailure({
    billingEnabled: STRIPE_BILLING_ENABLED,
    hostedMode: HOSTED_MODE,
    admin,
    subscription
  });
}

async function authorizeAdminSession(req, res, next) {
  const { code } = req.params;
  const activeSession = activeSessions.get(code);

  if (activeSession) {
    if (activeSession.kind !== 'persistent'
      || !canControlSession(adminPrincipal(req.admin), activeSession)) {
      return res.status(403).json({ success: false, error: 'Session access denied' });
    }
    req.activeSession = activeSession;
    return next();
  }

  try {
    const storedSession = await db.getSession(code);
    if (!storedSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    if (!canAdminAccessStoredSession(req.admin, storedSession)) {
      return res.status(403).json({ success: false, error: 'Session access denied' });
    }
    req.storedSession = storedSession;
    return next();
  } catch (error) {
    console.error('Session authorization error:', error);
    return res.status(500).json({ success: false, error: 'Unable to verify session access' });
  }
}

function requireTrialSession(req, res, next) {
  const { code } = req.params;
  const session = activeSessions.get(code);
  const principal = {
    type: 'trial',
    id: req.trial.id
  };

  if (!session || session.kind !== 'trial') {
    return res.status(404).json({ success: false, error: 'Practice room not found' });
  }
  if (req.trial.sessionCode !== code || !canControlSession(principal, session)) {
    return res.status(403).json({ success: false, error: 'Practice-room access denied' });
  }

  req.activeSession = session;
  return next();
}

function generateTrialSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = 'T';
    for (let index = 0; index < 5; index++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    if (!activeSessions.has(code)) return code;
  }
  throw new Error('Unable to allocate a practice-room code');
}

function sessionResponse(req, session, qrCode) {
  const presenterToken = createPresenterToken(session);
  return {
    code: session.code,
    quiz: session.quiz,
    qrCode,
    joinUrl: `${req.protocol}://${req.get('host')}/play.html?session=${session.code}`,
    presenterUrl: `${req.protocol}://${req.get('host')}/present.html#session=${session.code}&token=${encodeURIComponent(presenterToken)}`,
    kind: session.kind,
    participantLimit: session.participantLimit,
    expiresAt: session.expiresAt
  };
}

function expireTrial(trial) {
  const session = activeSessions.get(trial.sessionCode);
  if (session?.kind === 'trial' && session.controller?.id === trial.id) {
    io.to(`session:${trial.sessionCode}`).emit('trial_expired', {
      message: 'This temporary practice room has expired.'
    });
    io.to(`admin:${trial.sessionCode}`).emit('trial_expired', {
      message: 'Your temporary practice room has expired.'
    });
    io.to(`presenter:${trial.sessionCode}`).emit('trial_expired', {
      message: 'This temporary practice room has expired.'
    });
    clearAutopilotTimer(session);
    activeSessions.delete(trial.sessionCode);
  }
}

const trialCleanupInterval = setInterval(() => {
  trialManager.removeExpired().forEach(expireTrial);
}, 60 * 1000);
trialCleanupInterval.unref();

// Every instructor route requires a real admin token except login and recovery.
app.use('/api/admin', (req, res, next) => {
  const publicAdminPaths = new Set([
    '/auth/config',
    '/login',
    '/register',
    '/invite/inspect',
    '/invite/activate',
    '/recovery/questions',
    '/recovery/verify'
  ]);
  if (publicAdminPaths.has(req.path)) return next();
  return authenticateToken(req, res, next);
});

// ============================================
// REST API ENDPOINTS
// ============================================

app.get('/api/admin/auth/config', (req, res) => {
  res.json({
    success: true,
    hostedMode: HOSTED_MODE,
    emailLogin: HOSTED_MODE,
    publicSignup: publicRegistrationAvailable,
    publicRegistration: publicRegistrationAvailable,
    invitationActivation: HOSTED_MODE,
    billingEnabled: STRIPE_BILLING_ENABLED,
    hostedPlan: {
      name: 'Markdown Mash Hosted',
      amount: 15,
      currency: 'USD',
      interval: 'year'
    }
  });
});

app.post('/api/admin/register', registrationLimiter, async (req, res) => {
  if (!publicRegistrationAvailable) {
    return res.status(404).json({ success: false, error: 'Public registration is not enabled' });
  }
  const email = normalizeEmail(req.body?.email);
  const displayName = String(req.body?.displayName || '').trim();
  if (!isValidEmail(email) || !displayName || displayName.length > 120) {
    return res.status(400).json({ success: false, error: 'Enter a valid name and email address' });
  }

  const genericResponse = {
    success: true,
    message: 'If this email can be registered, a verification link is on its way.'
  };
  try {
    const token = createOpaqueToken();
    const result = await db.createSelfServiceRegistration({
      email,
      displayName,
      username: `hosted_${crypto.randomUUID()}`,
      passwordHash: await bcrypt.hash(createOpaqueToken(), SALT_ROUNDS),
      tokenHash: hashOpaqueToken(token),
      expiresAt: invitationExpiry(HOSTED_INVITE_TTL_HOURS)
    });
    if (!result) return res.status(202).json(genericResponse);

    const inviteUrl = buildInvitationUrl(APP_BASE_URL, token);
    await emailService.sendAccountVerification({
      to: result.account.email,
      displayName: result.account.display_name,
      inviteUrl,
      invitationId: result.invitation.id,
      expiresAt: result.invitation.expires_at
    });
    try {
      await db.logActivity(result.account.id, 'self_service_verification_sent', {}, req.ip);
    } catch (auditError) {
      console.error('Registration audit error:', auditError);
    }
    return res.status(202).json(genericResponse);
  } catch (error) {
    if (error.code === '23505') return res.status(202).json(genericResponse);
    console.error('Public registration error:', error);
    return res.status(503).json({ success: false, error: 'Unable to send a verification email right now' });
  }
});

app.post('/api/admin/invite/inspect', invitationInspectLimiter, async (req, res) => {
  if (!HOSTED_MODE) {
    return res.status(404).json({ success: false, error: 'Hosted invitations are not enabled' });
  }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  if (token.length < 32 || token.length > 256) {
    return res.status(404).json({ success: false, error: 'This invitation is invalid or expired' });
  }

  try {
    const invitation = await db.getHostedAccountInvitation(hashOpaqueToken(token));
    if (!invitation) {
      return res.status(404).json({ success: false, error: 'This invitation is invalid or expired' });
    }
    return res.json({
      success: true,
      invitation: {
        displayName: invitation.display_name,
        maskedEmail: maskEmail(invitation.email),
        expiresAt: invitation.expires_at
      }
    });
  } catch (error) {
    console.error('Invitation inspection error:', error);
    return res.status(500).json({ success: false, error: 'Unable to inspect this invitation' });
  }
});

app.post('/api/admin/invite/activate', invitationActivateLimiter, async (req, res) => {
  if (!HOSTED_MODE) {
    return res.status(404).json({ success: false, error: 'Hosted invitations are not enabled' });
  }
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = req.body?.password;
  if (token.length < 32 || token.length > 256) {
    return res.status(404).json({ success: false, error: 'This invitation is invalid or expired' });
  }
  const passwordError = getInvitationPasswordError(password);
  if (passwordError) {
    return res.status(400).json({ success: false, error: passwordError });
  }

  try {
    // Hashing before token lookup keeps invalid-token attempts computationally expensive.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const activated = await db.activateHostedAccountInvitation({
      tokenHash: hashOpaqueToken(token),
      passwordHash
    });
    if (!activated) {
      return res.status(404).json({ success: false, error: 'This invitation is invalid or expired' });
    }
    try {
      await db.logActivity(activated.account_id, 'hosted_account_activated', {}, req.ip);
    } catch (auditError) {
      console.error('Invitation activation audit error:', auditError);
    }
    return res.json({
      success: true,
      email: activated.email,
      message: 'Your hosted account is ready.',
      checkoutAfterActivation: activated.purpose === 'self_signup' && STRIPE_BILLING_ENABLED
    });
  } catch (error) {
    console.error('Invitation activation error:', error);
    return res.status(500).json({ success: false, error: 'Unable to activate this invitation' });
  }
});

app.post(
  '/api/admin/invitations',
  requireMaster,
  invitationCreateLimiter,
  async (req, res) => {
    if (!HOSTED_MODE) {
      return res.status(404).json({ success: false, error: 'Hosted invitations are not enabled' });
    }

    const email = normalizeEmail(req.body?.email);
    const displayName = String(req.body?.displayName || '').trim();
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Enter a valid host email' });
    }
    if (!displayName || displayName.length > 120) {
      return res.status(400).json({ success: false, error: 'Display name is required and must be 120 characters or fewer' });
    }

    try {
      const token = createOpaqueToken();
      const placeholderPasswordHash = await bcrypt.hash(createOpaqueToken(), SALT_ROUNDS);
      const result = await db.createHostedAccountInvitation({
        email,
        displayName,
        username: `hosted_${crypto.randomUUID()}`,
        passwordHash: placeholderPasswordHash,
        tokenHash: hashOpaqueToken(token),
        expiresAt: invitationExpiry(HOSTED_INVITE_TTL_HOURS),
        createdBy: req.admin.id
      });
      const baseUrl = APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const inviteUrl = buildInvitationUrl(baseUrl, token);
      try {
        await db.logActivity(req.admin.id, 'hosted_invitation_created', {
          accountId: result.account.id,
          email
        }, req.ip);
      } catch (auditError) {
        console.error('Invitation creation audit error:', auditError);
      }

      return res.status(201).json({
        success: true,
        invitation: {
          accountId: result.account.id,
          displayName: result.account.display_name,
          email: result.account.email,
          expiresAt: result.invitation.expires_at,
          inviteUrl
        }
      });
    } catch (error) {
      if (error.code === 'ACCOUNT_ALREADY_EXISTS' || error.code === '23505') {
        return res.status(409).json({ success: false, error: 'A host account already uses this email address' });
      }
      console.error('Invitation creation error:', error);
      return res.status(500).json({ success: false, error: 'Unable to create this invitation' });
    }
  }
);

app.get('/api/admin/instructors', requireMaster, async (req, res) => {
  try {
    const instructors = await db.listHostedInstructors();
    return res.json({
      success: true,
      instructors: instructors.map(instructor => ({
        id: instructor.id,
        email: instructor.email,
        displayName: instructor.display_name,
        accountStatus: instructor.account_status,
        provisioningSource: instructor.provisioning_source,
        accessOverride: instructor.access_override,
        complimentaryAccessUntil: instructor.complimentary_access_until,
        emailVerified: Boolean(instructor.email_verified_at),
        subscriptionStatus: instructor.subscription_status,
        currentPeriodEnd: instructor.current_period_end,
        cancelAtPeriodEnd: instructor.cancel_at_period_end,
        invitationExpiresAt: instructor.invitation_expires_at,
        invitationUsedAt: instructor.invitation_used_at,
        createdAt: instructor.created_at
      }))
    });
  } catch (error) {
    console.error('Hosted instructor list error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load hosted accounts' });
  }
});

app.patch('/api/admin/instructors/:accountId/access', requireMaster, async (req, res) => {
  const accountId = Number.parseInt(req.params.accountId, 10);
  const mode = req.body?.mode;
  if (!Number.isInteger(accountId) || accountId <= 0
    || !['none', 'temporary', 'permanent'].includes(mode)) {
    return res.status(400).json({ success: false, error: 'Choose a valid access mode' });
  }
  let expiresAt = null;
  if (mode === 'temporary') {
    expiresAt = new Date(req.body?.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      return res.status(400).json({ success: false, error: 'Choose a future expiration date' });
    }
  }
  try {
    const override = await db.setHostedAccessOverride(accountId, { mode, expiresAt });
    if (!override) return res.status(404).json({ success: false, error: 'Hosted account not found' });
    await db.logActivity(req.admin.id, 'hosted_access_override_updated', {
      accountId,
      mode,
      expiresAt: expiresAt?.toISOString() || null
    }, req.ip);
    return res.json({ success: true, access: {
      mode,
      expiresAt: override.complimentary_access_until
    } });
  } catch (error) {
    console.error('Hosted access override error:', error);
    return res.status(500).json({ success: false, error: 'Unable to update complimentary access' });
  }
});

app.get('/api/admin/billing', async (req, res) => {
  try {
    const applicable = HOSTED_MODE
      && req.admin.role !== 'master'
      && req.admin.authSource === 'hosted';
    let subscription = null;
    if (applicable) {
      subscription = await db.getSubscriptionByAccountId(req.admin.id);
      if (stripeBilling && subscription?.provider_subscription_id) {
        try {
          const account = await db.getAdminById(req.admin.id);
          subscription = await stripeBilling.refreshSubscription(account);
        } catch (error) {
          console.error('Stripe billing refresh error:', error.message);
        }
      }
    }

    return res.json({
      success: true,
      enabled: STRIPE_BILLING_ENABLED,
      applicable,
      plan: {
        name: 'Markdown Mash Hosted',
        amount: 15,
        currency: 'USD',
        interval: 'year',
        participantLimit: HOSTED_MAX_PARTICIPANTS
      },
      subscription: subscription
        ? {
            status: subscription.status,
            currentPeriodEnd: subscription.current_period_end,
            cancelAtPeriodEnd: subscription.cancel_at_period_end
          }
        : null,
      complimentaryAccess: hasComplimentaryRoomEntitlement(req.admin)
        ? { until: req.admin.complimentaryAccessUntil }
        : null
    });
  } catch (error) {
    console.error('Billing status error:', error);
    return res.status(500).json({ success: false, error: 'Unable to load billing status' });
  }
});

app.post('/api/admin/billing/checkout', billingSessionLimiter, async (req, res) => {
  if (!stripeBilling) {
    return res.status(503).json({ success: false, error: 'Billing is not available yet' });
  }

  try {
    const account = await db.getAdminById(req.admin.id);
    const session = await stripeBilling.createCheckoutSession(account);
    return res.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof BillingRequestError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        error: error.message
      });
    }
    console.error('Stripe checkout error:', error);
    return res.status(502).json({ success: false, error: 'Unable to start Stripe Checkout' });
  }
});

app.post('/api/admin/billing/portal', billingSessionLimiter, async (req, res) => {
  if (!stripeBilling) {
    return res.status(503).json({ success: false, error: 'Billing is not available yet' });
  }

  try {
    const account = await db.getAdminById(req.admin.id);
    const session = await stripeBilling.createPortalSession(account);
    return res.json({ success: true, url: session.url });
  } catch (error) {
    if (error instanceof BillingRequestError) {
      return res.status(error.status).json({
        success: false,
        code: error.code,
        error: error.message
      });
    }
    console.error('Stripe portal error:', error);
    return res.status(502).json({ success: false, error: 'Unable to open the billing portal' });
  }
});

app.get('/api/trial/config', (req, res) => {
  res.json({
    success: true,
    enabled: GUEST_TRIAL_ENABLED,
    ttlMinutes: GUEST_TRIAL_TTL_MINUTES,
    participantLimit: GUEST_TRIAL_MAX_PARTICIPANTS
  });
});

app.post('/api/trial', (req, res) => {
  if (!GUEST_TRIAL_ENABLED) {
    return res.status(404).json({ success: false, error: 'Guest trials are not enabled' });
  }

  try {
    const trial = trialManager.create({
      ipAddress: req.ip || req.connection.remoteAddress,
      sessionCode: generateTrialSessionCode()
    });
    const quiz = parseQuizMarkdown(guestQuizMarkdown);

    return res.status(201).json({
      success: true,
      token: trial.token,
      trial: {
        id: trial.id,
        sessionCode: trial.sessionCode,
        expiresAt: trial.expiresAt,
        ttlMinutes: GUEST_TRIAL_TTL_MINUTES,
        participantLimit: GUEST_TRIAL_MAX_PARTICIPANTS
      },
      template: {
        title: quiz.title,
        questionCount: quiz.questions.length,
        markdown: guestQuizMarkdown
      }
    });
  } catch (error) {
    const status = error.code === 'TRIAL_RATE_LIMITED' ? 429 : 503;
    return res.status(status).json({
      success: false,
      code: error.code || 'TRIAL_UNAVAILABLE',
      error: error.message || 'Unable to create a practice room'
    });
  }
});

app.get('/api/trial', authenticateTrial, (req, res) => {
  const trial = trialManager.get(req.trial.id);
  const session = activeSessions.get(req.trial.sessionCode);
  const quiz = parseQuizMarkdown(guestQuizMarkdown);

  res.json({
    success: true,
    trial: {
      id: trial.id,
      sessionCode: trial.sessionCode,
      expiresAt: trial.expiresAt,
      participantLimit: GUEST_TRIAL_MAX_PARTICIPANTS,
      launched: Boolean(session)
    },
    template: {
      title: quiz.title,
      questionCount: quiz.questions.length,
      markdown: guestQuizMarkdown
    },
    session: session
      ? {
          code: session.code,
          quiz: session.quiz,
          state: session.quizState,
          participantCount: Object.keys(session.participants).length
        }
      : null
  });
});

app.post('/api/trial/session', authenticateTrial, async (req, res) => {
  if (!GUEST_TRIAL_ENABLED) {
    return res.status(404).json({ success: false, error: 'Guest trials are not enabled' });
  }

  const trial = trialManager.get(req.trial.id);
  if (!trial) {
    return res.status(403).json({ success: false, error: 'This practice room has expired' });
  }

  try {
    let session = activeSessions.get(trial.sessionCode);
    if (!session) {
      const quiz = parseQuizMarkdown(guestQuizMarkdown);
      session = createSessionState({
        id: `trial:${trial.id}`,
        code: trial.sessionCode,
        quiz,
        kind: 'trial',
        controller: { type: 'trial', id: trial.id },
        repository: createTransientSessionRepository(),
        expiresAt: trial.expiresAt,
        participantLimit: GUEST_TRIAL_MAX_PARTICIPANTS
      });
      activeSessions.set(session.code, session);
      trialManager.markLaunched(trial.id);
    }

    if (session.kind !== 'trial' || session.controller.id !== trial.id) {
      return res.status(409).json({ success: false, error: 'Practice-room code collision' });
    }

    const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${session.code}`;
    const qrCode = await generateQRCode(joinUrl);
    return res.json({
      success: true,
      session: sessionResponse(req, session, qrCode)
    });
  } catch (error) {
    console.error('Practice-room launch error:', error);
    return res.status(500).json({ success: false, error: 'Unable to launch the practice room' });
  }
});

app.post(
  '/api/trial/session/:code/end',
  authenticateTrial,
  requireTrialSession,
  async (req, res) => {
    const session = req.activeSession;
    await session.repository.updateStatus('ended');

    io.to(`session:${session.code}`).emit('session_ended', {
      message: 'This practice session has ended. Thanks for playing!'
    });
    io.to(`admin:${session.code}`).emit('session_ended', {
      code: session.code,
      message: 'Practice session ended'
    });
    io.to(`presenter:${session.code}`).emit('session_ended', {
      message: 'This practice session has ended.'
    });
    clearAutopilotTimer(session);
    activeSessions.delete(session.code);
    res.json({ success: true, message: 'Practice session ended' });
  }
);

app.get(
  '/api/trial/session/:code/results',
  authenticateTrial,
  requireTrialSession,
  (req, res) => {
    const session = req.activeSession;
    const results = rankParticipants(session).map(participant => ({
      name: participant.name,
      score: participant.correctCount,
      total: session.quiz.questions.length,
      avgResponseTime: participant.avgResponseTimeMs
    }));
    res.json({ success: true, results });
  }
);

// Admin login
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { password, email } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  try {
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'Password is required' });
    }

    const normalizedEmail = HOSTED_MODE ? normalizeEmail(email) : null;
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Enter a valid email address' });
    }

    // Hosted instructors authenticate by email. A blank email intentionally retains
    // the deployment-master bootstrap path for self-hosting and operator access.
    let admin = normalizedEmail
      ? await db.getAdminByEmail(normalizedEmail)
      : await db.getMasterAdmin();

    if (!admin) {
      if (normalizedEmail) {
        return res.status(401).json({ success: false, error: 'Invalid email or password' });
      }
      if (!adminPassword || adminPassword.length < 12) {
        return res.status(503).json({
          success: false,
          error: 'Initial setup requires ADMIN_PASSWORD with at least 12 characters'
        });
      }

      // First login - create master admin from env password
      if (password === adminPassword) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        admin = await db.createAdmin({
          username: 'admin',
          passwordHash,
          displayName: 'Master Admin',
          role: 'master',
          createdBy: null
        });

        await db.logActivity(admin.id, 'account_created', { method: 'first_login' }, ipAddress);

        const token = jwt.sign(
          { type: 'admin', id: admin.id, username: admin.username, role: admin.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );

        return res.json({
          success: true,
          token,
          admin: {
            id: admin.id,
            username: admin.username,
            role: admin.role,
            displayName: admin.display_name,
            email: admin.email,
            emailVerified: Boolean(admin.email_verified_at),
            accountStatus: admin.account_status || 'active',
            authSource: admin.auth_source || 'deployment',
            hasSecurityQuestions: false
          },
          isFirstLogin: true
        });
      } else {
        return res.status(401).json({ success: false, error: 'Invalid password' });
      }
    }

    // Admin exists - check if locked
    if (await db.isAdminLocked(admin.id)) {
      return res.status(429).json({
        success: false,
        error: 'Account temporarily locked. Please try again in 5 minutes.'
      });
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, admin.password_hash);

    if (!passwordValid) {
      const lockInfo = await db.recordFailedLogin(admin.id);
      await db.logActivity(admin.id, 'failed_login', { attempts: lockInfo.failed_login_attempts }, ipAddress);

      const attemptsLeft = 5 - lockInfo.failed_login_attempts;
      if (attemptsLeft > 0) {
        return res.status(401).json({
          success: false,
          error: normalizedEmail
            ? 'Invalid email or password'
            : `Invalid password. ${attemptsLeft} attempts remaining.`
        });
      } else {
        return res.status(429).json({
          success: false,
          error: 'Account locked for 5 minutes due to too many failed attempts.'
        });
      }
    }

    const accountFailure = getAccountAuthenticationFailure(admin, { hostedMode: HOSTED_MODE });
    if (accountFailure) {
      return res.status(403).json({
        success: false,
        code: accountFailure.code,
        error: accountFailure.message
      });
    }

    // Successful login
    await db.resetLoginAttempts(admin.id);
    await db.logActivity(admin.id, 'login', {}, ipAddress);

    const token = jwt.sign(
      { type: 'admin', id: admin.id, username: admin.username, role: admin.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Check if security questions are set
    const hasSecurityQuestions = admin.security_question_1 && admin.security_answer_1;

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        displayName: admin.display_name,
        email: admin.email,
        emailVerified: Boolean(admin.email_verified_at),
        accountStatus: admin.account_status || 'active',
        authSource: admin.auth_source || 'deployment',
        hasSecurityQuestions
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Create a new session (upload quiz, get session code + QR)
app.post('/api/admin/session', async (req, res) => {
  const { markdown, courseName } = req.body;
  try {
    const quiz = parseQuizMarkdown(markdown);

    const billingFailure = await hostedBillingFailureForAdmin(req.admin);
    if (billingFailure) {
      return res.status(402).json({
        success: false,
        code: billingFailure.code,
        error: billingFailure.message
      });
    }

    // Create session in database
    const { id, code, quizData } = await db.createSession(
      quiz,
      courseName,
      req.admin.id,
      {
        enforceSingleOpenRoom: shouldEnforceSingleOpenRoom({
          hostedMode: HOSTED_MODE,
          admin: req.admin
        })
      }
    );

    // Create in-memory session state
    const sessionState = createSessionState({
      id,
      code,
      quiz,
      kind: 'persistent',
      controller: { type: 'admin', id: req.admin.id },
      repository: createPersistentSessionRepository(db, id, code),
      participantLimit: resolveParticipantLimitForAdmin(req.admin, HOSTED_MAX_PARTICIPANTS)
    });
    activeSessions.set(code, sessionState);

    // Generate QR code
    const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${code}`;
    const qrCode = await generateQRCode(joinUrl);

    res.json({
      success: true,
      session: sessionResponse(req, sessionState, qrCode)
    });
  } catch (err) {
    console.error('Session creation error:', err);
    if (err.code === HOSTED_ROOM_LIMIT_CODE) {
      return res.status(409).json({
        success: false,
        code: HOSTED_ROOM_LIMIT_CODE,
        error: err.message,
        activeSession: err.existingSession
      });
    }
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get QR code for a session
app.get('/api/admin/session/:code/qr', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const session = req.activeSession;

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${code}`;
  const qrCode = await generateQRCode(joinUrl);

  res.json({ success: true, qrCode, joinUrl });
});

// Public presenter lookup. This exposes only the participant join URL and its QR code.
app.get('/api/session/:code/qr', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  if (!activeSessions.has(code)) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${code}`;
  const qrCode = await generateQRCode(joinUrl);
  res.json({ success: true, qrCode, joinUrl });
});

// End a session
app.post('/api/admin/session/:code/end', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const session = req.activeSession;

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  // Update database status
  await session.repository.updateStatus('ended');

  // Save final participant scores to database
  for (const participant of Object.values(session.participants)) {
    await session.repository.updateParticipantScore(
      participant.id,
      participant.score || 0,
      participant.correctCount || 0
    );
  }

  // Notify all clients in this session
  io.to(`session:${code}`).emit('session_ended', {
    message: 'This session has ended. Thank you for participating!'
  });

  // Notify admin room
  io.to(`admin:${code}`).emit('session_ended', {
    code,
    message: 'Session ended successfully'
  });
  io.to(`presenter:${code}`).emit('session_ended', {
    message: 'This session has ended.'
  });

  // Remove from active sessions
  clearAutopilotTimer(session);
  activeSessions.delete(code);

  res.json({ success: true, message: 'Session ended' });
});

// Get session info
app.get('/api/admin/session/:code', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const session = req.activeSession;

  if (!session) {
    // Try to get from database (might be ended session).
    const dbSession = req.storedSession;
    if (dbSession) {
      const participants = await db.getParticipantsBySession(dbSession.id);
      return res.json({
        success: true,
        session: {
          code: dbSession.code,
          quiz: dbSession.quiz_data,
          status: dbSession.status,
          participantCount: participants.length
        }
      });
    }
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  res.json({
    success: true,
    session: {
      code: session.code,
      quiz: session.quiz,
      state: session.quizState,
      participantCount: Object.keys(session.participants).length
    }
  });
});

// List session history
app.get('/api/admin/sessions', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const sessions = await db.listSessions(limit, ownerFilterFor(req.admin));
  res.json({ success: true, sessions });
});

// Update session metadata
app.post('/api/admin/session/:code/metadata', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const { courseName, isTest } = req.body;
  try {
    await db.updateSessionMetadata(code, courseName, isTest);
    res.json({ success: true, message: 'Metadata updated' });
  } catch (err) {
    console.error('Update metadata error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Delete a session permanently
app.delete('/api/admin/session/:code', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  try {
    // If it's active, remove it from memory too
    const activeSession = activeSessions.get(code);
    if (activeSession) {
      clearAutopilotTimer(activeSession);
      activeSessions.delete(code);
    }
    if (req.activeSession) {
      await req.activeSession.repository.deleteSession();
    } else {
      await db.deleteSession(code);
    }
    res.json({ success: true, message: 'Session deleted' });
  } catch (err) {
    console.error('Delete session error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Keep-alive ping — prevents Render free-tier from sleeping mid-quiz.
// The admin client calls this every 10 minutes while a session is active.
app.get('/api/admin/ping', (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Get participants for a session
app.get('/api/admin/session/:code/participants', authorizeAdminSession, (req, res) => {
  const { code } = req.params;
  const session = req.activeSession;

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const list = Object.values(session.participants).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    avatarId: p.avatarId,
    answeredCount: Object.keys(p.answers).length
  }));

  res.json({ participants: list });
});

// Get final results for a session
app.get('/api/admin/session/:code/results', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const session = req.activeSession;

  if (!session || !session.quiz) {
    return res.json({ results: [] });
  }

  const results = rankParticipants(session).map(participant => ({
    name: participant.name,
    score: participant.correctCount,
    total: session.quiz.questions.length,
    avgResponseTime: participant.avgResponseTimeMs
  }));

  res.json({ results });
});

// Join a specific session (replaces /api/join)
app.post('/api/session/:code/join', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const {
    name,
    existingParticipantId,
    existingParticipantToken
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }
  if (name.trim().length > 80) {
    return res.status(400).json({ success: false, error: 'Name must be 80 characters or fewer' });
  }
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return res.status(400).json({ success: false, error: 'Invalid session code' });
  }

  const session = activeSessions.get(code);
  if (!session) {
    return res.status(400).json({ success: false, error: 'Session not found or has ended' });
  }

  if (session.quizState.isRunning && session.quizState.currentStepIndex >= session.quiz.steps.length - 1) {
    return res.status(400).json({ success: false, error: 'Cannot join - quiz is ending' });
  }

  const isValidRejoin = Boolean(existingParticipantId
    && canReuseParticipantCredential(
      session.participants[existingParticipantId],
      name,
      existingParticipantToken
    ));
  const admission = getParticipantAdmission(session, { isValidRejoin });

  if (!admission.allowed) {
    return res.status(429).json({
      success: false,
      code: admission.code,
      error: `This room has reached its ${admission.participantLimit}-participant limit`,
      participantCount: admission.participantCount,
      participantLimit: admission.participantLimit
    });
  }

  // A verified reconnect keeps its original slot even when the room is full.
  if (isValidRejoin) {
    const existing = session.participants[existingParticipantId];

    return res.json({
      success: true,
      participantId: existingParticipantId,
      participantToken: existingParticipantToken,
      sessionCode: code,
      quizTitle: session.quiz.title,
      avatarId: existing.avatarId,
      canShuffleAvatar: getShuffleAvailability(session, existing).allowed
    });
  }

  // Reserve the seat before the async write so concurrent joins cannot oversubscribe the room.
  session.pendingParticipantJoins += 1;
  const avatarId = drawSidekick(session.sidekickState);
  let participantRecord;
  try {
    // Persistent sessions write through PostgreSQL; trials allocate only in memory.
    participantRecord = await session.repository.createParticipant(name.trim(), null, avatarId);
  } finally {
    session.pendingParticipantJoins -= 1;
  }

  const { id } = participantRecord;
  const participantCredential = createParticipantCredential();

  // Add to in-memory session
  session.participants[id] = {
    id,
    name: name.trim(),
    score: 0,
    correctCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    answers: {},
    responseTimes: {},
    socketId: null,
    avatarId: participantRecord.avatarId || avatarId,
    avatarShuffled: false,
    accessTokenDigest: participantCredential.digest
  };

  // Notify admin
  io.to(`admin:${code}`).emit('participant_joined', {
    id,
    name: name.trim(),
    avatarId: session.participants[id].avatarId,
    count: Object.keys(session.participants).length
  });
  io.to(`presenter:${code}`).emit('participant_joined', {
    count: Object.keys(session.participants).length
  });

  res.json({
    success: true,
    participantId: id,
    participantToken: participantCredential.token,
    sessionCode: code,
    quizTitle: session.quiz.title,
    avatarId: session.participants[id].avatarId,
    canShuffleAvatar: getShuffleAvailability(session, session.participants[id]).allowed
  });
});

app.post('/api/session/:code/sidekick/shuffle', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  const { participantId, participantToken } = req.body || {};
  const session = activeSessions.get(code);
  const participant = session?.participants?.[participantId];

  if (!session || !participant) {
    return res.status(404).json({ success: false, error: 'Session or participant not found' });
  }
  if (!verifyOpaqueToken(participantToken, participant.accessTokenDigest)) {
    return res.status(403).json({ success: false, error: 'Participant access expired' });
  }

  const availability = getShuffleAvailability(session, participant);
  if (!availability.allowed) {
    const messages = {
      SIDEKICKS_DISABLED: 'Sidekicks are disabled for this room',
      QUIZ_ALREADY_STARTED: 'Sidekicks can only be shuffled before the quiz starts',
      SIDEKICK_SHUFFLE_USED: 'You already used your Sidekick shuffle'
    };
    return res.status(409).json({
      success: false,
      code: availability.code,
      error: messages[availability.code]
    });
  }

  // Reserve the one-time shuffle before the async database write.
  const previousAvatarId = participant.avatarId;
  participant.avatarShuffled = true;
  const avatarId = drawSidekick(session.sidekickState, { excludeId: previousAvatarId });

  try {
    await session.repository.updateParticipantAvatar(participantId, avatarId);
    participant.avatarId = avatarId;
  } catch (error) {
    participant.avatarShuffled = false;
    participant.avatarId = previousAvatarId;
    console.error('Sidekick shuffle persistence error:', error);
    return res.status(500).json({
      success: false,
      error: 'Unable to save your Sidekick shuffle'
    });
  }

  const update = { participantId, avatarId };
  io.to(`admin:${code}`).emit('participant_avatar_updated', update);
  io.to(`presenter:${code}`).emit('participant_avatar_updated', update);

  return res.json({
    success: true,
    avatarId,
    canShuffleAvatar: false
  });
});

// Legacy /api/join endpoint - redirect to session-based join
app.post('/api/join', (req, res) => {
  res.status(400).json({
    success: false,
    error: 'Please use a session code to join. Go to /play.html and enter a session code.'
  });
});

// ============================================
// ADMIN SETTINGS ENDPOINTS
// ============================================

// Get admin profile/settings
app.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    const admin = await db.getAdminById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    res.json({
      success: true,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.display_name,
        email: admin.email,
        emailVerified: Boolean(admin.email_verified_at),
        accountStatus: admin.account_status || 'active',
        authSource: admin.auth_source || 'deployment',
        role: admin.role,
        hasSecurityQuestions: !!(admin.security_question_1 && admin.security_answer_1),
        securityQuestion1: admin.security_question_1 || null,
        securityQuestion2: admin.security_question_2 || null,
        createdAt: admin.created_at
      }
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Change password
app.post('/api/admin/settings/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Current and new passwords are required' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ success: false, error: 'New password must be at least 12 characters' });
  }

  try {
    const admin = await db.getAdminById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Admin not found' });
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!passwordValid) {
      await db.logActivity(admin.id, 'password_change_failed', { reason: 'wrong_current_password' }, ipAddress);
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.updateAdminPassword(admin.id, newHash);
    await db.logActivity(admin.id, 'password_changed', {}, ipAddress);

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password change error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update security questions
app.post('/api/admin/settings/security-questions', authenticateToken, async (req, res) => {
  const { question1, answer1, question2, answer2 } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (HOSTED_MODE && req.admin.role !== 'master') {
    return res.status(404).json({
      success: false,
      error: 'Hosted accounts use email-based recovery.'
    });
  }

  if (!question1 || !answer1 || !question2 || !answer2) {
    return res.status(400).json({ success: false, error: 'Both questions and answers are required' });
  }

  try {
    // Hash the answers for security
    const hashedAnswer1 = await bcrypt.hash(answer1.toLowerCase().trim(), SALT_ROUNDS);
    const hashedAnswer2 = await bcrypt.hash(answer2.toLowerCase().trim(), SALT_ROUNDS);

    await db.updateAdminSecurityQuestions(
      req.admin.id,
      question1,
      hashedAnswer1,
      question2,
      hashedAnswer2
    );

    await db.logActivity(req.admin.id, 'security_questions_updated', {}, ipAddress);

    res.json({ success: true, message: 'Security questions updated successfully' });
  } catch (err) {
    console.error('Security questions update error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Update email
app.post('/api/admin/settings/email', authenticateToken, async (req, res) => {
  const { email } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (HOSTED_MODE && req.admin.role !== 'master') {
    return res.status(409).json({
      success: false,
      error: 'Hosted email changes require verification and are not available yet.'
    });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'Enter a valid email address' });
  }

  try {
    await db.updateAdminEmail(req.admin.id, email || null);
    await db.logActivity(req.admin.id, 'email_updated', { email }, ipAddress);

    res.json({ success: true, message: 'Email updated successfully' });
  } catch (err) {
    console.error('Email update error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Password recovery - Step 1: Get security questions
app.post('/api/admin/recovery/questions', recoveryQuestionsLimiter, async (req, res) => {
  try {
    const admin = await db.getMasterAdmin();
    if (!admin || !admin.security_question_1) {
      return res.status(400).json({
        success: false,
        error: 'Password recovery not available. Security questions not set.'
      });
    }

    res.json({
      success: true,
      questions: {
        question1: admin.security_question_1,
        question2: admin.security_question_2
      }
    });
  } catch (err) {
    console.error('Recovery questions error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Password recovery - Step 2: Verify answers and reset
app.post('/api/admin/recovery/verify', recoveryVerifyLimiter, async (req, res) => {
  const { answer1, answer2, newPassword } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!answer1 || !answer2 || !newPassword) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  if (newPassword.length < 12) {
    return res.status(400).json({ success: false, error: 'New password must be at least 12 characters' });
  }

  try {
    const admin = await db.getMasterAdmin();
    if (!admin || !admin.security_answer_1) {
      return res.status(400).json({ success: false, error: 'Recovery not available' });
    }

    // Verify both answers
    const answer1Valid = await bcrypt.compare(answer1.toLowerCase().trim(), admin.security_answer_1);
    const answer2Valid = await bcrypt.compare(answer2.toLowerCase().trim(), admin.security_answer_2);

    if (!answer1Valid || !answer2Valid) {
      await db.logActivity(admin.id, 'recovery_failed', { reason: 'wrong_answers' }, ipAddress);
      return res.status(401).json({ success: false, error: 'Security answers are incorrect' });
    }

    // Reset password
    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.updateAdminPassword(admin.id, newHash);
    await db.resetLoginAttempts(admin.id);
    await db.logActivity(admin.id, 'password_recovered', {}, ipAddress);

    res.json({ success: true, message: 'Password reset successfully. You can now login.' });
  } catch (err) {
    console.error('Recovery verify error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// PARTICIPANT MANAGEMENT ENDPOINTS
// ============================================

// Kick participant from session
app.post(
  '/api/admin/session/:code/kick/:participantId',
  authorizeAdminSession,
  async (req, res) => {
  const { code, participantId } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const session = req.activeSession;
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const participant = session.participants[participantId];
  if (!participant) {
    return res.status(404).json({ success: false, error: 'Participant not found' });
  }

  try {
    await session.repository.kickParticipant(participantId);

    // Disconnect socket if connected
    if (participant.socketId) {
      const participantSocket = io.sockets.sockets.get(participant.socketId);
      if (participantSocket) {
        participantSocket.emit('kicked', { message: 'You have been removed from this session.' });
        participantSocket.leave(`session:${code}`);
        participantSocket.disconnect(true);
      }
    }

    // Remove from in-memory session
    delete session.participants[participantId];

    // Log activity
    await db.logActivity(req.admin.id, 'participant_kicked', {
      sessionCode: code,
      participantId,
      participantName: participant.name
    }, ipAddress);

    // Notify admin room
    io.to(`admin:${code}`).emit('participant_kicked', {
      participantId,
      name: participant.name,
      count: Object.keys(session.participants).length
    });
    io.to(`presenter:${code}`).emit('participant_kicked', {
      count: Object.keys(session.participants).length
    });

    res.json({ success: true, message: `${participant.name} has been removed from the session` });
  } catch (err) {
    console.error('Kick participant error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

app.post(
  '/api/trial/session/:code/kick/:participantId',
  authenticateTrial,
  requireTrialSession,
  async (req, res) => {
    const { code, participantId } = req.params;
    const session = req.activeSession;
    const participant = session.participants[participantId];

    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

    await session.repository.kickParticipant(participantId);
    if (participant.socketId) {
      const participantSocket = io.sockets.sockets.get(participant.socketId);
      if (participantSocket) {
        participantSocket.emit('kicked', {
          message: 'You have been removed from this practice room.'
        });
        participantSocket.disconnect(true);
      }
    }

    delete session.participants[participantId];
    io.to(`admin:${code}`).emit('participant_kicked', {
      participantId,
      name: participant.name,
      count: Object.keys(session.participants).length
    });
    io.to(`presenter:${code}`).emit('participant_kicked', {
      count: Object.keys(session.participants).length
    });

    return res.json({
      success: true,
      message: `${participant.name} has been removed from the practice room`
    });
  }
);

// Get activity log
app.get('/api/admin/activity-log', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.getActivityLog(req.admin.id, limit);

    res.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        details: log.details,
        createdAt: log.created_at
      }))
    });
  } catch (err) {
    console.error('Activity log error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ============================================
// SESSION RECOVERY ENDPOINT
// ============================================

// Recover an interrupted session by recomputing scores from raw DB answers.
// Called when the server crashed mid-quiz and the in-memory session was lost.
// The session must exist in the DB with status 'active' or 'created'.
app.post('/api/admin/session/:code/recover', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  try {
    // Look up session in DB (may not be in activeSessions since server crashed)
    const dbSession = req.storedSession || await db.getSession(code);
    if (!dbSession) {
      return res.status(404).json({ success: false, error: 'Session not found in database' });
    }

    if (dbSession.status === 'ended') {
      return res.status(400).json({ success: false, error: 'Session already ended — view it in Analytics normally' });
    }

    const quizData = dbSession.quiz_data;
    if (!quizData || !quizData.questions) {
      return res.status(400).json({ success: false, error: 'Session has no quiz data to recover' });
    }

    // Fetch all participants and their answers from DB
    const participants = await db.getParticipantsBySession(dbSession.id);
    const answers = await db.getAnswersBySession(dbSession.id);

    const normalized = normalizeStoredQuiz(quizData);
    const pointsPer = pointsPerQuestion(normalized);

    // Recompute scores per participant from their DB answer rows
    for (const participant of participants) {
      const participantAnswers = answers.filter(a => a.participant_id === participant.id);
      let correctCount = 0;

      for (const answer of participantAnswers) {
        const question = normalized.questions[answer.question_index];
        if (!question || !isScored(question)) continue;
        if (question.correctIndices.includes(answer.answer_index)) {
          correctCount++;
        }
      }

      const finalScore = Math.round(correctCount * pointsPer);
      await db.updateParticipantScore(participant.id, finalScore, correctCount);
    }

    // Mark session as ended in DB
    await db.updateSessionStatus(code, 'ended');
    await db.logActivity(req.admin.id, 'session_recovered', { sessionCode: code }, req.ip);

    console.log(`[RECOVERY] Session ${code} recovered: ${participants.length} participants, ${answers.length} answers`);

    res.json({
      success: true,
      message: `Session ${code} recovered successfully`,
      participantsRecovered: participants.length,
      answersFound: answers.length
    });
  } catch (err) {
    console.error('Session recovery error:', err);
    res.status(500).json({ success: false, error: 'Recovery failed: ' + err.message });
  }
});

// ============================================
// ANALYTICS API ENDPOINTS
// ============================================

// Helper function for difficulty rating
function getDifficultyRating(correctPercent) {
  if (correctPercent >= 70) return 'easy';
  if (correctPercent >= 40) return 'medium';
  return 'hard';
}

// Platform overview statistics
app.get('/api/admin/analytics/overview', async (req, res) => {
  const ownerId = ownerFilterFor(req.admin);
  const stats = await db.getPlatformStats(ownerId);
  const courseStats = await db.getCourseStats(ownerId);
  res.json({
    success: true,
    stats: {
      totalSessions: stats.total_sessions || 0,
      completedSessions: stats.completed_sessions || 0,
      totalParticipants: stats.total_participants || 0,
      overallAvgScore: stats.overall_avg_score || 0,
      totalCourses: stats.total_courses || 0,
      courseBreakdown: courseStats
    }
  });
});

// List completed sessions with analytics
app.get('/api/admin/analytics/sessions', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const filter = req.query.filter || null; // 'ended', 'incomplete', or null
  const sessions = await db.getSessionAnalytics(
    limit,
    filter,
    ownerFilterFor(req.admin)
  );
  res.json({
    success: true,
    sessions: sessions.map(s => ({
      id: s.id,
      code: s.code,
      quizTitle: s.quiz_title,
      status: s.status,
      createdAt: s.created_at,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      totalQuestions: s.total_questions,
      participantCount: s.participant_count || 0,
      avgScorePercent: s.avg_score_percent || 0,
      courseName: s.course_name,
      isTest: s.is_test
    }))
  });
});

// Detailed session analytics
app.get('/api/admin/analytics/session/:code', authorizeAdminSession, async (req, res) => {
  const { code } = req.params;
  const session = req.storedSession || await db.getSession(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const questionAnalytics = await db.getQuestionAnalytics(session.id);
  const participantPerformance = await db.getParticipantPerformance(session.id);
  const answerDistribution = await db.getAnswerDistribution(session.id);
  const participantAnswers = await db.getParticipantAnswers(session.id);

  // Compute streaks per participant
  const streakMap = {};
  let currentPid = null;
  let currentStreak = 0;
  let bestStreak = 0;
  for (const row of participantAnswers) {
    if (row.participant_id !== currentPid) {
      if (currentPid) streakMap[currentPid] = bestStreak;
      currentPid = row.participant_id;
      currentStreak = 0;
      bestStreak = 0;
    }
    if (row.is_correct) {
      currentStreak++;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  if (currentPid) streakMap[currentPid] = bestStreak;

  // Build question details with quiz data
  const questions = questionAnalytics.map(q => {
    const quizQuestion = session.quiz_data.questions[q.question_index];
    const distribution = answerDistribution.filter(a => a.question_index === q.question_index);

    return {
      index: q.question_index,
      text: quizQuestion ? quizQuestion.text : `Question ${q.question_index + 1}`,
      options: quizQuestion ? quizQuestion.options : [],
      correctIndices: quizQuestion ? quizQuestion.correctIndices : [],
      totalAnswers: q.total_answers,
      correctCount: q.correct_count,
      correctPercent: q.correct_percent || 0,
      avgResponseTimeMs: q.avg_response_time_ms,
      minResponseTimeMs: q.min_response_time_ms,
      maxResponseTimeMs: q.max_response_time_ms,
      difficulty: getDifficultyRating(q.correct_percent || 0),
      optionDistribution: distribution.map(d => ({
        optionIndex: d.answer_index,
        count: d.count
      }))
    };
  });

  // Sort questions by difficulty (hardest first)
  const questionsByDifficulty = [...questions].sort((a, b) => a.correctPercent - b.correctPercent);

  res.json({
    success: true,
    session: {
      code: session.code,
      quizTitle: session.quiz_title,
      status: session.status,
      totalQuestions: session.total_questions,
      totalScore: session.total_score,
      passingPercent: session.passing_percent ?? session.quiz_data?.passingPercent ?? 70,
      createdAt: session.created_at,
      startedAt: session.started_at,
      endedAt: session.ended_at
    },
    questions,
    questionsByDifficulty,
    participants: participantPerformance.map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      correctCount: p.correct_count,
      avgResponseTimeMs: p.avg_response_time_ms,
      questionsAnswered: p.questions_answered,
      totalQuestions: session.total_questions,
      bestStreak: streakMap[p.id] || 0
    }))
  });
});

// Question difficulty breakdown
app.get(
  '/api/admin/analytics/session/:code/questions',
  authorizeAdminSession,
  async (req, res) => {
  const { code } = req.params;
  const session = req.storedSession || await db.getSession(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const questionAnalytics = await db.getQuestionAnalytics(session.id);
  const answerDistribution = await db.getAnswerDistribution(session.id);

  const questions = questionAnalytics.map(q => {
    const quizQuestion = session.quiz_data.questions[q.question_index];
    const distribution = answerDistribution.filter(a => a.question_index === q.question_index);

    return {
      index: q.question_index,
      text: quizQuestion ? quizQuestion.text : `Question ${q.question_index + 1}`,
      options: quizQuestion ? quizQuestion.options : [],
      correctIndices: quizQuestion ? quizQuestion.correctIndices : [],
      totalAnswers: q.total_answers,
      correctCount: q.correct_count,
      correctPercent: q.correct_percent || 0,
      avgResponseTimeMs: q.avg_response_time_ms,
      difficulty: getDifficultyRating(q.correct_percent || 0),
      optionBreakdown: (quizQuestion ? quizQuestion.options : []).map((opt, idx) => {
        const dist = distribution.find(d => d.answer_index === idx);
        const count = dist ? dist.count : 0;
        return {
          option: opt,
          count,
          percent: q.total_answers > 0 ? Math.round(count * 100 / q.total_answers) : 0,
          isCorrect: quizQuestion ? quizQuestion.correctIndices.includes(idx) : false
        };
      })
    };
  });

  res.json({ success: true, questions });
});

// Export session data as CSV
app.get(
  '/api/admin/analytics/session/:code/export',
  authorizeAdminSession,
  async (req, res) => {
  const { code } = req.params;
  const session = req.storedSession || await db.getSession(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const answers = await db.getAnswersForExport(session.id);
  const quizData = session.quiz_data;

  // Build CSV content
  const csvRows = [];

  // Header row
  csvRows.push([
    'Participant Name',
    'Question Number',
    'Question Text',
    'Selected Answer',
    'Correct Answer(s)',
    'Is Correct',
    'Response Time (ms)',
    'Answered At'
  ].join(','));

  // Data rows
  for (const answer of answers) {
    const question = quizData.questions[answer.question_index];
    if (!question) continue;

    const selectedOption = answer.answer_index !== null && question.options[answer.answer_index]
      ? question.options[answer.answer_index]
      : 'No answer';
    const correctOptions = question.correctIndices
      .map(i => question.options[i])
      .filter(Boolean)
      .join('; ');

    csvRows.push([
      escapeCSV(answer.participant_name),
      answer.question_index + 1,
      escapeCSV(question.text),
      escapeCSV(selectedOption),
      escapeCSV(correctOptions),
      answer.is_correct ? 'Yes' : 'No',
      answer.response_time_ms || '',
      answer.answered_at || ''
    ].join(','));
  }

  const csvContent = csvRows.join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${code}-results.csv"`);
  res.send(csvContent);
});

// ============================================
// SOCKET.IO EVENTS
// ============================================
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  socket.data.principal = { type: 'anonymous' };

  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload?.type === 'presenter'
      && payload.sessionCode
      && payload.sessionId) {
      socket.data.principal = {
        type: 'presenter',
        sessionCode: payload.sessionCode,
        sessionId: payload.sessionId
      };
      return next();
    }
    if (payload?.id && payload.type !== 'trial') {
      const account = await db.getAdminById(payload.id);
      const failure = getAccountAuthenticationFailure(account, { hostedMode: HOSTED_MODE });
      if (failure) return next(new Error('Authentication expired'));
      const principal = adminPrincipal(account);
      const billingFailure = await hostedBillingFailureForAdmin(principal);
      if (billingFailure) return next(new Error('A hosted subscription is required'));
      socket.data.principal = principal;
      return next();
    }
  } catch (error) {
    // It may be a trial token signed with the separate trial key.
  }

  try {
    socket.data.principal = trialManager.authenticate(token);
    return next();
  } catch (error) {
    return next(new Error('Authentication expired'));
  }
});

function socketCanControl(socket, sessionCode) {
  const session = activeSessions.get(sessionCode);
  return Boolean(session && canControlSession(socket.data.principal, session));
}

function rejectSocketControl(socket) {
  socket.emit('control_error', {
    message: 'You do not have permission to control this session.'
  });
}

function sendLiveSessionSnapshot(socket, session, sessionCode, audience = 'admin') {
  socket.emit('sidekicks_setting_changed', {
    enabled: session.sidekicksEnabled !== false
  });

  socket.emit('autopilot_changed', {
    enabled: session.quizState.autopilot === true,
    pauseSeconds: session.quizState.autopilotPauseSeconds
  });

  socket.emit('participant_joined', {
    count: Object.keys(session.participants).length
  });

  socket.emit('quiz_loaded', {
    title: session.quiz.title,
    questionCount: session.quiz.questions.length,
    sessionCode
  });

  if (session.finale) {
    socket.emit('quiz_ended', session.finale);
    return;
  }

  if (session.quizState.currentStepIndex < 0
    || session.quizState.currentStepIndex >= session.quiz.questions.length) {
    return;
  }

  const question = session.quiz.questions[session.quizState.currentStepIndex];
  const timeRemaining = Math.max(
    0,
    Math.ceil((session.quizState.questionEndTime - Date.now()) / 1000)
  );

  if (session.quizState.showingResults && session.lastQuestionPresentation) {
    socket.emit('question_ended', {
      questionId: question.id,
      question,
      questionNumber: session.quizState.currentStepIndex + 1,
      correctIndices: question.correctIndices,
      stats: calculateStats(session, question.id),
      presentation: session.lastQuestionPresentation,
      autopilotNextInMs: pendingAutopilotMs(session)
    });
  } else if (session.quizState.isRunning) {
    socket.emit('question_started', {
      question: audience === 'presenter'
        ? getQuestionForParticipants(question)
        : question,
      timeRemaining,
      questionNumber: session.quizState.currentStepIndex + 1,
      totalQuestions: session.quiz.questions.length
    });
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin joins a session's admin room
  socket.on('admin_join', (sessionCode) => {
    if (sessionCode && socketCanControl(socket, sessionCode)) {
      socket.join(`admin:${sessionCode}`);
      socket.sessionCode = sessionCode;
      socket.isAdmin = true;
      console.log('Admin joined session:', sessionCode);
      const session = activeSessions.get(sessionCode);
      socket.emit('participant_roster', {
        participants: Object.values(session.participants).map(participant => ({
          id: participant.id,
          name: participant.name,
          avatarId: participant.avatarId
        })),
        count: Object.keys(session.participants).length
      });
      sendLiveSessionSnapshot(socket, session, sessionCode);
    } else {
      rejectSocketControl(socket);
    }
  });

  socket.on('set_sidekicks_enabled', ({ sessionCode, enabled } = {}) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }

    session.sidekicksEnabled = enabled !== false;
    const update = { enabled: session.sidekicksEnabled };
    io.to(`session:${sessionCode}`).emit('sidekicks_setting_changed', update);
    io.to(`admin:${sessionCode}`).emit('sidekicks_setting_changed', update);
    io.to(`presenter:${sessionCode}`).emit('sidekicks_setting_changed', update);
  });

  socket.on('set_autopilot', ({ sessionCode, enabled, pauseSeconds } = {}) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }

    session.quizState.autopilot = enabled === true;
    session.quizState.autopilotPauseSeconds = autopilot.normalizePauseSeconds(pauseSeconds);

    if (!session.quizState.autopilot) {
      clearAutopilotTimer(session);
    } else {
      // Pass the live question's id (when one is in progress) so the close
      // branch stays reachable — without it, re-scheduling here would drop a
      // pending "everyone answered" close and stall the room until the
      // question's full time limit expires. questionForStep returns null for
      // a section step, an out-of-range index, or a not-yet-started question.
      const liveQuestion = session.quiz
        ? questionForStep(session.quiz, session.quizState.currentStepIndex)
        : null;
      scheduleAutopilot(sessionCode, liveQuestion ? liveQuestion.id : undefined);
    }

    const update = {
      enabled: session.quizState.autopilot,
      pauseSeconds: session.quizState.autopilotPauseSeconds
    };
    io.to(`admin:${sessionCode}`).emit('autopilot_changed', update);
    io.to(`presenter:${sessionCode}`).emit('autopilot_changed', update);
  });

  // Presenter joins a read-only display room with a session-bound capability.
  socket.on('presenter_join', (sessionCode) => {
    if (!sessionCode) return;

    const session = activeSessions.get(sessionCode);
    if (!session) {
      socket.emit('session_invalid', { message: 'Session not found' });
      return;
    }

    if (!presenterCanView(socket.data.principal, session)) {
      socket.emit('presenter_unauthorized', {
        message: 'Open the presenter from the host studio for this room.'
      });
      return;
    }

    socket.join(`presenter:${sessionCode}`);
    socket.sessionCode = sessionCode;
    console.log('Presenter joined session:', sessionCode);

    // Restore the current presenter view after a browser refresh or reconnect.
    sendLiveSessionSnapshot(socket, session, sessionCode, 'presenter');
  });

  // Participant joins with their ID and session code
  socket.on('participant_join', async (data) => {
    const { participantId, sessionCode } = data;

    const session = activeSessions.get(sessionCode);
    if (!session) {
      socket.emit('session_invalid', { message: 'Session no longer exists' });
      socket.emit('clear_participant_id');
      return;
    }

    const participant = session.participants[participantId];
    if (!participant) {
      socket.emit('session_invalid', { message: 'Please rejoin the session' });
      socket.emit('clear_participant_id');
      return;
    }

    const participantAccess = socket.handshake.auth || {};
    if (participantAccess.participantId !== participantId
      || participantAccess.sessionCode !== sessionCode
      || !verifyOpaqueToken(
        participantAccess.participantToken,
        participant.accessTokenDigest
      )) {
      socket.emit('session_invalid', {
        message: 'Participant access expired. Please rejoin.'
      });
      socket.emit('clear_participant_id');
      return;
    }

    // Check kick status only after the participant capability has been verified.
    const wasKicked = await session.repository.isParticipantKicked(participantId);
    if (wasKicked) {
      socket.emit('kicked', { message: 'You have been removed from this session.' });
      socket.emit('clear_participant_id');
      return;
    }

    socket.join(`session:${sessionCode}`);
    socket.participantId = participantId;
    socket.sessionCode = sessionCode;
    participant.socketId = socket.id;

    // Update socket ID in database
    await session.repository.updateParticipantSocket(participantId, socket.id);
    socket.emit('participant_ready', {
      participantId,
      sessionCode,
      avatarId: participant.avatarId,
      canShuffleAvatar: getShuffleAvailability(session, participant).allowed
    });
    socket.emit('sidekicks_setting_changed', {
      enabled: session.sidekicksEnabled !== false
    });

    console.log(
      'Participant joined session:',
      sessionCode,
      'count:',
      Object.keys(session.participants).length
    );

    // Restore the participant's personal finale after a refresh.
    if (session.finale) {
      const standing = session.finale.leaderboard
        ?.find(entry => entry.id === participant.id);
      const percentage = session.quiz.questions.length > 0
        ? Math.round(((participant.correctCount || 0) / session.quiz.questions.length) * 100)
        : 0;
      socket.emit('quiz_ended', {
        finalScore: standing?.score || 0,
        totalScore: session.quiz.totalScore,
        correctCount: participant.correctCount || 0,
        totalQuestions: session.quiz.questions.length,
        percentage,
        passed: percentage >= session.quiz.passingPercent,
        passingPercent: session.quiz.passingPercent,
        rank: standing?.rank || null,
        participantCount: session.finale.leaderboard?.length || 0,
        bestStreak: participant.bestStreak || 0
      });
      return;
    }

    // If quiz is in progress, send current state
    if (session.quizState.isRunning && session.quizState.currentStepIndex >= 0) {
      const question = session.quiz.questions[session.quizState.currentStepIndex];
      const timeRemaining = Math.max(0, Math.ceil((session.quizState.questionEndTime - Date.now()) / 1000));

      if (session.quizState.showingResults) {
        const pointsPerQuestion = session.quiz.totalScore / session.quiz.questions.length;
        const standing = session.lastQuestionPresentation?.leaderboard
          ?.find(entry => entry.id === participant.id);
        socket.emit('question_ended', {
          questionId: question.id,
          question: getQuestionForParticipants(question),
          correctIndices: question.correctIndices,
          stats: calculateStats(session, question.id),
          participantResults: {
            [participant.id]: {
              yourAnswer: participant.answers[question.id],
              currentScore: Math.round((participant.correctCount || 0) * pointsPerQuestion),
              correctCount: participant.correctCount || 0,
              currentStreak: participant.currentStreak || 0,
              bestStreak: participant.bestStreak || 0,
              rank: standing?.rank || null,
              previousRank: standing?.previousRank || null,
              movement: standing?.movement || 0
            }
          },
          totalScore: session.quiz.totalScore,
          questionsAnswered: session.quizState.currentStepIndex + 1,
          totalQuestions: session.quiz.questions.length,
          autopilotNextInMs: pendingAutopilotMs(session)
        });
      } else if (timeRemaining > 0) {
        socket.emit('question_started', {
          question: getQuestionForParticipants(question),
          timeRemaining,
          questionNumber: session.quizState.currentStepIndex + 1,
          totalQuestions: session.quiz.questions.length
        });
      }
    }
  });

  // Admin starts quiz
  socket.on('start_quiz', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || session.quiz.questions.length === 0) return;
    if (!socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }

    clearAutopilotTimer(session);

    session.quizState.isRunning = true;
    session.quizState.currentStepIndex = -1;
    session.quizState.showingResults = false;
    session.rankSnapshot = {};
    session.lastQuestionPresentation = null;
    session.finale = null;

    // Update database status
    await session.repository.updateStatus('active');

    // Reset all participant answers and scores
    for (const p of Object.values(session.participants)) {
      p.answers = {};
      p.score = 0;
      p.correctCount = 0;
      p.currentStreak = 0;
      p.bestStreak = 0;
      p.responseTimes = {};
    }

    io.to(`session:${sessionCode}`).emit('quiz_started', {
      title: session.quiz.title,
      totalQuestions: session.quiz.questions.length
    });

    io.to(`admin:${sessionCode}`).emit('quiz_started', {
      title: session.quiz.title,
      totalQuestions: session.quiz.questions.length
    });
    io.to(`presenter:${sessionCode}`).emit('quiz_started', {
      title: session.quiz.title,
      totalQuestions: session.quiz.questions.length
    });

    scheduleAutopilot(sessionCode);
  });

  // Admin advances to next question
  socket.on('next_question', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || !session.quizState.isRunning) return;
    if (!socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }

    clearAutopilotTimer(session);
    await advanceToNextStep(sessionCode);
  });

  // Admin manually ends current question
  socket.on('end_question', (sessionCode) => {
    if (!socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }
    const session = activeSessions.get(sessionCode);
    clearAutopilotTimer(session);
    endCurrentQuestion(sessionCode);
  });

  // Participant submits answer (session-aware fix for the bug)
  socket.on('submit_answer', async (data) => {
    const { participantId, sessionCode, questionId, answerIndex } = data;

    const session = activeSessions.get(sessionCode);
    if (!session) {
      socket.emit('session_invalid', { message: 'Session no longer exists' });
      socket.emit('clear_participant_id');
      return;
    }

    const participant = session.participants[participantId];
    if (!participant) {
      socket.emit('session_invalid', { message: 'Please rejoin the session' });
      socket.emit('clear_participant_id');
      return;
    }

    if (socket.participantId !== participantId || socket.sessionCode !== sessionCode) {
      return socket.emit('session_invalid', { message: 'Participant session mismatch' });
    }

    if (!session.quizState.isRunning) return;
    if (session.quizState.showingResults) return;

    const question = session.quiz.questions.find(q => q.id === questionId);
    if (!question) return;
    if (!Number.isInteger(answerIndex)
      || answerIndex < 0
      || answerIndex >= question.options.length) {
      socket.emit('answer_rejected', {
        questionId,
        message: 'Invalid answer selection'
      });
      return;
    }

    // Check if already answered
    if (participant.answers[questionId] !== undefined) return;

    // Check if time expired
    if (Date.now() > session.quizState.questionEndTime) return;

    participant.answers[questionId] = answerIndex;

    // Calculate response time
    const responseTimeMs = session.questionStartTime ? Date.now() - session.questionStartTime : null;
    participant.responseTimes = participant.responseTimes || {};
    participant.responseTimes[questionId] = responseTimeMs;

    // Record answer in database
    const isCorrect = question.correctIndices.includes(answerIndex);
    await session.repository.recordAnswer(
      participantId,
      question.index,
      answerIndex,
      isCorrect,
      responseTimeMs
    );

    // Notify admin of answer received
    io.to(`admin:${sessionCode}`).emit('answer_received', {
      participantId,
      participantName: participant.name,
      questionId,
      answeredCount: Object.values(session.participants).filter(p => p.answers[questionId] !== undefined).length,
      totalParticipants: Object.keys(session.participants).length
    });
    io.to(`presenter:${sessionCode}`).emit('answer_received', {
      questionId,
      answeredCount: Object.values(session.participants)
        .filter(p => p.answers[questionId] !== undefined).length,
      totalParticipants: Object.keys(session.participants).length
    });

    // Confirm to participant
    socket.emit('answer_confirmed', { questionId, answerIndex });

    // Guarded per-question: two participants can both resolve their DB await
    // after everyoneAnswered() has gone true (their in-memory answers land
    // synchronously before either await), so without this guard both would
    // emit 'all_answered' and both would call scheduleAutopilot — the second
    // call would restart the 2s beat late by the inter-arrival gap between
    // the two submissions. scheduleAutopilot stays inside the guard so only
    // the call that "wins" the race schedules the close.
    if (autopilot.shouldCloseEarly(session, questionId)
      && session.quizState.allAnsweredEmittedFor !== questionId) {
      session.quizState.allAnsweredEmittedFor = questionId;
      const closingInMs = autopilot.ALL_ANSWERED_BEAT_MS;
      io.to(`session:${sessionCode}`).emit('all_answered', { questionId, closingInMs });
      io.to(`admin:${sessionCode}`).emit('all_answered', { questionId, closingInMs });
      io.to(`presenter:${sessionCode}`).emit('all_answered', { questionId, closingInMs });
      scheduleAutopilot(sessionCode, questionId);
    }
  });

  // Admin ends session
  socket.on('end_session', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session) return;
    if (!socketCanControl(socket, sessionCode)) {
      return rejectSocketControl(socket);
    }

    // Update database status
    await session.repository.updateStatus('ended');

    // Save final participant scores
    for (const participant of Object.values(session.participants)) {
      await session.repository.updateParticipantScore(
        participant.id,
        participant.score || 0,
        participant.correctCount || 0
      );
    }

    // Notify all clients
    io.to(`session:${sessionCode}`).emit('session_ended', {
      message: 'This session has ended. Thank you for participating!'
    });

    io.to(`admin:${sessionCode}`).emit('session_ended', {
      code: sessionCode,
      message: 'Session ended successfully'
    });
    io.to(`presenter:${sessionCode}`).emit('session_ended', {
      message: 'This session has ended.'
    });

    // Remove from active sessions
    clearAutopilotTimer(session);
    activeSessions.delete(sessionCode);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function clearAutopilotTimer(session) {
  if (!session) return;
  if (session.autopilotTimer) {
    clearTimeout(session.autopilotTimer);
    session.autopilotTimer = null;
  }
  if (session.quizState) {
    session.quizState.autopilotResumeAt = null;
  }
}

// Remaining pause before the next auto-advance, or null when none is pending.
function pendingAutopilotMs(session) {
  const resumeAt = session?.quizState?.autopilotResumeAt;
  if (!resumeAt) return null;
  return Math.max(0, resumeAt - Date.now());
}

// Schedules at most one pending autopilot action per session.
function scheduleAutopilot(sessionCode, questionId) {
  const session = activeSessions.get(sessionCode);
  if (!session) return;

  clearAutopilotTimer(session);

  const step = stepAt(session.quiz, session.quizState.currentStepIndex);
  const onSection = Boolean(step && step.kind === 'section');
  const next = autopilot.nextAutopilotStep(session, questionId, { onSection });
  if (!next) return;

  // Captured so a timer that survives a state change cannot fire into the
  // wrong question — the same guard the time-expiry timer uses.
  const expectedIndex = session.quizState.currentStepIndex;

  session.quizState.autopilotResumeAt = Date.now() + next.delayMs;
  session.autopilotTimer = setTimeout(() => {
    const live = activeSessions.get(sessionCode);
    if (!live) return;
    if (live.quizState.currentStepIndex !== expectedIndex) return;

    live.autopilotTimer = null;
    live.quizState.autopilotResumeAt = null;

    if (next.action === 'close') {
      if (live.quizState.showingResults) return;
      endCurrentQuestion(sessionCode);
      return;
    }

    // Defensive, not incidental: don't rely on "every transition out of
    // showingResults also mutates the index" holding forever — re-check
    // the quiz is still running before advancing.
    if (!live.quizState.isRunning) return;

    advanceToNextStep(sessionCode).catch(err => {
      console.error('[AUTOPILOT] advance failed:', err);
    });
  }, next.delayMs);
}

// Advances the room to the next step — question or section — or ends the
// quiz when the last step is finished. No permission check: callers must
// authorize first.
async function advanceToNextStep(sessionCode) {
  const session = activeSessions.get(sessionCode);
  if (!session || !session.quiz || !session.quizState.isRunning) return;

  session.quizState.currentStepIndex++;
  session.quizState.showingResults = false;
  session.quizState.allAnsweredEmittedFor = null;

  if (session.quizState.currentStepIndex >= session.quiz.steps.length) {
    await finishQuiz(sessionCode, session);
    return;
  }

  const step = stepAt(session.quiz, session.quizState.currentStepIndex);

  if (step.kind === 'section') {
    startSectionStep(sessionCode, session, step);
    return;
  }

  startQuestionStep(sessionCode, session);
}

async function finishQuiz(sessionCode, session) {
  // Quiz ended
  session.quizState.isRunning = false;
  const pointsPer = pointsPerQuestion(session.quiz);
  const totalGraded = gradedCount(session.quiz);

  // Update database status
  await session.repository.updateStatus('ended');

  // Save final scores to database and send results to each participant
  console.log(`[FINAL SCORES] Points per question: ${pointsPer}`);
  const finalLeaderboard = rankParticipants(session);
  for (const participant of Object.values(session.participants)) {
    const finalScore = Math.round((participant.correctCount || 0) * pointsPer);
    const percentage = totalGraded === 0
      ? 0
      : Math.round(((participant.correctCount || 0) / totalGraded) * 100);
    const passed = totalGraded > 0 && percentage >= session.quiz.passingPercent;
    const standing = finalLeaderboard.find(entry => entry.id === participant.id);
    participant.score = finalScore;

    // Update database
    await session.repository.updateParticipantScore(
      participant.id,
      finalScore,
      participant.correctCount || 0
    );

    if (participant.socketId) {
      io.to(participant.socketId).emit('quiz_ended', {
        finalScore,
        totalScore: session.quiz.totalScore,
        correctCount: participant.correctCount || 0,
        totalQuestions: totalGraded,
        hasScore: totalGraded > 0,
        funCorrectCount: participant.funCorrectCount || 0,
        funTotal: participant.funTotal || 0,
        percentage,
        passed,
        passingPercent: session.quiz.passingPercent,
        rank: standing?.rank || null,
        participantCount: finalLeaderboard.length,
        bestStreak: participant.bestStreak || 0
      });
    }
  }

  session.finale = buildFinaleSummary(session);
  clearAutopilotTimer(session);
  io.to(`admin:${sessionCode}`).emit('quiz_ended', session.finale);
  io.to(`presenter:${sessionCode}`).emit('quiz_ended', session.finale);
}

function startSectionStep(sessionCode, session, step) {
  session.quizState.questionEndTime = null;
  scheduleAutopilot(sessionCode);
  const payload = {
    title: step.title,
    subtitle: step.subtitle,
    stepNumber: sectionOrdinal(session.quiz, session.quizState.currentStepIndex),
    totalSections: session.quiz.steps.filter(s => s.kind === 'section').length,
    autopilotNextInMs: pendingAutopilotMs(session)
  };

  io.to(`session:${sessionCode}`).emit('section_started', payload);
  io.to(`admin:${sessionCode}`).emit('section_started', payload);
  io.to(`presenter:${sessionCode}`).emit('section_started', payload);
}

// "Section 2 of 4" — counts section steps up to and including this one.
function sectionOrdinal(quiz, stepIndex) {
  let ordinal = 0;
  for (let i = 0; i <= stepIndex; i++) {
    if (quiz.steps[i].kind === 'section') ordinal++;
  }
  return ordinal;
}

function startQuestionStep(sessionCode, session) {
  const question = currentQuestionOf(session);
  session.quizState.questionEndTime = Date.now() + (question.timeLimit * 1000);
  session.questionStartTime = Date.now();

  const totalGraded = gradedCount(session.quiz);

  io.to(`session:${sessionCode}`).emit('question_started', {
    question: getQuestionForParticipants(question),
    timeRemaining: question.timeLimit,
    questionNumber: question.gradedNumber,
    totalQuestions: totalGraded
  });

  io.to(`admin:${sessionCode}`).emit('question_started', {
    question,
    timeRemaining: question.timeLimit,
    questionNumber: question.gradedNumber,
    totalQuestions: totalGraded,
    stepNumber: session.quizState.currentStepIndex + 1,
    totalSteps: session.quiz.steps.length
  });

  io.to(`presenter:${sessionCode}`).emit('question_started', {
    question: getQuestionForParticipants(question),
    timeRemaining: question.timeLimit,
    questionNumber: question.gradedNumber,
    totalQuestions: totalGraded
  });

  // Auto-end question when time expires
  const stepIndex = session.quizState.currentStepIndex;
  setTimeout(() => {
    if (session.quizState.currentStepIndex === stepIndex && !session.quizState.showingResults) {
      endCurrentQuestion(sessionCode);
    }
  }, question.timeLimit * 1000);
}

function endCurrentQuestion(sessionCode) {
  const session = activeSessions.get(sessionCode);
  if (!session || !session.quiz || session.quizState.currentStepIndex < 0) return;
  if (session.quizState.showingResults) return;
  const question = currentQuestionOf(session);
  if (!question) return; // a section step has no results to end

  session.quizState.showingResults = true;
  scheduleAutopilot(sessionCode);
  const nextInMs = pendingAutopilotMs(session);
  const stats = calculateStats(session, question.id);
  const pointsPer = pointsPerQuestion(session.quiz);

  // Update scores
  console.log(`[SCORING] Question ${question.id} ended. Correct indices: [${question.correctIndices}]`);
  const scored = isScored(question);

  for (const participant of Object.values(session.participants)) {
    const answer = participant.answers[question.id];
    const wasCorrect = answer !== undefined && question.correctIndices.includes(answer);

    if (!scored) {
      // Ungraded: record the result, leave score, streak, and rank alone.
      participant.funTotal = (participant.funTotal || 0) + 1;
      if (wasCorrect) participant.funCorrectCount = (participant.funCorrectCount || 0) + 1;
      continue;
    }

    if (wasCorrect) {
      participant.correctCount = (participant.correctCount || 0) + 1;
      participant.currentStreak = (participant.currentStreak || 0) + 1;
      participant.bestStreak = Math.max(participant.bestStreak || 0, participant.currentStreak);
    } else {
      participant.currentStreak = 0;
    }
  }

  const presentation = buildQuestionPresentation(session, question);
  session.rankSnapshot = presentation.rankSnapshot;
  session.lastQuestionPresentation = {
    correctParticipants: presentation.correctParticipants,
    leaderboard: presentation.leaderboard,
    highlights: presentation.highlights
  };

  // Send each participant only their own private result record.
  for (const participant of Object.values(session.participants)) {
    const currentScore = Math.round((participant.correctCount || 0) * pointsPer);
    const standing = presentation.leaderboard.find(entry => entry.id === participant.id);
    const participantResult = {
      yourAnswer: participant.answers[question.id],
      currentScore,
      correctCount: participant.correctCount || 0,
      currentStreak: participant.currentStreak || 0,
      bestStreak: participant.bestStreak || 0,
      rank: standing?.rank || null,
      previousRank: standing?.previousRank || null,
      movement: standing?.movement || 0
    };

    if (participant.socketId) {
      io.to(participant.socketId).emit('question_ended', {
        questionId: question.id,
        correctIndices: question.correctIndices,
        stats,
        participantResults: {
          [participant.id]: participantResult
        },
        totalScore: session.quiz.totalScore,
        scored,
        funCorrectCount: participant.funCorrectCount || 0,
        funTotal: participant.funTotal || 0,
        questionsAnswered: question.gradedNumber,
        totalQuestions: gradedCount(session.quiz),
        autopilotNextInMs: nextInMs
      });
    }
  }

  // Send to admin
  io.to(`admin:${sessionCode}`).emit('question_ended', {
    questionId: question.id,
    question,
    questionNumber: session.quizState.currentStepIndex + 1,
    correctIndices: question.correctIndices,
    stats,
    presentation: session.lastQuestionPresentation,
    autopilotNextInMs: nextInMs
  });
  io.to(`presenter:${sessionCode}`).emit('question_ended', {
    questionId: question.id,
    question,
    questionNumber: session.quizState.currentStepIndex + 1,
    correctIndices: question.correctIndices,
    stats,
    presentation: session.lastQuestionPresentation,
    autopilotNextInMs: nextInMs
  });
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Markdown Mash server running on http://localhost:${PORT}`);
});
