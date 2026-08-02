require('dotenv').config();
const crypto = require('crypto');
const { Pool } = require('pg');
const dns = require('dns');
const { assertHostedRoomAvailable } = require('./hosted-room-guard');
const { normalizeEmail } = require('./account-identity');

// Force IPv4 to avoid IPv6 connection issues
dns.setDefaultResultOrder('ipv4first');

// Create connection pool
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: {
//     rejectUnauthorized: false
//   }
// });
// Only use SSL if we are in production OR if explicitly requested
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL || '';
const useSSL = isProduction
  || databaseUrl.includes('supabase.co')
  || databaseUrl.includes('render.com');
const skipDatabaseInit = process.env.SKIP_DATABASE_INIT === 'true';

const pool = new Pool({
  connectionString: databaseUrl || undefined,
  ...(useSSL && { ssl: { rejectUnauthorized: false } })
});

// Test connection unless an explicitly transient local run disables persistence.
if (!skipDatabaseInit) {
  pool.query('SELECT NOW()')
    .then(() => console.log('Connected to PostgreSQL database'))
    .catch(err => console.error('Database connection error:', err.message));
}

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
        email_verified_at TIMESTAMPTZ,
        display_name TEXT,
        role TEXT DEFAULT 'admin',
        account_status TEXT NOT NULL DEFAULT 'active'
          CHECK (account_status IN ('invited', 'active', 'past_due', 'suspended', 'deleted')),
        auth_source TEXT NOT NULL DEFAULT 'deployment'
          CHECK (auth_source IN ('deployment', 'hosted')),
        provisioning_source TEXT NOT NULL DEFAULT 'deployment'
          CHECK (provisioning_source IN ('deployment', 'master_invite', 'self_service')),
        access_override TEXT NOT NULL DEFAULT 'none'
          CHECK (access_override IN ('none', 'complimentary')),
        complimentary_access_until TIMESTAMPTZ,
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
        total_score INTEGER DEFAULT 100,
        course_name TEXT,
        is_test BOOLEAN DEFAULT false
      );

      -- Participants: Track who joined each session
      CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        score INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT NOW(),
        socket_id TEXT,
        avatar_id TEXT
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

      -- Hosted billing state. Secrets remain in deployment environment variables.
      CREATE TABLE IF NOT EXISTS subscriptions (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider = 'stripe'),
        provider_customer_id TEXT NOT NULL,
        provider_subscription_id TEXT,
        price_id TEXT,
        status TEXT NOT NULL DEFAULT 'checkout_pending',
        current_period_end TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
        last_event_created_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (account_id, provider),
        UNIQUE (provider_customer_id),
        UNIQUE (provider_subscription_id)
      );

      CREATE TABLE IF NOT EXISTS billing_events (
        provider_event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_created_at TIMESTAMPTZ,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        outcome TEXT NOT NULL DEFAULT 'received'
          CHECK (outcome IN ('received', 'processed', 'ignored')),
        payload_digest TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS account_invitations (
        id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        token_hash BYTEA NOT NULL UNIQUE CHECK (OCTET_LENGTH(token_hash) = 32),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_by INTEGER REFERENCES admins(id) ON DELETE SET NULL,
        purpose TEXT NOT NULL DEFAULT 'master_invite'
          CHECK (purpose IN ('master_invite', 'self_signup')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
      ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
      CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
      CREATE INDEX IF NOT EXISTS idx_answers_session ON answers(session_id);
      CREATE INDEX IF NOT EXISTS idx_admin_activity_admin ON admin_activity_log(admin_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status, current_period_end);
      CREATE INDEX IF NOT EXISTS idx_billing_events_received_at ON billing_events(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_account_invitations_pending_account
        ON account_invitations(account_id, created_at DESC) WHERE used_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_account_invitations_pending_expiry
        ON account_invitations(expires_at) WHERE used_at IS NULL;
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
    // Add course_name to sessions
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'course_name'",
      migrate: "ALTER TABLE sessions ADD COLUMN course_name TEXT"
    },
    // Add is_test to sessions
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'sessions' AND column_name = 'is_test'",
      migrate: "ALTER TABLE sessions ADD COLUMN is_test BOOLEAN DEFAULT false"
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
    },
    // Add avatar_id to participants
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'participants' AND column_name = 'avatar_id'",
      migrate: "ALTER TABLE participants ADD COLUMN avatar_id TEXT"
    },
    // Hosted account lifecycle and identity fields
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'email_verified_at'",
      migrate: "ALTER TABLE admins ADD COLUMN email_verified_at TIMESTAMPTZ"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'account_status'",
      migrate: "ALTER TABLE admins ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('invited', 'active', 'past_due', 'suspended', 'deleted'))"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'auth_source'",
      migrate: "ALTER TABLE admins ADD COLUMN auth_source TEXT NOT NULL DEFAULT 'deployment' CHECK (auth_source IN ('deployment', 'hosted'))"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'provisioning_source'",
      migrate: "ALTER TABLE admins ADD COLUMN provisioning_source TEXT NOT NULL DEFAULT 'deployment' CHECK (provisioning_source IN ('deployment', 'master_invite', 'self_service'))"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'access_override'",
      migrate: "ALTER TABLE admins ADD COLUMN access_override TEXT NOT NULL DEFAULT 'none' CHECK (access_override IN ('none', 'complimentary'))"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'admins' AND column_name = 'complimentary_access_until'",
      migrate: "ALTER TABLE admins ADD COLUMN complimentary_access_until TIMESTAMPTZ"
    },
    {
      check: "SELECT column_name FROM information_schema.columns WHERE table_name = 'account_invitations' AND column_name = 'purpose'",
      migrate: "ALTER TABLE account_invitations ADD COLUMN purpose TEXT NOT NULL DEFAULT 'master_invite' CHECK (purpose IN ('master_invite', 'self_signup'))"
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
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_open_owner
      ON sessions(owner_id, created_at DESC)
      WHERE owner_id IS NOT NULL AND status IN ('created', 'active')
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_normalized
      ON admins(LOWER(email))
      WHERE email IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admins_hosted_created_at
      ON admins(created_at DESC)
      WHERE auth_source = 'hosted'
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_admins_complimentary_expiry
      ON admins(complimentary_access_until)
      WHERE access_override = 'complimentary' AND complimentary_access_until IS NOT NULL
    `);
  } catch (err) {
    // Ignore
  }
}

// Initialize on startup. Guest-only local QA can opt out without changing production.
if (!skipDatabaseInit) {
  initializeDatabase();
} else {
  console.log('Database initialization skipped; persistent instructor features are unavailable.');
}

// Helper functions
function generateSessionCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

function generateParticipantId() {
  return crypto.randomBytes(9).toString('base64url');
}

// Database API
const dbApi = {
  // Session operations
  async createSession(quizData, courseName = null, ownerId = null, options = {}) {
    const enforceSingleOpenRoom = options.enforceSingleOpenRoom === true;
    const client = enforceSingleOpenRoom ? await pool.connect() : null;
    const database = client || pool;
    let code;
    let attempts = 0;

    try {
      if (client) {
        await client.query('BEGIN');
        await assertHostedRoomAvailable(client, ownerId);
      }

      while (attempts < 10) {
        code = generateSessionCode();
        const existing = await database.query('SELECT id FROM sessions WHERE code = $1', [code]);
        if (existing.rows.length === 0) break;
        attempts++;
      }

      if (attempts >= 10) {
        throw new Error('Failed to generate unique session code');
      }

      const result = await database.query(
        `INSERT INTO sessions (code, quiz_title, quiz_data, total_questions, passing_percent, total_score, course_name, is_test, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
         RETURNING id`,
        [
          code,
          quizData.title || 'Untitled Quiz',
          JSON.stringify(quizData),
          quizData.questions.length,
          quizData.passingPercent || 70,
          quizData.totalScore || 100,
          courseName,
          ownerId
        ]
      );

      if (client) await client.query('COMMIT');

      return {
        id: result.rows[0].id,
        code,
        quizData
      };
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('Session creation rollback failed:', rollbackError.message);
        }
      }
      throw error;
    } finally {
      if (client) client.release();
    }
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

  async listSessions(limit = 50, ownerId = null) {
    const result = await pool.query(
      `SELECT s.id, s.code, s.quiz_title, s.status, s.created_at, s.started_at, s.ended_at, s.total_questions, s.course_name, s.is_test,
              (SELECT COUNT(*) FROM participants WHERE session_id = s.id) as participant_count
       FROM sessions s
       WHERE ($1::integer IS NULL OR s.owner_id = $1)
       ORDER BY s.created_at DESC
       LIMIT $2`,
      [ownerId, limit]
    );
    return result.rows;
  },

  async deleteSession(code) {
    return pool.query('DELETE FROM sessions WHERE code = $1', [code]);
  },

  async updateSessionMetadata(code, courseName, isTest) {
    return pool.query(
      'UPDATE sessions SET course_name = $1, is_test = $2 WHERE code = $3 RETURNING *',
      [courseName, isTest, code]
    );
  },

  // Participant operations
  async createParticipant(sessionId, name, socketId = null, avatarId = null) {
    const id = generateParticipantId();
    await pool.query(
      'INSERT INTO participants (id, session_id, name, socket_id, avatar_id) VALUES ($1, $2, $3, $4, $5)',
      [id, sessionId, name, socketId, avatarId]
    );
    return { id, sessionId, name, avatarId };
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

  async updateParticipantAvatar(id, avatarId) {
    return pool.query('UPDATE participants SET avatar_id = $1 WHERE id = $2', [avatarId, id]);
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
  async getSessionAnalytics(limit = 50, statusFilter = null, ownerId = null) {
    const conditions = ['($1::integer IS NULL OR s.owner_id = $1)'];
    const params = [ownerId, limit];

    if (statusFilter === 'ended') {
      conditions.push("s.status = 'ended'");
    } else if (statusFilter === 'incomplete') {
      // incomplete = active (interrupted) or created (never started / trial runs)
      conditions.push("s.status IN ('active', 'created')");
    }

    const result = await pool.query(
      `SELECT
        s.id, s.code, s.quiz_title, s.status, s.created_at, s.started_at, s.ended_at,
        s.total_questions, s.total_score, s.course_name, s.is_test,
        COUNT(DISTINCT p.id) as participant_count,
        ROUND(AVG(p.correct_count * 100.0 / NULLIF(s.total_questions, 0))::numeric, 1) as avg_score_percent
      FROM sessions s
      LEFT JOIN participants p ON p.session_id = s.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY s.id
      ORDER BY COALESCE(s.ended_at, s.started_at, s.created_at) DESC
      LIMIT $2`,
      params
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

  async getPlatformStats(ownerId = null) {
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM sessions WHERE ($1::integer IS NULL OR owner_id = $1)) as total_sessions,
        (SELECT COUNT(*) FROM sessions WHERE status = 'ended' AND ($1::integer IS NULL OR owner_id = $1)) as completed_sessions,
        (SELECT COUNT(*) FROM participants p JOIN sessions s ON s.id = p.session_id
          WHERE ($1::integer IS NULL OR s.owner_id = $1)) as total_participants,
        (SELECT COUNT(DISTINCT course_name) FROM sessions
          WHERE course_name IS NOT NULL AND course_name != ''
            AND ($1::integer IS NULL OR owner_id = $1)) as total_courses,
        (SELECT ROUND(AVG(p.correct_count * 100.0 / NULLIF(s.total_questions, 0))::numeric, 1)
         FROM participants p
         JOIN sessions s ON s.id = p.session_id
         WHERE s.status = 'ended'
           AND ($1::integer IS NULL OR s.owner_id = $1)) as overall_avg_score`,
      [ownerId]
    );
    return result.rows[0];
  },

  async getCourseStats(ownerId = null) {
    const result = await pool.query(
      `SELECT
        COALESCE(NULLIF(TRIM(s.course_name), ''), 'No Course') as course_name,
        COUNT(DISTINCT s.id) as session_count,
        COUNT(DISTINCT p.id) as participant_count
       FROM sessions s
       LEFT JOIN participants p ON p.session_id = s.id
       WHERE s.is_test = false
         AND ($1::integer IS NULL OR s.owner_id = $1)
       GROUP BY COALESCE(NULLIF(TRIM(s.course_name), ''), 'No Course')
       ORDER BY session_count DESC`,
      [ownerId]
    );
    return result.rows;
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

  async getAdminByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return null;
    const result = await pool.query(
      'SELECT * FROM admins WHERE LOWER(email) = $1 LIMIT 1',
      [normalizedEmail]
    );
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

  async createAdmin({
    username,
    passwordHash,
    email,
    emailVerifiedAt = null,
    displayName,
    role,
    accountStatus = 'active',
    authSource = 'deployment',
    provisioningSource = 'deployment',
    createdBy
  }) {
    const result = await pool.query(
      `INSERT INTO admins (
         username, password_hash, email, email_verified_at, display_name, role,
         account_status, auth_source, provisioning_source, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, username, email, email_verified_at, display_name, role,
                 account_status, auth_source, provisioning_source, created_at`,
      [
        username,
        passwordHash,
        normalizeEmail(email),
        emailVerifiedAt,
        displayName,
        role || 'admin',
        accountStatus,
        authSource,
        provisioningSource,
        createdBy
      ]
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
      `UPDATE admins
       SET email = $1, email_verified_at = NULL, updated_at = NOW()
       WHERE id = $2`,
      [normalizeEmail(email), adminId]
    );
  },

  async markAdminEmailVerified(adminId, verifiedAt = new Date()) {
    return pool.query(
      'UPDATE admins SET email_verified_at = $1, updated_at = NOW() WHERE id = $2',
      [verifiedAt, adminId]
    );
  },

  // ============================================
  // HOSTED ACCOUNT INVITATIONS
  // ============================================

  async createHostedAccountInvitation({
    email,
    displayName,
    username,
    passwordHash,
    tokenHash,
    expiresAt,
    createdBy
  }) {
    const client = await pool.connect();
    const normalizedEmail = normalizeEmail(email);

    try {
      await client.query('BEGIN');
      const existingResult = await client.query(
        'SELECT * FROM admins WHERE LOWER(email) = $1 FOR UPDATE',
        [normalizedEmail]
      );
      let account = existingResult.rows[0];

      if (account) {
        const canReissue = account.auth_source === 'hosted'
          && account.account_status === 'invited'
          && !account.email_verified_at;
        if (!canReissue) {
          const error = new Error('An instructor account already uses this email address');
          error.code = 'ACCOUNT_ALREADY_EXISTS';
          throw error;
        }
        const updated = await client.query(
          `UPDATE admins
           SET display_name = $1,
               provisioning_source = 'master_invite',
               created_by = $2,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [displayName, createdBy, account.id]
        );
        account = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO admins (
             username, password_hash, email, display_name, role, account_status,
             auth_source, provisioning_source, created_by
           )
           VALUES ($1, $2, $3, $4, 'admin', 'invited', 'hosted', 'master_invite', $5)
           RETURNING *`,
          [username, passwordHash, normalizedEmail, displayName, createdBy]
        );
        account = inserted.rows[0];
      }

      await client.query(
        `UPDATE account_invitations
         SET used_at = NOW()
         WHERE account_id = $1 AND used_at IS NULL`,
        [account.id]
      );
      const invitation = await client.query(
        `INSERT INTO account_invitations (
           account_id, token_hash, expires_at, created_by, purpose
         )
         VALUES ($1, $2, $3, $4, 'master_invite')
         RETURNING id, account_id, expires_at, created_at`,
        [account.id, tokenHash, expiresAt, createdBy]
      );

      await client.query('COMMIT');
      return { account, invitation: invitation.rows[0] };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Invitation creation rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async createSelfServiceRegistration({
    email,
    displayName,
    username,
    passwordHash,
    tokenHash,
    expiresAt
  }) {
    const client = await pool.connect();
    const normalizedEmail = normalizeEmail(email);
    try {
      await client.query('BEGIN');
      const existingResult = await client.query(
        'SELECT * FROM admins WHERE LOWER(email) = $1 FOR UPDATE',
        [normalizedEmail]
      );
      let account = existingResult.rows[0];
      if (account) {
        const canReissue = account.auth_source === 'hosted'
          && account.provisioning_source === 'self_service'
          && account.account_status === 'invited'
          && !account.email_verified_at;
        if (!canReissue) {
          await client.query('COMMIT');
          return null;
        }
        const updated = await client.query(
          `UPDATE admins SET display_name = $1, updated_at = NOW()
           WHERE id = $2 RETURNING *`,
          [displayName, account.id]
        );
        account = updated.rows[0];
      } else {
        const inserted = await client.query(
          `INSERT INTO admins (
             username, password_hash, email, display_name, role, account_status,
             auth_source, provisioning_source, created_by
           )
           VALUES ($1, $2, $3, $4, 'admin', 'invited', 'hosted', 'self_service', NULL)
           RETURNING *`,
          [username, passwordHash, normalizedEmail, displayName]
        );
        account = inserted.rows[0];
      }

      await client.query(
        `UPDATE account_invitations SET used_at = NOW()
         WHERE account_id = $1 AND used_at IS NULL`,
        [account.id]
      );
      const invitation = await client.query(
        `INSERT INTO account_invitations (
           account_id, token_hash, expires_at, created_by, purpose
         ) VALUES ($1, $2, $3, NULL, 'self_signup')
         RETURNING id, account_id, expires_at, purpose, created_at`,
        [account.id, tokenHash, expiresAt]
      );
      await client.query('COMMIT');
      return { account, invitation: invitation.rows[0] };
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch (rollbackError) {
        console.error('Self-service registration rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async getHostedAccountInvitation(tokenHash) {
    const result = await pool.query(
      `SELECT i.id, i.account_id, i.expires_at, i.purpose, a.email, a.display_name
       FROM account_invitations i
       JOIN admins a ON a.id = i.account_id
       WHERE i.token_hash = $1
         AND i.used_at IS NULL
         AND i.expires_at > NOW()
         AND a.auth_source = 'hosted'
         AND a.account_status = 'invited'
         AND a.email_verified_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );
    return result.rows[0] || null;
  },

  async activateHostedAccountInvitation({ tokenHash, passwordHash }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const invitationResult = await client.query(
        `SELECT i.id, i.account_id, i.purpose, a.email, a.display_name
         FROM account_invitations i
         JOIN admins a ON a.id = i.account_id
         WHERE i.token_hash = $1
           AND i.used_at IS NULL
           AND i.expires_at > NOW()
           AND a.auth_source = 'hosted'
           AND a.account_status = 'invited'
           AND a.email_verified_at IS NULL
         FOR UPDATE OF i, a`,
        [tokenHash]
      );
      const invitation = invitationResult.rows[0];
      if (!invitation) {
        await client.query('COMMIT');
        return null;
      }

      await client.query(
        `UPDATE admins
         SET password_hash = $1,
             email_verified_at = NOW(),
             account_status = 'active',
             updated_at = NOW()
         WHERE id = $2`,
        [passwordHash, invitation.account_id]
      );
      await client.query(
        `UPDATE account_invitations
         SET used_at = NOW()
         WHERE account_id = $1 AND used_at IS NULL`,
        [invitation.account_id]
      );
      await client.query('COMMIT');
      return invitation;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Invitation activation rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async listHostedInstructors() {
    const result = await pool.query(
      `SELECT a.id, a.email, a.display_name, a.account_status,
              a.email_verified_at, a.created_at, a.provisioning_source,
              a.access_override, a.complimentary_access_until,
              s.status AS subscription_status,
              s.current_period_end,
              s.cancel_at_period_end,
              latest_invitation.expires_at AS invitation_expires_at,
              latest_invitation.used_at AS invitation_used_at
       FROM admins a
       LEFT JOIN subscriptions s
         ON s.account_id = a.id AND s.provider = 'stripe'
       LEFT JOIN LATERAL (
         SELECT i.expires_at, i.used_at
         FROM account_invitations i
         WHERE i.account_id = a.id
         ORDER BY i.created_at DESC
         LIMIT 1
       ) latest_invitation ON TRUE
       WHERE a.auth_source = 'hosted'
       ORDER BY a.created_at DESC`,
      []
    );
    return result.rows;
  },

  async setHostedAccessOverride(accountId, { mode, expiresAt = null }) {
    const result = await pool.query(
      `UPDATE admins
       SET access_override = $1,
           complimentary_access_until = $2,
           updated_at = NOW()
       WHERE id = $3
         AND auth_source = 'hosted'
         AND role <> 'master'
       RETURNING id, access_override, complimentary_access_until`,
      [mode === 'none' ? 'none' : 'complimentary', mode === 'temporary' ? expiresAt : null, accountId]
    );
    return result.rows[0] || null;
  },

  // ============================================
  // HOSTED BILLING
  // ============================================

  async getSubscriptionByAccountId(accountId) {
    const result = await pool.query(
      `SELECT * FROM subscriptions
       WHERE account_id = $1 AND provider = 'stripe'
       LIMIT 1`,
      [accountId]
    );
    return result.rows[0] || null;
  },

  async upsertStripeCustomer(accountId, customerId) {
    const result = await pool.query(
      `INSERT INTO subscriptions (
         account_id, provider, provider_customer_id, status
       )
       VALUES ($1, 'stripe', $2, 'checkout_pending')
       ON CONFLICT (account_id, provider) DO UPDATE
       SET provider_customer_id = EXCLUDED.provider_customer_id,
           updated_at = NOW()
       WHERE subscriptions.provider_subscription_id IS NULL
         AND subscriptions.provider_customer_id = EXCLUDED.provider_customer_id
       RETURNING *`,
      [accountId, customerId]
    );
    if (!result.rows[0]) {
      throw new Error('Stripe customer does not match the existing billing account');
    }
    return result.rows[0];
  },

  async syncStripeSubscription(subscription) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE subscriptions
         SET provider_subscription_id = $3,
             price_id = $4,
             status = $5,
             current_period_end = $6,
             cancel_at_period_end = $7,
             last_event_created_at = GREATEST(
               COALESCE(last_event_created_at, TO_TIMESTAMP(0)),
               DATE_TRUNC('second', NOW())
             ),
             updated_at = NOW()
         WHERE account_id = $1
           AND provider = 'stripe'
           AND provider_customer_id = $2
           AND (provider_subscription_id IS NULL OR provider_subscription_id = $3)
         RETURNING *`,
        [
          subscription.accountId,
          subscription.providerCustomerId,
          subscription.providerSubscriptionId,
          subscription.priceId,
          subscription.status,
          subscription.currentPeriodEnd,
          subscription.cancelAtPeriodEnd
        ]
      );
      const storedSubscription = result.rows[0] || null;
      if (storedSubscription) {
        await client.query(
          `UPDATE admins
           SET account_status = $1, updated_at = NOW()
           WHERE id = $2
             AND auth_source = 'hosted'
             AND role <> 'master'
             AND account_status NOT IN ('suspended', 'deleted')`,
          [subscription.accountStatus, subscription.accountId]
        );
      }
      await client.query('COMMIT');
      return storedSubscription;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Stripe subscription sync rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
  },

  async applyStripeBillingEvent({
    eventId,
    eventType,
    eventCreatedAt,
    payloadDigest,
    subscription
  }) {
    const client = await pool.connect();
    const eventCreatedDate = Number.isFinite(eventCreatedAt)
      ? new Date(eventCreatedAt * 1000)
      : null;

    try {
      await client.query('BEGIN');
      const eventInsert = await client.query(
        `INSERT INTO billing_events (
           provider_event_id, event_type, event_created_at, payload_digest
         )
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (provider_event_id) DO NOTHING
         RETURNING provider_event_id`,
        [eventId, eventType, eventCreatedDate, payloadDigest]
      );

      if (eventInsert.rowCount === 0) {
        await client.query('COMMIT');
        return { duplicate: true };
      }

      let outcome = 'ignored';
      let storedSubscription = null;

      if (subscription) {
        const accountResult = await client.query(
          'SELECT id, role, auth_source FROM admins WHERE id = $1 FOR UPDATE',
          [subscription.accountId]
        );
        const account = accountResult.rows[0];

        if (account && account.role !== 'master' && account.auth_source === 'hosted') {
          const upsertResult = await client.query(
            `INSERT INTO subscriptions (
               account_id, provider, provider_customer_id, provider_subscription_id,
               price_id, status, current_period_end, cancel_at_period_end,
               last_event_created_at
             )
             VALUES ($1, 'stripe', $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (account_id, provider) DO UPDATE
             SET provider_customer_id = EXCLUDED.provider_customer_id,
                 provider_subscription_id = EXCLUDED.provider_subscription_id,
                 price_id = EXCLUDED.price_id,
                 status = EXCLUDED.status,
                 current_period_end = EXCLUDED.current_period_end,
                 cancel_at_period_end = EXCLUDED.cancel_at_period_end,
                 last_event_created_at = EXCLUDED.last_event_created_at,
                 updated_at = NOW()
             WHERE subscriptions.last_event_created_at IS NULL
                OR subscriptions.last_event_created_at <= EXCLUDED.last_event_created_at
             RETURNING *`,
            [
              subscription.accountId,
              subscription.providerCustomerId,
              subscription.providerSubscriptionId,
              subscription.priceId,
              subscription.status,
              subscription.currentPeriodEnd,
              subscription.cancelAtPeriodEnd,
              eventCreatedDate
            ]
          );
          storedSubscription = upsertResult.rows[0] || null;

          if (storedSubscription) {
            await client.query(
              `UPDATE admins
               SET account_status = $1, updated_at = NOW()
               WHERE id = $2
                 AND account_status NOT IN ('suspended', 'deleted')`,
              [subscription.accountStatus, subscription.accountId]
            );
          }
          outcome = 'processed';
        }
      }

      await client.query(
        `UPDATE billing_events
         SET processed_at = NOW(), outcome = $1
         WHERE provider_event_id = $2`,
        [outcome, eventId]
      );
      await client.query('COMMIT');
      return { duplicate: false, outcome, subscription: storedSubscription };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Billing event rollback failed:', rollbackError.message);
      }
      throw error;
    } finally {
      client.release();
    }
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
