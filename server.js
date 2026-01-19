const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const QRCode = require('qrcode');
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
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Create a new session (upload quiz, get session code + QR)
app.post('/api/admin/session', async (req, res) => {
  const { markdown } = req.body;
  try {
    const quiz = parseQuizMarkdown(markdown);

    // Create session in database
    const { id, code, quizData } = db.createSession(quiz);

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
app.post('/api/admin/session/:code/end', (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }

  // Update database status
  db.updateSessionStatus(code, 'ended');

  // Save final participant scores to database
  for (const participant of Object.values(session.participants)) {
    db.updateParticipantScore(participant.id, participant.score || 0, participant.correctCount || 0);
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
app.get('/api/admin/session/:code', (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session) {
    // Try to get from database (might be ended session)
    const dbSession = db.getSession(code);
    if (dbSession) {
      return res.json({
        success: true,
        session: {
          code: dbSession.code,
          quiz: dbSession.quiz_data,
          status: dbSession.status,
          participantCount: db.getParticipantsBySession(dbSession.id).length
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
app.get('/api/admin/sessions', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const sessions = db.listSessions(limit);
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
app.get('/api/admin/session/:code/results', (req, res) => {
  const { code } = req.params;
  const session = activeSessions.get(code);

  if (!session || !session.quiz) {
    return res.json({ results: [] });
  }

  const results = Object.values(session.participants).map(p => {
    let correctCount = 0;
    for (const question of session.quiz.questions) {
      const answer = p.answers[question.id];
      if (answer !== undefined && question.correctIndices.includes(answer)) {
        correctCount++;
      }
    }
    return {
      name: p.name,
      score: correctCount,
      total: session.quiz.questions.length
    };
  }).sort((a, b) => b.score - a.score);

  res.json({ results });
});

// Join a specific session (replaces /api/join)
app.post('/api/session/:code/join', (req, res) => {
  const { code } = req.params;
  const { name } = req.body;

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

  // Create participant in database
  const { id } = db.createParticipant(session.id, name.trim());

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
  socket.on('participant_join', (data) => {
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

    socket.join(`session:${sessionCode}`);
    socket.participantId = participantId;
    socket.sessionCode = sessionCode;
    participant.socketId = socket.id;

    // Update socket ID in database
    db.updateParticipantSocket(participantId, socket.id);

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
  socket.on('start_quiz', (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || session.quiz.questions.length === 0) return;

    session.quizState.isRunning = true;
    session.quizState.currentQuestionIndex = -1;
    session.quizState.showingResults = false;

    // Update database status
    db.updateSessionStatus(sessionCode, 'active');

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
  socket.on('next_question', (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session || !session.quiz || !session.quizState.isRunning) return;

    session.quizState.currentQuestionIndex++;
    session.quizState.showingResults = false;

    if (session.quizState.currentQuestionIndex >= session.quiz.questions.length) {
      // Quiz ended
      session.quizState.isRunning = false;
      const pointsPerQuestion = session.quiz.totalScore / session.quiz.questions.length;

      // Update database status
      db.updateSessionStatus(sessionCode, 'ended');

      // Save final scores to database and send results to each participant
      for (const participant of Object.values(session.participants)) {
        const finalScore = Math.round((participant.correctCount || 0) * pointsPerQuestion);
        const percentage = Math.round(((participant.correctCount || 0) / session.quiz.questions.length) * 100);
        const passed = percentage >= session.quiz.passingPercent;

        // Update database
        db.updateParticipantScore(participant.id, finalScore, participant.correctCount || 0);

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
  socket.on('submit_answer', (data) => {
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
    db.recordAnswer(
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
  socket.on('end_session', (sessionCode) => {
    const session = activeSessions.get(sessionCode);
    if (!session) return;

    // Update database status
    db.updateSessionStatus(sessionCode, 'ended');

    // Save final participant scores
    for (const participant of Object.values(session.participants)) {
      db.updateParticipantScore(participant.id, participant.score || 0, participant.correctCount || 0);
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
  for (const participant of Object.values(session.participants)) {
    const answer = participant.answers[question.id];
    if (answer !== undefined && question.correctIndices.includes(answer)) {
      participant.correctCount = (participant.correctCount || 0) + 1;
    }
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
