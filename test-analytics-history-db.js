const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { parseHistoryQuery } = require('./analytics-history');

// Run explicitly against a test database. A private schema keeps fixtures apart
// from existing tables; neither the application schema nor its rows are changed.
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for the history database test');
const databaseUrl = new URL(process.env.DATABASE_URL);
const schema = `history_test_${process.pid}_${Date.now()}`;
databaseUrl.searchParams.set('options', `-c search_path=${schema}`);
process.env.DATABASE_URL = databaseUrl.toString();
process.env.SKIP_DATABASE_INIT = 'true';
const db = require('./db');
const pool = new Pool({ connectionString: databaseUrl.toString() });
const options = query => parseHistoryQuery(query).value;
const history = (owner, query = {}) => db.getSessionAnalytics(owner, options(query));

async function run() {
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE sessions (
        id serial PRIMARY KEY, owner_id integer, code text, quiz_title text, status text,
        created_at timestamp, started_at timestamp, ended_at timestamp,
        total_questions integer, total_score integer, course_name text, is_test boolean, session_type text
      );
      CREATE TABLE participants (id serial PRIMARY KEY, session_id integer, correct_count integer);
      CREATE TABLE answers (id serial PRIMARY KEY, session_id integer);
      INSERT INTO sessions (owner_id, code, quiz_title, status, created_at, ended_at,
        total_questions, total_score, course_name, is_test, session_type)
      SELECT 1, 'A' || lpad(i::text, 5, '0'),
        CASE WHEN i = 1 THEN 'Old 100%_\\ Mash' ELSE 'Lesson ' || i END,
        'ended', '2026-01-01'::timestamp + i * interval '1 day',
        '2026-01-01'::timestamp + i * interval '1 day', 2, 100,
        CASE WHEN i <= 10 THEN 'Older group' ELSE 'Current group' END, false,
        CASE WHEN i <= 5 THEN 'survey' WHEN i = 6 THEN NULL ELSE 'quiz' END
      FROM generate_series(1, 84) i;
      INSERT INTO sessions (owner_id, code, quiz_title, status, created_at, total_questions, is_test, session_type)
      VALUES (1, 'ACTIVE', 'Interrupted', 'active', '2026-12-01', 2, false, 'quiz'),
        (1, 'CREATE', 'Unstarted', 'created', '2026-12-01', 2, NULL, 'quiz'),
        (1, 'TSTACT', 'Test active', 'active', '2026-12-01', 2, true, 'quiz'),
        (1, 'TSTEND', 'Test ended', 'ended', '2026-12-01', 2, true, 'quiz'),
        (NULL, 'LEGACY', 'Unowned', 'ended', '2026-12-01', 2, false, 'quiz');
      INSERT INTO sessions (owner_id, code, quiz_title, status, created_at, course_name, is_test, session_type)
      SELECT 2, 'B' || lpad(i::text, 5, '0'), 'Private lesson', 'ended', '2026-12-01',
        'Private group', true, 'survey' FROM generate_series(1, 65) i;
      INSERT INTO participants (session_id, correct_count) SELECT id, 1 FROM sessions WHERE code IN ('A00001', 'A00006');
      INSERT INTO answers (session_id) SELECT id FROM sessions WHERE code IN ('A00001', 'A00006');
    `);

    const first = await history(1);
    const second = await history(1, { page: '2' });
    assert.equal(Number(first.total), 88);
    assert.equal(first.sessions.length, 50);
    assert.equal(second.sessions.length, 38);
    assert.equal(new Set([...first.sessions, ...second.sessions].map(s => s.id)).size, 88);
    assert.deepEqual(first.sessions.slice(0, 4).map(s => s.code), ['TSTEND', 'TSTACT', 'CREATE', 'ACTIVE'],
      'equal dates use descending id to keep page boundaries stable');
    assert.equal(second.sessions.at(-1).code, 'A00001');
    assert.deepEqual(first.courses, ['Current group', 'Older group']);
    assert.deepEqual((await history(1, { search: 'a00001' })).sessions.map(s => s.code), ['A00001']);
    assert.equal(Number((await history(1, { search: '100%_\\' })).total), 1, 'SQL wildcard characters are literal');
    assert.equal(Number((await history(1, { search: "' OR true --" })).total), 0);
    assert.equal(Number((await history(1, { search: 'older GROUP' })).total), 10);
    assert.equal(Number((await history(1, { course: 'Older group' })).total), 10);
    assert.equal(Number((await history(1, { type: 'survey' })).total), 5);
    assert.equal(Number((await history(1, { type: 'quiz' })).total), 83, 'legacy NULL type remains quiz');
    assert.equal(Number((await history(1, { filter: 'ended' })).total), 85, 'completed includes test runs');
    assert.equal(Number((await history(1, { filter: 'incomplete' })).total), 2, 'incomplete excludes test runs');
    assert.equal(Number((await history(1, { filter: 'test' })).total), 2);
    const combined = await history(1, { course: 'Older group', type: 'survey', filter: 'ended', search: 'old' });
    assert.equal(Number(combined.total), 5);
    assert.equal(combined.sessions[0].avg_score_percent, null);
    assert.equal(combined.sessions.at(-1).response_count, 1);
    assert.equal(combined.sessions.at(-1).participant_count, 1);
    assert.equal(Number((await history(1, { search: 'A00006' })).sessions[0].avg_score_percent), 50);
    assert.equal((await history(1, { page: '3' })).sessions.length, 0);
    assert.equal((await history(1, { limit: '100' })).sessions.length, 88);
    await pool.query("UPDATE sessions SET course_name = 'all' WHERE code = 'A00084'");
    assert.equal(Number((await history(1, { course: 'all' })).total), 1,
      'a group named all is an exact filter, not the no-filter sentinel');
    for (const query of [{}, { page: '2' }, { search: 'Private' }, { course: 'Private group' }, { filter: 'test', type: 'survey' }]) {
      const result = await history(1, query);
      assert.ok(result.sessions.every(s => !s.code.startsWith('B')));
      assert.ok(!result.courses.includes('Private group'));
    }
    const other = await history(2);
    assert.equal(Number(other.total), 65);
    assert.deepEqual(other.courses, ['Private group']);
    assert.ok(other.sessions.every(s => s.code.startsWith('B')));
    for (const owner of [null, 999]) {
      const empty = await history(owner);
      assert.equal(Number(empty.total), 0);
      assert.deepEqual(empty.sessions, []);
      assert.deepEqual(empty.courses, []);
    }
    console.log('Analytics history database integration passed (88 + 65 sessions; owner isolation, full-history filters, metrics and pagination).');
  } finally {
    await db.close();
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
