const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// CONFIGURATION
// ============================================
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'markdown-mash-secret-key-change-in-production';
const JWT_EXPIRY = '24h';
const SALT_ROUNDS = 10;

// ============================================
// JWT AUTHENTICATION MIDDLEWARE
// ============================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  jwt.verify(token, JWT_SECRET, (err, admin) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid or expired token' });
    }
    req.admin = admin;
    next();
  });
}

// Optional auth - doesn't fail, just attaches admin if valid token
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, admin) => {
      if (!err) {
        req.admin = admin;
      }
    });
  }
  next();
}

// ============================================
// SESSION-KEYED STATE (replaces global store)
// ============================================
// In-memory active sessions: sessionCode -> sessionState
const activeSessions = new Map();

// Session state structure:
// {
//   id: number (database id),
//   code: string,
//   quiz: object,
//   participants: { participantId: { id, name, score, correctCount, answers: {}, socketId } },
//   quizState: { isRunning, currentQuestionIndex, questionEndTime, showingResults },
//   questionStartTime: number (for response time tracking)
// }

// ============================================
// MARKDOWN QUIZ PARSER
// ============================================
function parseQuizMarkdown(markdown) {
  const lines = markdown.split('\n');
  const quiz = { title: '', questions: [], totalScore: 100, passingPercent: 70 };
  let currentQuestion = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Score setting (# Score 100)
    const scoreMatch = trimmed.match(/^#\s*Score\s+(\d+)$/i);
    if (scoreMatch) {
      quiz.totalScore = parseInt(scoreMatch[1], 10);
      continue;
    }

    // Quiz title (# Title) - but not # Score
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ') && !trimmed.toLowerCase().startsWith('# score')) {
      quiz.title = trimmed.slice(2).trim();
      continue;
    }

    // Question (## Q1: Question text)
    if (trimmed.startsWith('## ')) {
      if (currentQuestion) {
        quiz.questions.push(currentQuestion);
      }
      const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
      currentQuestion = {
        id: quiz.questions.length + 1,
        text: questionText,
        options: [],
        correctIndices: [],
        timeLimit: 20 // default
      };
      continue;
    }

    // Option (- [ ] or - [x])
    const optionMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (optionMatch && currentQuestion) {
      const isCorrect = optionMatch[1].toLowerCase() === 'x';
      const optionText = optionMatch[2].trim();
      const optionIndex = currentQuestion.options.length;
      currentQuestion.options.push(optionText);
      if (isCorrect) {
        currentQuestion.correctIndices.push(optionIndex);
      }
      continue;
    }

    // Time metadata (::time=20)
    const timeMatch = trimmed.match(/^::time=(\d+)$/);
    if (timeMatch && currentQuestion) {
      currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
      continue;
    }
  }

  // Push last question
  if (currentQuestion) {
    quiz.questions.push(currentQuestion);
  }

  return quiz;
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function getQuestionForParticipants(question) {
  // Send question without correct answers
  return {
    id: question.id,
    text: question.text,
    options: question.options,
    timeLimit: question.timeLimit
  };
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

// ============================================
// REST API ENDPOINTS
// ============================================

// Admin login
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  try {
    // Check if master admin exists in database
    let admin = await db.getMasterAdmin();

    if (!admin) {
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
          { id: admin.id, username: admin.username, role: admin.role },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );

        return res.json({
          success: true,
          token,
          admin: { id: admin.id, username: admin.username, role: admin.role, displayName: admin.display_name },
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
          error: `Invalid password. ${attemptsLeft} attempts remaining.`
        });
      } else {
        return res.status(429).json({
          success: false,
          error: 'Account locked for 5 minutes due to too many failed attempts.'
        });
      }
    }

    // Successful login
    await db.resetLoginAttempts(admin.id);
    await db.logActivity(admin.id, 'login', {}, ipAddress);

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role },
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
  const { markdown } = req.body;
  try {
    const quiz = parseQuizMarkdown(markdown);

    // Create session in database
    const { id, code, quizData } = await db.createSession(quiz);

    // Create in-memory session state
    const sessionState = {
      id,
      code,
      quiz,
      participants: {},
      quizState: {
        isRunning: false,
        currentQuestionIndex: -1,
        questionEndTime: null,
        showingResults: false
      },
      questionStartTime: null
    };
    activeSessions.set(code, sessionState);

    // Generate QR code
    const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${code}`;
    const qrCode = await generateQRCode(joinUrl);

    res.json({
      success: true,
      session: {
        code,
        quiz,
        qrCode,
        joinUrl
      }
    });
  } catch (err) {
    console.error('Session creation error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Get QR code for a session
app.get('/api/admin/session/:code/qr', async (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const joinUrl = `${req.protocol}://${req.get('host')}/play.html?session=${code}`;
  const qrCode = await generateQRCode(joinUrl);

  res.json({ success: true, qrCode, joinUrl });
});

// End a session
app.post('/api/admin/session/:code/end', async (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  // Update database status
  await db.updateSessionStatus(code, 'ended');

  // Save final participant scores to database
  for (const participant of Object.values(session.participants)) {
    await db.updateParticipantScore(participant.id, participant.score || 0, participant.correctCount || 0);
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

  // Remove from active sessions
  activeSessions.delete(code);

  res.json({ success: true, message: 'Session ended' });
});

// Get session info
app.get('/api/admin/session/:code', async (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    // Try to get from database (might be ended session)
    const dbSession = await db.getSession(code);
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
  const sessions = await db.listSessions(limit);
  res.json({ success: true, sessions });
});

// Get participants for a session
app.get('/api/admin/session/:code/participants', (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const list = Object.values(session.participants).map(p => ({
    id: p.id,
    name: p.name,
    score: p.score,
    answeredCount: Object.keys(p.answers).length
  }));

  res.json({ participants: list });
});

// Get final results for a session
app.get('/api/admin/session/:code/results', async (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session || !session.quiz) {
    return res.json({ results: [] });
  }

  // Get all answers from database with response times
  const dbAnswers = await db.getAnswersBySession(session.id);

  // Calculate results with response time consideration
  const results = Object.values(session.participants).map(p => {
    let correctCount = 0;
    let totalResponseTime = 0;
    let answeredCount = 0;

    for (const question of session.quiz.questions) {
      const answer = p.answers[question.id];
      if (answer !== undefined && question.correctIndices.includes(answer)) {
        correctCount++;
      }

      // Get response time for this answer from database
      const dbAnswer = dbAnswers.find(a =>
        a.participant_id === p.id && a.question_index === session.quiz.questions.indexOf(question)
      );
      if (dbAnswer && dbAnswer.response_time_ms) {
        totalResponseTime += dbAnswer.response_time_ms;
        answeredCount++;
      }
    }

    const avgResponseTime = answeredCount > 0 ? totalResponseTime / answeredCount : 999999;

    return {
      name: p.name,
      score: correctCount,
      total: session.quiz.questions.length,
      avgResponseTime
    };
  }).sort((a, b) => {
    // Primary sort: by score (descending)
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    // Secondary sort: by average response time (ascending - faster is better)
    return a.avgResponseTime - b.avgResponseTime;
  });

  res.json({ results });
});

// Join a specific session (replaces /api/join)
app.post('/api/session/:code/join', async (req, res) => {
  const { code } = req.params;
  const { name, existingParticipantId } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Name is required' });
  }

  const session = activeSessions.get(code);
  if (!session) {
    return res.status(400).json({ success: false, error: 'Session not found or has ended' });
  }

  if (session.quizState.isRunning && session.quizState.currentQuestionIndex >= session.quiz.questions.length - 1) {
    return res.status(400).json({ success: false, error: 'Cannot join - quiz is ending' });
  }

  // Check if this is a rejoin with an existing participant ID
  if (existingParticipantId && session.participants[existingParticipantId]) {
    const existing = session.participants[existingParticipantId];
    // Update name in case it changed
    existing.name = name.trim();

    return res.json({
      success: true,
      participantId: existingParticipantId,
      sessionCode: code,
      quizTitle: session.quiz.title
    });
  }

  // Create participant in database
  const { id } = await db.createParticipant(session.id, name.trim());

  // Add to in-memory session
  session.participants[id] = {
    id,
    name: name.trim(),
    score: 0,
    correctCount: 0,
    answers: {},
    socketId: null
  };

  // Notify admin
  io.to(`admin:${code}`).emit('participant_joined', {
    id,
    name: name.trim(),
    count: Object.keys(session.participants).length
  });

  res.json({
    success: true,
    participantId: id,
    sessionCode: code,
    quizTitle: session.quiz.title
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

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
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
app.post('/api/admin/recovery/questions', async (req, res) => {
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
app.post('/api/admin/recovery/verify', async (req, res) => {
  const { answer1, answer2, newPassword } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;

  if (!answer1 || !answer2 || !newPassword) {
    return res.status(400).json({ success: false, error: 'All fields are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
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
app.post('/api/admin/session/:code/kick/:participantId', authenticateToken, async (req, res) => {
  const { code, participantId } = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;

  const session = activeSessions.get(code);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const participant = session.participants[participantId];
  if (!participant) {
    return res.status(404).json({ success: false, error: 'Participant not found' });
  }

  try {
    // Mark as kicked in database
    await db.kickParticipant(participantId);

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

    res.json({ success: true, message: `${participant.name} has been removed from the session` });
  } catch (err) {
    console.error('Kick participant error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

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
// ANALYTICS API ENDPOINTS
// ============================================

// Helper function for CSV escaping
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Helper function for difficulty rating
function getDifficultyRating(correctPercent) {
  if (correctPercent >= 70) return 'easy';
  if (correctPercent >= 40) return 'medium';
  return 'hard';
}

// Platform overview statistics
app.get('/api/admin/analytics/overview', async (req, res) => {
  const stats = await db.getPlatformStats();
  res.json({
    success: true,
    stats: {
      totalSessions: stats.total_sessions || 0,
      completedSessions: stats.completed_sessions || 0,
      totalParticipants: stats.total_participants || 0,
      overallAvgScore: stats.overall_avg_score || 0
    }
  });
});

// List completed sessions with analytics
app.get('/api/admin/analytics/sessions', async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const sessions = await db.getSessionAnalytics(limit);
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
      avgScorePercent: s.avg_score_percent || 0
    }))
  });
});

// Detailed session analytics
app.get('/api/admin/analytics/session/:code', async (req, res) => {
  const { code } = req.params;
  const session = await db.getSession(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  const questionAnalytics = await db.getQuestionAnalytics(session.id);
  const participantPerformance = await db.getParticipantPerformance(session.id);
  const answerDistribution = await db.getAnswerDistribution(session.id);

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
      questionsAnswered: p.questions_answered
    }))
  });
});

// Question difficulty breakdown
app.get('/api/admin/analytics/session/:code/questions', async (req, res) => {
  const { code } = req.params;
  const session = await db.getSession(code);

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
app.get('/api/admin/analytics/session/:code/export', async (req, res) => {
  const { code } = req.params;
  const session = await db.getSession(code);

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
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Admin joins a session's admin room
  socket.on('admin_join', (sessionCode) => {
    if (sessionCode) {
      socket.join(`admin:${sessionCode}`);
      socket.sessionCode = sessionCode;
      socket.isAdmin = true;
      console.log('Admin joined session:', sessionCode);
    }
  });

  // Presenter joins a session (receives same events, no controls)
  socket.on('presenter_join', (sessionCode) => {
    if (!sessionCode) return;

    const session = activeSessions.get(sessionCode);
    if (!session) {
      socket.emit('session_invalid', { message: 'Session not found' });
      return;
    }

    socket.join(`admin:${sessionCode}`);
    socket.join(`session:${sessionCode}`);
    socket.sessionCode = sessionCode;
    console.log('Presenter joined session:', sessionCode);

    // Send current participant count
    socket.emit('participant_joined', {
      count: Object.keys(session.participants).length
    });

    // Send quiz info
    socket.emit('quiz_loaded', {
      title: session.quiz.title,
      questionCount: session.quiz.questions.length,
      sessionCode
    });
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

    // Check if participant was kicked
    const wasKicked = await db.isParticipantKicked(participantId);
    if (wasKicked) {
      socket.emit('kicked', { message: 'You have been removed from this session.' });
      socket.emit('clear_participant_id');
      return;
    }

    const participant = session.participants[participantId];
    if (!participant) {
      socket.emit('session_invalid', { message: 'Please rejoin the session' });
      socket.emit('clear_participant_id');
      return;
    }

    socket.join(`session:${sessionCode}`);
    socket.participantId = participantId;
    socket.sessionCode = sessionCode;
    participant.socketId = socket.id;

    // Update socket ID in database
    await db.updateParticipantSocket(participantId, socket.id);

    console.log('Participant joined:', participant.name, 'in session:', sessionCode);

    // If quiz is in progress, send current state
    if (session.quizState.isRunning && session.quizState.currentQuestionIndex >= 0) {
      const question = session.quiz.questions[session.quizState.currentQuestionIndex];
      const timeRemaining = Math.max(0, Math.ceil((session.quizState.questionEndTime - Date.now()) / 1000));

      if (session.quizState.showingResults) {
        socket.emit('question_ended', {
          questionId: question.id,
          correctIndices: question.correctIndices,
          stats: calculateStats(session, question.id),
          yourAnswer: participant.answers[question.id]
        });
      } else if (timeRemaining > 0) {
        socket.emit('question_started', {
          question: getQuestionForParticipants(question),
          timeRemaining,
          questionNumber: session.quizState.currentQuestionIndex + 1,
          totalQuestions: session.quiz.questions.length
        });
      }
    }
  });

  // Admin starts quiz
  socket.on('start_quiz', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || session.quiz.questions.length === 0) return;

    session.quizState.isRunning = true;
    session.quizState.currentQuestionIndex = -1;
    session.quizState.showingResults = false;

    // Update database status
    await db.updateSessionStatus(sessionCode, 'active');

    // Reset all participant answers and scores
    for (const p of Object.values(session.participants)) {
      p.answers = {};
      p.score = 0;
      p.correctCount = 0;
    }

    io.to(`session:${sessionCode}`).emit('quiz_started', {
      title: session.quiz.title,
      totalQuestions: session.quiz.questions.length
    });

    io.to(`admin:${sessionCode}`).emit('quiz_started', {
      title: session.quiz.title,
      totalQuestions: session.quiz.questions.length
    });
  });

  // Admin advances to next question
  socket.on('next_question', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || !session.quizState.isRunning) return;

    session.quizState.currentQuestionIndex++;
    session.quizState.showingResults = false;

    if (session.quizState.currentQuestionIndex >= session.quiz.questions.length) {
      // Quiz ended
      session.quizState.isRunning = false;
      const pointsPerQuestion = session.quiz.totalScore / session.quiz.questions.length;

      // Update database status
      await db.updateSessionStatus(sessionCode, 'ended');

      // Save final scores to database and send results to each participant
      console.log(`[FINAL SCORES] Points per question: ${pointsPerQuestion}`);
      for (const participant of Object.values(session.participants)) {
        const finalScore = Math.round((participant.correctCount || 0) * pointsPerQuestion);
        const percentage = Math.round(((participant.correctCount || 0) / session.quiz.questions.length) * 100);
        const passed = percentage >= session.quiz.passingPercent;
        console.log(`[FINAL SCORES] ${participant.name}: ${participant.correctCount} correct, ${finalScore}/${session.quiz.totalScore} points, ${percentage}%`);

        // Update database
        await db.updateParticipantScore(participant.id, finalScore, participant.correctCount || 0);

        if (participant.socketId) {
          io.to(participant.socketId).emit('quiz_ended', {
            finalScore,
            totalScore: session.quiz.totalScore,
            correctCount: participant.correctCount || 0,
            totalQuestions: session.quiz.questions.length,
            percentage,
            passed,
            passingPercent: session.quiz.passingPercent
          });
        }
      }

      io.to(`admin:${sessionCode}`).emit('quiz_ended');
      return;
    }

    const question = session.quiz.questions[session.quizState.currentQuestionIndex];
    session.quizState.questionEndTime = Date.now() + (question.timeLimit * 1000);
    session.questionStartTime = Date.now();

    io.to(`session:${sessionCode}`).emit('question_started', {
      question: getQuestionForParticipants(question),
      timeRemaining: question.timeLimit,
      questionNumber: session.quizState.currentQuestionIndex + 1,
      totalQuestions: session.quiz.questions.length
    });

    io.to(`admin:${sessionCode}`).emit('question_started', {
      question: question,
      timeRemaining: question.timeLimit,
      questionNumber: session.quizState.currentQuestionIndex + 1,
      totalQuestions: session.quiz.questions.length
    });

    // Auto-end question when time expires
    const questionIndex = session.quizState.currentQuestionIndex;
    setTimeout(() => {
      if (session.quizState.currentQuestionIndex === questionIndex && !session.quizState.showingResults) {
        endCurrentQuestion(sessionCode);
      }
    }, question.timeLimit * 1000);
  });

  // Admin manually ends current question
  socket.on('end_question', (sessionCode) => {
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

    if (!session.quizState.isRunning) return;
    if (session.quizState.showingResults) return;

    const question = session.quiz.questions.find(q => q.id === questionId);
    if (!question) return;

    // Check if already answered
    if (participant.answers[questionId] !== undefined) return;

    // Check if time expired
    if (Date.now() > session.quizState.questionEndTime) return;

    participant.answers[questionId] = answerIndex;

    // Calculate response time
    const responseTimeMs = session.questionStartTime ? Date.now() - session.questionStartTime : null;

    // Record answer in database
    const isCorrect = question.correctIndices.includes(answerIndex);
    console.log(`[ANSWER] Participant: ${participant.name}, Q${questionId}, Answer: ${answerIndex}, Correct: ${isCorrect}, CorrectIndices: [${question.correctIndices}]`);
    await db.recordAnswer(
      session.id,
      participantId,
      session.quizState.currentQuestionIndex,
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

    // Confirm to participant
    socket.emit('answer_confirmed', { questionId, answerIndex });
  });

  // Admin ends session
  socket.on('end_session', async (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session) return;

    // Update database status
    await db.updateSessionStatus(sessionCode, 'ended');

    // Save final participant scores
    for (const participant of Object.values(session.participants)) {
      await db.updateParticipantScore(participant.id, participant.score || 0, participant.correctCount || 0);
    }

    // Notify all clients
    io.to(`session:${sessionCode}`).emit('session_ended', {
      message: 'This session has ended. Thank you for participating!'
    });

    io.to(`admin:${sessionCode}`).emit('session_ended', {
      code: sessionCode,
      message: 'Session ended successfully'
    });

    // Remove from active sessions
    activeSessions.delete(sessionCode);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

function endCurrentQuestion(sessionCode) {
  const session = activeSessions.get(sessionCode);
  if (!session || !session.quiz || session.quizState.currentQuestionIndex < 0) return;
  if (session.quizState.showingResults) return;

  session.quizState.showingResults = true;
  const question = session.quiz.questions[session.quizState.currentQuestionIndex];
  const stats = calculateStats(session, question.id);
  const pointsPerQuestion = session.quiz.totalScore / session.quiz.questions.length;

  // Update scores
  console.log(`[SCORING] Question ${question.id} ended. Correct indices: [${question.correctIndices}]`);
  for (const participant of Object.values(session.participants)) {
    const answer = participant.answers[question.id];
    const wasCorrect = answer !== undefined && question.correctIndices.includes(answer);
    if (wasCorrect) {
      participant.correctCount = (participant.correctCount || 0) + 1;
    }
    console.log(`[SCORING] ${participant.name}: answered ${answer}, correct: ${wasCorrect}, total correct: ${participant.correctCount}`);
  }

  // Build results for each participant
  const participantResults = {};
  for (const participant of Object.values(session.participants)) {
    const currentScore = Math.round((participant.correctCount || 0) * pointsPerQuestion);
    participantResults[participant.id] = {
      yourAnswer: participant.answers[question.id],
      currentScore,
      correctCount: participant.correctCount || 0
    };
  }

  // Broadcast to all participants - they'll look up their own data
  io.to(`session:${sessionCode}`).emit('question_ended', {
    questionId: question.id,
    correctIndices: question.correctIndices,
    stats,
    participantResults,
    totalScore: session.quiz.totalScore,
    questionsAnswered: session.quizState.currentQuestionIndex + 1,
    totalQuestions: session.quiz.questions.length
  });

  // Send to admin
  io.to(`admin:${sessionCode}`).emit('question_ended', {
    questionId: question.id,
    correctIndices: question.correctIndices,
    stats
  });
}

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Markdown Mash server running on http://localhost:${PORT}`);
  console.log(`Admin password: ${adminPassword}`);
});
