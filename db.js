require('dotenv').config();
const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 to avoid IPv6 connection issues
dns.setDefaultResultOrder('ipv4first');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
pool.query('SELECT NOW()')
  .then(() => console.log('Connected to PostgreSQL database'))
  .catch(err => console.error('Database connection error:', err.message));

// Initialize tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Sessions: Core session management
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        quiz_title TEXT,
        quiz_data TEXT NOT NULL,
        status TEXT DEFAULT 'created',
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
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
        joined_at TIMESTAMP DEFAULT NOW(),
        socket_id TEXT
      );

      -- Answers: Individual answer records for analytics
      CREATE TABLE IF NOT EXISTS answers (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        participant_id TEXT REFERENCES participants(id) ON DELETE CASCADE,
        question_index INTEGER NOT NULL,
        answer_index INTEGER,
        is_correct INTEGER DEFAULT 0,
        response_time_ms INTEGER,
        answered_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    client.release();
  }
}

// Initialize on startup
initializeDatabase();

// Helper functions
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
  async createSession(quizData) {
    let code;
    let attempts = 0;

    while (attempts < 10) {
      code = generateSessionCode();
      const existing = await pool.query('SELECT id FROM sessions WHERE code = $1', [code]);
      if (existing.rows.length === 0) break;
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique session code');
    }

    const result = await pool.query(
      `INSERT INTO sessions (code, quiz_title, quiz_data, total_questions, passing_percent, total_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        code,
        quizData.title || 'Untitled Quiz',
        JSON.stringify(quizData),
        quizData.questions.length,
        quizData.passingPercent || 70,
        quizData.totalScore || 100
      ]
    );

    return {
      id: result.rows[0].id,
      code,
      quizData
    };
  },

  async getSession(code) {
    const result = await pool.query('SELECT * FROM sessions WHERE code = $1', [code]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      quiz_data: JSON.parse(row.quiz_data)
    };
  },

  async getSessionById(id) {
    const result = await pool.query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      ...row,
      quiz_data: JSON.parse(row.quiz_data)
    };
  },

  async updateSessionStatus(code, status) {
    let query;
    if (status === 'active') {
      query = 'UPDATE sessions SET status = $1, started_at = NOW() WHERE code = $2';
    } else if (status === 'ended') {
      query = 'UPDATE sessions SET status = $1, ended_at = NOW() WHERE code = $2';
    } else {
      query = 'UPDATE sessions SET status = $1 WHERE code = $2';
    }
    return pool.query(query, [status, code]);
  },

  async listSessions(limit = 50) {
    const result = await pool.query(
      `SELECT s.id, s.code, s.quiz_title, s.status, s.created_at, s.started_at, s.ended_at, s.total_questions,
              (SELECT COUNT(*) FROM participants WHERE session_id = s.id) as participant_count
       FROM sessions s
       ORDER BY s.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  // Participant operations
  async createParticipant(sessionId, name, socketId = null) {
    const id = generateParticipantId();
    await pool.query(
      'INSERT INTO participants (id, session_id, name, socket_id) VALUES ($1, $2, $3, $4)',
      [id, sessionId, name, socketId]
    );
    return { id, sessionId, name };
  },

  async getParticipant(id) {
    const result = await pool.query('SELECT * FROM participants WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async getParticipantsBySession(sessionId) {
    const result = await pool.query('SELECT * FROM participants WHERE session_id = $1', [sessionId]);
    return result.rows;
  },

  async updateParticipantScore(id, score, correctCount) {
    return pool.query(
      'UPDATE participants SET score = $1, correct_count = $2 WHERE id = $3',
      [score, correctCount, id]
    );
  },

  async updateParticipantSocket(id, socketId) {
    return pool.query('UPDATE participants SET socket_id = $1 WHERE id = $2', [socketId, id]);
  },

  // Answer operations
  async recordAnswer(sessionId, participantId, questionIndex, answerIndex, isCorrect, responseTimeMs = null) {
    return pool.query(
      `INSERT INTO answers (session_id, participant_id, question_index, answer_index, is_correct, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, participantId, questionIndex, answerIndex, isCorrect ? 1 : 0, responseTimeMs]
    );
  },

  async getAnswersBySession(sessionId) {
    const result = await pool.query('SELECT * FROM answers WHERE session_id = $1', [sessionId]);
    return result.rows;
  },

  async getAnswersByParticipant(participantId) {
    const result = await pool.query('SELECT * FROM answers WHERE participant_id = $1', [participantId]);
    return result.rows;
  },

  // Analytics operations
  async getSessionAnalytics(limit = 50) {
    const result = await pool.query(
      `SELECT
        s.id, s.code, s.quiz_title, s.status, s.created_at, s.started_at, s.ended_at,
        s.total_questions, s.total_score,
        COUNT(DISTINCT p.id) as participant_count,
        ROUND(AVG(p.correct_count * 100.0 / NULLIF(s.total_questions, 0))::numeric, 1) as avg_score_percent
      FROM sessions s
      LEFT JOIN participants p ON p.session_id = s.id
      WHERE s.status = 'ended'
      GROUP BY s.id
      ORDER BY s.ended_at DESC
      LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getQuestionAnalytics(sessionId) {
    const result = await pool.query(
      `SELECT
        a.question_index,
        COUNT(*) as total_answers,
        SUM(a.is_correct) as correct_count,
        ROUND((SUM(a.is_correct) * 100.0 / COUNT(*))::numeric, 1) as correct_percent,
        ROUND(AVG(a.response_time_ms)::numeric, 0) as avg_response_time_ms,
        MIN(a.response_time_ms) as min_response_time_ms,
        MAX(a.response_time_ms) as max_response_time_ms
      FROM answers a
      WHERE a.session_id = $1
      GROUP BY a.question_index
      ORDER BY a.question_index`,
      [sessionId]
    );
    return result.rows;
  },

  async getAnswerDistribution(sessionId) {
    const result = await pool.query(
      `SELECT
        a.question_index,
        a.answer_index,
        COUNT(*) as count
      FROM answers a
      WHERE a.session_id = $1
      GROUP BY a.question_index, a.answer_index
      ORDER BY a.question_index, a.answer_index`,
      [sessionId]
    );
    return result.rows;
  },

  async getParticipantPerformance(sessionId) {
    const result = await pool.query(
      `SELECT
        p.id, p.name, p.score, p.correct_count,
        ROUND(AVG(a.response_time_ms)::numeric, 0) as avg_response_time_ms,
        COUNT(a.id) as questions_answered
      FROM participants p
      LEFT JOIN answers a ON a.participant_id = p.id
      WHERE p.session_id = $1
      GROUP BY p.id
      ORDER BY p.correct_count DESC, avg_response_time_ms ASC`,
      [sessionId]
    );
    return result.rows;
  },

  async getPlatformStats() {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM sessions) as total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE status = 'ended') as completed_sessions,
        (SELECT COUNT(*) FROM participants) as total_participants,
        (SELECT ROUND(AVG(p.correct_count * 100.0 / NULLIF(s.total_questions, 0))::numeric, 1)
         FROM participants p
         JOIN sessions s ON s.id = p.session_id
         WHERE s.status = 'ended') as overall_avg_score`
    );
    return result.rows[0];
  },

  async getAnswersForExport(sessionId) {
    const result = await pool.query(
      `SELECT
        p.name as participant_name,
        a.question_index,
        a.answer_index,
        a.is_correct,
        a.response_time_ms,
        a.answered_at
      FROM answers a
      JOIN participants p ON p.id = a.participant_id
      WHERE a.session_id = $1
      ORDER BY p.name, a.question_index`,
      [sessionId]
    );
    return result.rows;
  },

  // Utility
  generateParticipantId,
  generateSessionCode,

  // Close pool (for cleanup)
  async close() {
    await pool.end();
  }
};

module.exports = dbApi;
