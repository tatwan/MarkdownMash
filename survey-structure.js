// Pure survey structure: markdown text in, a validated survey object out.
// Surveys are a separate session type (v1.5.0). No correctness, no score.

const { stepAt, questionForStep, DEFAULT_TIME_LIMIT } = require('./quiz-structure');

function assignDisplayNumbers(survey) {
  let counter = 0;
  for (const question of survey.questions) {
    counter += 1;
    question.displayNumber = counter;
    question.gradedNumber = null;
    question.type = 'survey';
    question.correctIndices = [];
  }
}

function parseSurveyMarkdown(markdown) {
  const lines = String(markdown === undefined || markdown === null ? '' : markdown).split('\n');
  const survey = {
    title: '',
    totalScore: 0,
    passingPercent: 0,
    sessionKind: 'survey',
    questions: [],
    steps: []
  };

  let currentQuestion = null;
  let pendingSection = null;
  let currentSectionTitle = null;

  function flushQuestion() {
    if (!currentQuestion) return;
    currentQuestion.text = currentQuestion.text.trim();
    currentQuestion.index = survey.questions.length;
    survey.questions.push(currentQuestion);
    survey.steps.push({ kind: 'question', questionIndex: currentQuestion.index });
    currentQuestion = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // # Score is a no-op in surveys (quiz muscle memory).
    if (/^#\s*Score\s+\d+$/i.test(trimmed)) {
      continue;
    }

    const sectionMatch = trimmed.match(/^#\s*Section:\s*(.+)$/i);
    if (sectionMatch) {
      flushQuestion();
      pendingSection = { kind: 'section', title: sectionMatch[1].trim(), subtitle: null };
      currentSectionTitle = pendingSection.title;
      continue;
    }

    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      survey.title = trimmed.slice(2).trim();
      continue;
    }

    if (trimmed.startsWith('## ')) {
      flushQuestion();
      if (pendingSection) {
        survey.steps.push(pendingSection);
        pendingSection = null;
      }
      const questionText = trimmed.slice(3).replace(/^Q\d+:\s*/, '').trim();
      currentQuestion = {
        id: survey.questions.length + 1,
        index: null,
        text: questionText,
        options: [],
        correctIndices: [],
        timeLimit: DEFAULT_TIME_LIMIT,
        type: 'survey',
        gradedNumber: null,
        displayNumber: null,
        sectionTitle: currentSectionTitle
      };
      continue;
    }

    // Checkbox options: mark is ignored — never correctness.
    const checkboxOption = trimmed.match(/^-\s*\[[ xX]\]\s*(.+)$/);
    if (checkboxOption && currentQuestion) {
      currentQuestion.options.push(checkboxOption[1].trim());
      continue;
    }

    // Plain list options.
    const plainOption = trimmed.match(/^-\s+(.+)$/);
    if (plainOption && currentQuestion) {
      currentQuestion.options.push(plainOption[1].trim());
      continue;
    }

    const timeMatch = trimmed.match(/^::time=(\d+)$/);
    if (timeMatch && currentQuestion) {
      currentQuestion.timeLimit = parseInt(timeMatch[1], 10);
      continue;
    }

    // ::type= is ignored in survey mode.
    if (/^::type=/i.test(trimmed)) {
      continue;
    }

    if (pendingSection && !currentQuestion && trimmed.startsWith('> ')) {
      pendingSection.subtitle = trimmed.slice(2).trim();
      continue;
    }

    if (currentQuestion) {
      currentQuestion.text += '\n' + line;
    }
  }

  flushQuestion();
  assignDisplayNumbers(survey);
  return survey;
}

function normalizeStoredSurvey(data) {
  if (!data || !Array.isArray(data.questions)) {
    return {
      title: '',
      totalScore: 0,
      passingPercent: 0,
      sessionKind: 'survey',
      questions: [],
      steps: []
    };
  }

  const survey = {
    ...data,
    sessionKind: 'survey',
    totalScore: 0,
    passingPercent: 0,
    questions: data.questions.map((question, index) => ({
      ...question,
      index,
      type: 'survey',
      correctIndices: [],
      gradedNumber: null,
      sectionTitle: question.sectionTitle === undefined ? null : question.sectionTitle
    }))
  };

  survey.steps = Array.isArray(data.steps) && data.steps.length > 0
    ? data.steps
    : survey.questions.map(question => ({ kind: 'question', questionIndex: question.index }));

  assignDisplayNumbers(survey);
  return survey;
}

function questionCount(survey) {
  if (!survey || !Array.isArray(survey.questions)) return 0;
  return survey.questions.length;
}

function isSurveyPayload(data) {
  return Boolean(
    data
    && (data.sessionKind === 'survey'
      || (Array.isArray(data.questions)
        && data.questions.length > 0
        && data.questions.every(q => q && q.type === 'survey')))
  );
}

module.exports = {
  parseSurveyMarkdown,
  normalizeStoredSurvey,
  questionCount,
  isSurveyPayload,
  stepAt,
  questionForStep
};
