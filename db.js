const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'quiz.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  -- Sessions: Core session management
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    quiz_title TEXT,
    quiz_data TEXT NOT NULL,
    status TEXT DEFAULT 'created',
    created_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    ended_at TEXT,
    total_questions INTEGER DEFAULT 0,
    passing_percent INTEGER DEFAULT 70,
    total_score INTEGER DEFAULT 100
  );

  -- Participants: Track who joined each session
  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    joined_at TEXT DEFAULT (datetime('now')),
    socket_id TEXT
  );

  -- Answers: Individual answer records for analytics
  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
    participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    answer_index INTEGER,
    is_correct INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    answered_at TEXT DEFAULT (datetime('now'))
  );

  -- Indexes
  CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
  CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
  CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
`);

// Prepared statements for better performance
const statements = {
  // Sessions
  createSession: db.prepare(`
    INSERT INTO sessions (code, quiz_title, quiz_data, total_questions, passing_percent, total_score)
    VALUES (@code, @quiz_title, @quiz_data, @total_questions, @passing_percent, @total_score)
  `),
  getSessionByCode: db.prepare(`SELECT * FROM sessions WHERE code = ?`),
  getSessionById: db.prepare(`SELECT * FROM sessions WHERE id = ?`),
  updateSessionStatus: db.prepare(`
    UPDATE sessions SET status = @status, started_at = CASE WHEN @status = 'active' THEN datetime('now') ELSE started_at END,
    ended_at = CASE WHEN @status = 'ended' THEN datetime('now') ELSE ended_at END
    WHERE code = @code
  `),
  listSessions: db.prepare(`
    SELECT id, code, quiz_title, status, created_at, started_at, ended_at, total_questions,
           (SELECT COUNT(*) FROM participants WHERE session_id = sessions.id) as participant_count
    FROM sessions ORDER BY created_at DESC LIMIT ?
  `),

  // Participants
  createParticipant: db.prepare(`
    INSERT INTO participants (id, session_id, name, socket_id)
    VALUES (@id, @session_id, @name, @socket_id)
  `),
  getParticipant: db.prepare(`SELECT * FROM participants WHERE id = ?`),
  getParticipantsBySession: db.prepare(`SELECT * FROM participants WHERE session_id = ?`),
  updateParticipantScore: db.prepare(`
    UPDATE participants SET score = @score, correct_count = @correct_count WHERE id = @id
  `),
  updateParticipantSocket: db.prepare(`UPDATE participants SET socket_id = ? WHERE id = ?`),

  // Answers
  recordAnswer: db.prepare(`
    INSERT INTO answers (session_id, participant_id, question_index, answer_index, is_correct, response_time_ms)
    VALUES (@session_id, @participant_id, @question_index, @answer_index, @is_correct, @response_time_ms)
  `),
  getAnswersBySession: db.prepare(`SELECT * FROM answers WHERE session_id = ?`),
  getAnswersByParticipant: db.prepare(`SELECT * FROM answers WHERE participant_id = ?`)
};

// Helper functions
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars: I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateParticipantId() {
  return Math.random().toString(36).substring(2, 8);
}

// Database API
const dbApi = {
  // Session operations
  createSession(quizData) {
    let code;
    let attempts = 0;
    // Generate unique code
    while (attempts < 10) {
      code = generateSessionCode();
      const existing = statements.getSessionByCode.get(code);
      if (!existing) break;
      attempts++;
    }
    if (attempts >= 10) {
      throw new Error('Failed to generate unique session code');
    }

    const result = statements.createSession.run({
      code,
      quiz_title: quizData.title || 'Untitled Quiz',
      quiz_data: JSON.stringify(quizData),
      total_questions: quizData.questions.length,
      passing_percent: quizData.passingPercent || 70,
      total_score: quizData.totalScore || 100
    });

    return {
      id: result.lastInsertRowid,
      code,
      quizData
    };
  },

  getSession(code) {
    const row = statements.getSessionByCode.get(code);
    if (!row) return null;
    return {
      ...row,
      quiz_data: JSON.parse(row.quiz_data)
    };
  },

  getSessionById(id) {
    const row = statements.getSessionById.get(id);
    if (!row) return null;
    return {
      ...row,
      quiz_data: JSON.parse(row.quiz_data)
    };
  },

  updateSessionStatus(code, status) {
    return statements.updateSessionStatus.run({ code, status });
  },

  listSessions(limit = 50) {
    return statements.listSessions.all(limit);
  },

  // Participant operations
  createParticipant(sessionId, name, socketId = null) {
    const id = generateParticipantId();
    statements.createParticipant.run({
      id,
      session_id: sessionId,
      name,
      socket_id: socketId
    });
    return { id, sessionId, name };
  },

  getParticipant(id) {
    return statements.getParticipant.get(id);
  },

  getParticipantsBySession(sessionId) {
    return statements.getParticipantsBySession.all(sessionId);
  },

  updateParticipantScore(id, score, correctCount) {
    return statements.updateParticipantScore.run({ id, score, correct_count: correctCount });
  },

  updateParticipantSocket(id, socketId) {
    return statements.updateParticipantSocket.run(socketId, id);
  },

  // Answer operations
  recordAnswer(sessionId, participantId, questionIndex, answerIndex, isCorrect, responseTimeMs = null) {
    return statements.recordAnswer.run({
      session_id: sessionId,
      participant_id: participantId,
      question_index: questionIndex,
      answer_index: answerIndex,
      is_correct: isCorrect ? 1 : 0,
      response_time_ms: responseTimeMs
    });
  },

  getAnswersBySession(sessionId) {
    return statements.getAnswersBySession.all(sessionId);
  },

  getAnswersByParticipant(participantId) {
    return statements.getAnswersByParticipant.all(participantId);
  },

  // Utility
  generateParticipantId,
  generateSessionCode,

  // Close database (for cleanup)
  close() {
    db.close();
  }
};

module.exports = dbApi;
