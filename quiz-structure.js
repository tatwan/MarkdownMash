// Pure quiz structure: markdown text in, a validated quiz object out.
// No sockets, no timers, no database — server.js owns all of that.

const DEFAULT_TIME_LIMIT = 20;
const DEFAULT_TOTAL_SCORE = 100;
const DEFAULT_PASSING_PERCENT = 70;

const QUESTION_TYPES = ['graded', 'ungraded'];

// Anything unrecognised — including 'survey', which is a separate session
// type in v1.5.0 and not a quiz question kind — falls back to graded.
function normalizeType(value) {
  if (value === undefined || value === null) return 'graded';
  const candidate = String(value).trim().toLowerCase();
  return QUESTION_TYPES.includes(candidate) ? candidate : 'graded';
}

// gradedNumber is what renders "Question 3 of 10" and must count scored
// questions only, so the counter and the finale share one denominator.
function assignGradedNumbers(quiz) {
  let counter = 0;
  for (const question of quiz.questions) {
    if (question.type === 'graded') {
      counter += 1;
      question.gradedNumber = counter;
    } else {
      question.gradedNumber = null;
    }
  }
}

function parseQuizMarkdown(markdown) {
  const lines = String(markdown === undefined || markdown === null ? '' : markdown).split('\n');
  const quiz = {
    title: '',
    totalScore: DEFAULT_TOTAL_SCORE,
    passingPercent: DEFAULT_PASSING_PERCENT,
    questions: [],
    steps: []
  };

  let currentQuestion = null;
  let pendingSection = null;
  let currentSectionTitle = null;
  let sectionDefaultType = null;

  function flushQuestion() {
    if (!currentQuestion) return;
    currentQuestion.text = currentQuestion.text.trim();
    currentQuestion.index = quiz.questions.length;
    quiz.questions.push(currentQuestion);
    quiz.steps.push({ kind: 'question', questionIndex: currentQuestion.index });
    currentQuestion = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Score setting (# Score 100) — checked before the title rule.
    const scoreMatch = trimmed.match(/^#\s*Score\s+(\d+)$/i);
    if (scoreMatch) {
      quiz.totalScore = parseInt(scoreMatch[1], 10);
      continue;
    }

    // Section (# Section: Name). MUST be checked before the title rule below,
    // exactly as # Score is, or a section silently overwrites quiz.title.
    const sectionMatch = trimmed.match(/^#\s*Section:\s*(.+)$/i);
    if (sectionMatch) {
      flushQuestion();
      pendingSection = { kind: 'section', title: sectionMatch[1].trim(), subtitle: null };
      currentSectionTitle = pendingSection.title;
      sectionDefaultType = null;
      continue;
    }

    // Quiz title (# Title)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      quiz.title = trimmed.slice(2).trim();
      continue;
    }

    // Question (## Q1: Question text)
    if (trimmed.startsWith('## ')) {
      flushQuestion();
      // A section only enters the flow once a question follows it, so a
      // trailing heading cannot produce a curtain the quiz never leaves.
      if (pendingSection) {
        quiz.steps.push(pendingSection);
        pendingSection = null;
      }
      const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
      currentQuestion = {
        id: quiz.questions.length + 1,
        index: null,
        text: questionText,
        options: [],
        correctIndices: [],
        timeLimit: DEFAULT_TIME_LIMIT,
        type: normalizeType(sectionDefaultType),
        gradedNumber: null,
        sectionTitle: currentSectionTitle
      };
      continue;
    }

    // Option (- [ ] or - [x])
    const optionMatch = trimmed.match(/^-\s*\[([ xX])\]\s*(.+)$/);
    if (optionMatch && currentQuestion) {
      const isCorrect = optionMatch[1].toLowerCase() === 'x';
      const optionIndex = currentQuestion.options.length;
      currentQuestion.options.push(optionMatch[2].trim());
      if (isCorrect) currentQuestion.correctIndices.push(optionIndex);
      continue;
    }

    // Time metadata (::time=20)
    const timeMatch = trimmed.match(/^::time=(\d+)$/);
    if (timeMatch && currentQuestion) {
      currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
      continue;
    }

    // Type metadata (::type=graded|ungraded). Binds to the open question when
    // there is one, otherwise becomes the pending section's default.
    const typeMatch = trimmed.match(/^::type=([A-Za-z]+)$/);
    if (typeMatch) {
      if (currentQuestion) {
        currentQuestion.type = normalizeType(typeMatch[1]);
      } else if (pendingSection) {
        sectionDefaultType = normalizeType(typeMatch[1]);
      }
      continue;
    }

    // Section subtitle. Safe to claim: text before the first question was
    // already discarded, because the fallback append below is guarded by
    // `if (currentQuestion)`.
    if (pendingSection && !currentQuestion && trimmed.startsWith('> ')) {
      pendingSection.subtitle = trimmed.slice(2).trim();
      continue;
    }

    // Unmatched lines extend the current question's text. The original `line`
    // is used, not `trimmed`, to preserve indentation inside code blocks.
    if (currentQuestion) {
      currentQuestion.text += '\n' + line;
    }
  }

  flushQuestion();
  assignGradedNumbers(quiz);
  return quiz;
}

// Quizzes persisted before this release have no steps[], no type, and no
// index. Rebuild them so every consumer can assume the current shape.
function normalizeStoredQuiz(quizData) {
  if (!quizData || !Array.isArray(quizData.questions)) {
    return {
      title: '',
      totalScore: DEFAULT_TOTAL_SCORE,
      passingPercent: DEFAULT_PASSING_PERCENT,
      questions: [],
      steps: []
    };
  }

  const quiz = {
    ...quizData,
    questions: quizData.questions.map((question, index) => ({
      ...question,
      index,
      type: normalizeType(question.type),
      sectionTitle: question.sectionTitle === undefined ? null : question.sectionTitle
    }))
  };

  quiz.steps = Array.isArray(quizData.steps) && quizData.steps.length > 0
    ? quizData.steps
    : quiz.questions.map(question => ({ kind: 'question', questionIndex: question.index }));

  assignGradedNumbers(quiz);
  return quiz;
}

function gradedCount(quiz) {
  if (!quiz || !Array.isArray(quiz.questions)) return 0;
  return quiz.questions.filter(question => normalizeType(question.type) === 'graded').length;
}

// Returns 0 rather than NaN when nothing is scored. An unguarded divisor
// would propagate NaN into five call sites and into the database.
function pointsPerQuestion(quiz) {
  const scored = gradedCount(quiz);
  if (scored === 0) return 0;
  return quiz.totalScore / scored;
}

function isScored(question) {
  return normalizeType(question && question.type) === 'graded';
}

function stepAt(quiz, stepIndex) {
  if (!quiz || !Array.isArray(quiz.steps)) return null;
  if (stepIndex < 0 || stepIndex >= quiz.steps.length) return null;
  return quiz.steps[stepIndex];
}

function questionForStep(quiz, stepIndex) {
  const step = stepAt(quiz, stepIndex);
  if (!step || step.kind !== 'question') return null;
  return quiz.questions[step.questionIndex] || null;
}

module.exports = {
  DEFAULT_TIME_LIMIT,
  DEFAULT_TOTAL_SCORE,
  DEFAULT_PASSING_PERCENT,
  parseQuizMarkdown,
  normalizeStoredQuiz,
  gradedCount,
  pointsPerQuestion,
  isScored,
  stepAt,
  questionForStep
};
