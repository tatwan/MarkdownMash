// Pure rules for My library: what a saved Mash is allowed to be.
// No sockets, no timers, no database — server.js and db.js own all of that.
// Parsers are injected so this module has no opinion on Markdown itself.

const SAVED_MASH_KINDS = Object.freeze(['quiz', 'survey']);
const MAX_SAVED_MASHES_PER_OWNER = 200;
const MAX_NAME_LENGTH = 80;

function normalizeKind(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim().toLowerCase();
  return SAVED_MASH_KINDS.includes(candidate) ? candidate : null;
}

// Same wording as the session-create route, so a host sees one message
// whether they save first or open a room first.
function emptyQuestionsMessage(kind) {
  return kind === 'survey'
    ? 'Survey needs at least one question with options'
    : 'Quiz needs at least one question';
}

function reject(error) {
  return { ok: false, status: 400, error };
}

function validateSavedMashInput({ name, kind, markdown } = {}, { parseQuiz, parseSurvey } = {}) {
  const normalizedKind = normalizeKind(kind);
  if (!normalizedKind) return reject('Choose quiz or survey');

  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) return reject('Give this Mash a name');
  if (trimmedName.length > MAX_NAME_LENGTH) {
    return reject(`Name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }

  if (typeof markdown !== 'string' || !markdown.trim()) {
    return reject('Paste some Markdown first');
  }

  const parse = normalizedKind === 'survey' ? parseSurvey : parseQuiz;
  if (typeof parse !== 'function') {
    throw new TypeError(`No parser for ${normalizedKind}`);
  }
  const parsed = parse(markdown);
  const questionCount = Array.isArray(parsed?.questions) ? parsed.questions.length : 0;
  if (questionCount === 0) return reject(emptyQuestionsMessage(normalizedKind));

  return {
    ok: true,
    value: { name: trimmedName, kind: normalizedKind, markdown, questionCount }
  };
}

function canCreateAnother(currentCount) {
  return Number.isInteger(currentCount)
    && currentCount >= 0
    && currentCount < MAX_SAVED_MASHES_PER_OWNER;
}

// Route ids must be plain decimal digits: "1e3" and "1e30" are not ids, and
// the second one would reach Postgres as a string bigint cannot parse.
function parseSavedMashId(raw) {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,15}$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

// The list shape. Deliberately excludes markdown and owner_id.
function summarizeSavedMash(row) {
  return {
    id: Number(row.id),
    name: row.name,
    kind: row.kind,
    questionCount: Number(row.question_count) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  SAVED_MASH_KINDS,
  MAX_SAVED_MASHES_PER_OWNER,
  MAX_NAME_LENGTH,
  normalizeKind,
  validateSavedMashInput,
  canCreateAnother,
  summarizeSavedMash,
  parseSavedMashId
};
