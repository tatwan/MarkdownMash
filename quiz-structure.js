// Pure quiz structure: markdown text in, a validated quiz object out.
// No sockets, no timers, no database — server.js owns all of that.

const {
  DEFAULT_TIME_LIMIT, DEFAULT_TOTAL_SCORE, DEFAULT_PASSING_PERCENT, parseQuizMarkdown
} = require('./public/js/mash-parser');

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
