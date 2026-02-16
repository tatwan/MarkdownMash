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

// Initialize tables (with retry for cold-start connection issues)
async function initializeDatabase(retries = 5, delay = 3000) {
  let client;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      client = await pool.connect();
      break;
    } catch (err) {
      console.error(`Database connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) {
        console.error('All database connection attempts failed. Exiting.');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  try {
    // Create new tables
    await client.query(`
      -- Admins: Admin user accounts (multi-admin ready)
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        display_name TEXT,
        role TEXT DEFAULT 'admin',
        security_question_1 TEXT,
        security_answer_1 TEXT,
        security_question_2 TEXT,
        security_answer_2 TEXT,
        created_by INTEGER REFERENCES admins(id),
        is_active BOOLEAN DEFAULT true,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

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

      -- Admin activity log for audit trail
      CREATE TABLE IF NOT EXISTS admin_activity_log (
        id SERIAL PRIMARY KEY,
        admin_id INTEGER REFERENCES admins(id),
        action TEXT NOT NULL,
        details JSONB,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
      CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id);
    `);

    // Add new columns to existing tables (migrations)
    await runMigrations(client);

    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err.message);
  } finally {
    client.release();
  }
}

// Run migrations to add new columns to existing tables
async function runMigrations(client) {
  const migrations = [
    // Add owner_id to sessions
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'owner_id'",
      migrate: "ALTER TABLE sessions ADD COLUMN owner_id INTEGER REFERENCES admins(id)"
    },
    // Add is_kicked to participants
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'is_kicked'",
      migrate: "ALTER TABLE participants ADD COLUMN is_kicked BOOLEAN DEFAULT false"
    },
    // Add kicked_at to participants
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'kicked_at'",
      migrate: "ALTER TABLE participants ADD COLUMN kicked_at TIMESTAMP"
    }
  ];

  for (const migration of migrations) {
    try {
      const result = await client.query(migration.check);
      if (result.rows.length === 0) {
        await client.query(migration.migrate);
        console.log('Migration applied:', migration.migrate.substring(0, 50) + '...');
      }
    } catch (err) {
      // Ignore errors for migrations (column might already exist)
      console.log('Migration skipped or already applied');
    }
  }

  // Create index for owner_id if it doesn't exist
  try {
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_owner ON sessions(owner_id)');
  } catch (err) {
    // Ignore
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

  async getParticipantAnswers(sessionId) {
    const result = await pool.query(
      `SELECT participant_id, question_index, is_correct
       FROM answers
       WHERE session_id = $1
       ORDER BY participant_id, question_index`,
      [sessionId]
    );
    return result.rows;
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

  // ============================================
  // ADMIN OPERATIONS
  // ============================================

  async getAdminByUsername(username) {
    const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);
    return result.rows[0] || null;
  },

  async getAdminById(id) {
    const result = await pool.query('SELECT * FROM admins WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async getMasterAdmin() {
    const result = await pool.query("SELECT * FROM admins WHERE role = 'master' LIMIT 1");
    return result.rows[0] || null;
  },

  async createAdmin({ username, passwordHash, email, displayName, role, createdBy }) {
    const result = await pool.query(
      `INSERT INTO admins (username, password_hash, email, display_name, role, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, username, email, display_name, role, created_at`,
      [username, passwordHash, email, displayName, role || 'admin', createdBy]
    );
    return result.rows[0];
  },

  async updateAdminPassword(adminId, passwordHash) {
    return pool.query(
      'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, adminId]
    );
  },

  async updateAdminSecurityQuestions(adminId, q1, a1, q2, a2) {
    return pool.query(
      `UPDATE admins SET
        security_question_1 = $1, security_answer_1 = $2,
        security_question_2 = $3, security_answer_2 = $4,
        updated_at = NOW()
       WHERE id = $5`,
      [q1, a1, q2, a2, adminId]
    );
  },

  async updateAdminEmail(adminId, email) {
    return pool.query(
      'UPDATE admins SET email = $1, updated_at = NOW() WHERE id = $2',
      [email, adminId]
    );
  },

  async recordFailedLogin(adminId) {
    const result = await pool.query(
      `UPDATE admins SET
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE
          WHEN failed_login_attempts >= 4 THEN NOW() + INTERVAL '5 minutes'
          ELSE locked_until
        END
       WHERE id = $1
       RETURNING failed_login_attempts, locked_until`,
      [adminId]
    );
    return result.rows[0];
  },

  async resetLoginAttempts(adminId) {
    return pool.query(
      'UPDATE admins SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [adminId]
    );
  },

  async isAdminLocked(adminId) {
    const result = await pool.query(
      'SELECT locked_until FROM admins WHERE id = $1',
      [adminId]
    );
    if (!result.rows[0] || !result.rows[0].locked_until) return false;
    return new Date(result.rows[0].locked_until) > new Date();
  },

  // ============================================
  // PARTICIPANT KICK OPERATIONS
  // ============================================

  async kickParticipant(participantId) {
    return pool.query(
      'UPDATE participants SET is_kicked = true, kicked_at = NOW() WHERE id = $1',
      [participantId]
    );
  },

  async isParticipantKicked(participantId) {
    const result = await pool.query(
      'SELECT is_kicked FROM participants WHERE id = $1',
      [participantId]
    );
    return result.rows[0]?.is_kicked || false;
  },

  async getKickedParticipants(sessionId) {
    const result = await pool.query(
      'SELECT * FROM participants WHERE session_id = $1 AND is_kicked = true',
      [sessionId]
    );
    return result.rows;
  },

  // ============================================
  // ACTIVITY LOG
  // ============================================

  async logActivity(adminId, action, details = {}, ipAddress = null) {
    return pool.query(
      'INSERT INTO admin_activity_log (admin_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
      [adminId, action, JSON.stringify(details), ipAddress]
    );
  },

  async getActivityLog(adminId, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM admin_activity_log
       WHERE admin_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [adminId, limit]
    );
    return result.rows;
  },

  // Close pool (for cleanup)
  async close() {
    await pool.end();
  }
};

module.exports = dbApi;
